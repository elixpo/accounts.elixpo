export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/d1-client";
import { getOAuthClientById, getUserById, logAuditEvent } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import {
    approveDeviceAuthorization,
    denyDeviceAuthorization,
    getDeviceAuthorizationByUserCode,
} from "@/lib/device-flow";
import { describeScopes } from "@/lib/scopes";
import { generateUUID } from "@/lib/webcrypto";
import { createDeviceVerifyRateLimiter } from "@/lib/rate-limit";

function currentAccount(request: NextRequest) {
    const cookieToken = request.cookies.get("access_token")?.value;
    const headerToken = request.headers.get("authorization")?.replace("Bearer ", "");
    return cookieToken || headerToken || null;
}

function statusOf(row: any): "pending" | "approved" | "denied" | "consumed" | "expired" {
    if (row.status === "pending" && new Date(row.expires_at).getTime() < Date.now()) {
        return "expired";
    }
    return row.status;
}

/**
 * GET /api/auth/device/verify?user_code=WXHF-7NKQ
 *
 * Looked up by the /device verification page. Requires the caller to be
 * signed in (so we know which account is about to authorize) but does
 * NOT approve anything — that only happens on POST with explicit intent.
 */
export async function GET(request: NextRequest) {
    try {
        const userCode = request.nextUrl.searchParams.get("user_code");
        if (!userCode) {
            return NextResponse.json(
                { error: "invalid_request", error_description: "user_code is required" },
                { status: 400 },
            );
        }

        const ipAddress =
            request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
            request.headers.get("cf-connecting-ip") ||
            "unknown";
        const db = await getDatabase();

        const rateLimiter = createDeviceVerifyRateLimiter();
        const rl = await rateLimiter.check(db, ipAddress, "device-verify-lookup");
        if (!rl.allowed) {
            return NextResponse.json(
                { error: "slow_down", error_description: "Too many attempts, try again shortly" },
                { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 30) } },
            );
        }

        const accessToken = currentAccount(request);
        if (!accessToken) {
            return NextResponse.json({ error: "unauthorized", requiresLogin: true }, { status: 401 });
        }
        const payload = await verifyJWT(accessToken);
        if (payload?.type !== "access") {
            return NextResponse.json({ error: "unauthorized", requiresLogin: true }, { status: 401 });
        }

        const row = await getDeviceAuthorizationByUserCode(db, userCode);
        if (!row) {
            return NextResponse.json({ status: "invalid" }, { status: 404 });
        }

        const status = statusOf(row);
        if (status !== "pending") {
            return NextResponse.json({ status });
        }

        const client = await getOAuthClientById(db, row.client_id);
        const user = await getUserById(db, payload.sub);

        return NextResponse.json({
            status: "pending",
            id: row.id,
            clientId: row.client_id,
            clientName: (client as any)?.name || row.client_id,
            scopes: describeScopes(row.scopes),
            expiresAt: row.expires_at,
            account: {
                email: (user as any)?.email,
                displayName: (user as any)?.display_name || null,
            },
        });
    } catch (error) {
        console.error("[Device Verify GET] Error:", error);
        return NextResponse.json(
            { error: "server_error", error_description: "Failed to look up device code" },
            { status: 500 },
        );
    }
}

/**
 * POST /api/auth/device/verify
 * Body: { id: string, action: "approve" | "deny" }
 *
 * Explicit approve/deny only — never auto-approved from the GET lookup
 * or from the verification_uri_complete link itself. The signed-in
 * user's access token determines which account is bound to the grant.
 */
export async function POST(request: NextRequest) {
    try {
        const body: any = await request.json();
        const { id, action } = body;

        if (!id || (action !== "approve" && action !== "deny")) {
            return NextResponse.json(
                { error: "invalid_request", error_description: "id and action ('approve'|'deny') are required" },
                { status: 400 },
            );
        }

        const ipAddress =
            request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
            request.headers.get("cf-connecting-ip") ||
            "unknown";
        const db = await getDatabase();

        const rateLimiter = createDeviceVerifyRateLimiter();
        const rl = await rateLimiter.check(db, ipAddress, "device-verify-decide");
        if (!rl.allowed) {
            return NextResponse.json(
                { error: "slow_down", error_description: "Too many attempts, try again shortly" },
                { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 30) } },
            );
        }

        const accessToken = currentAccount(request);
        if (!accessToken) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        const payload = await verifyJWT(accessToken);
        if (payload?.type !== "access") {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const ok =
            action === "approve"
                ? await approveDeviceAuthorization(db, id, payload.sub)
                : await denyDeviceAuthorization(db, id);

        await logAuditEvent(db, {
            id: generateUUID(),
            userId: payload.sub,
            eventType: action === "approve" ? "device_authorization_approved" : "device_authorization_denied",
            ipAddress,
            userAgent: request.headers.get("user-agent") || "unknown",
            status: ok ? "success" : "failure",
        });

        if (!ok) {
            return NextResponse.json(
                { error: "invalid_grant", error_description: "Code was already resolved or has expired" },
                { status: 409 },
            );
        }

        return NextResponse.json({ status: action === "approve" ? "approved" : "denied" });
    } catch (error) {
        console.error("[Device Verify POST] Error:", error);
        return NextResponse.json(
            { error: "server_error", error_description: "Failed to process decision" },
            { status: 500 },
        );
    }
}
