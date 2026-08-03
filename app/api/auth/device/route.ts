export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/d1-client";
import { getOAuthClientById, hashIpForSession, shortUaForSession } from "@/lib/db";
import { createDeviceAuthorization, DEVICE_CODE_TTL_SECONDS } from "@/lib/device-flow";
import { validateRequestedScopes } from "@/lib/scopes";
import { createDeviceAuthRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/auth/device
 *
 * Device Authorization Endpoint (RFC 8628 §3.1). Public CLI/headless
 * clients call this first, before any user interaction, to obtain a
 * device_code + user_code pair.
 *
 * Body (application/x-www-form-urlencoded OR application/json):
 *   client_id  — registered public client, e.g. "lixblogs-cli"
 *   scope      — space-separated scopes (optional; defaults to none)
 *
 * No client_secret is accepted or required — public clients have none,
 * and this endpoint deliberately doesn't authenticate the caller beyond
 * `client_id` validation + rate limiting, per RFC 8628 §5.
 */
export async function POST(request: NextRequest) {
    try {
        let clientId: string | undefined;
        let scope: string | undefined;

        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const body: any = await request.json();
            clientId = body.client_id;
            scope = body.scope;
        } else {
            const form = await request.formData();
            clientId = form.get("client_id")?.toString();
            scope = form.get("scope")?.toString();
        }

        if (!clientId) {
            return NextResponse.json(
                { error: "invalid_request", error_description: "client_id is required" },
                { status: 400 },
            );
        }

        const ipAddress =
            request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
            request.headers.get("cf-connecting-ip") ||
            "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";

        const db = await getDatabase();

        // Rate limit device-code issuance per (client, IP) — prevents an
        // attacker from farming large numbers of pending codes to brute
        // force / phish against the short user-code space.
        const rateLimiter = createDeviceAuthRateLimiter();
        const rateLimit = await rateLimiter.check(db, ipAddress, `device:${clientId}`);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "slow_down", error_description: "Too many device authorization requests" },
                { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 30) } },
            );
        }

        const client = await getOAuthClientById(db, clientId);
        if (!client || !(client as any).is_active) {
            return NextResponse.json(
                { error: "invalid_client", error_description: "Client not found or not active" },
                { status: 401 },
            );
        }

        if (!(client as any).is_public) {
            return NextResponse.json(
                {
                    error: "unauthorized_client",
                    error_description: "Client is not registered as a public device-flow client",
                },
                { status: 400 },
            );
        }

        const allowedGrants: string[] = JSON.parse(
            (client as any).allowed_grant_types || "[]",
        );
        if (!allowedGrants.includes("urn:ietf:params:oauth:grant-type:device_code")) {
            return NextResponse.json(
                {
                    error: "unauthorized_client",
                    error_description: "Client is not authorized for the device_code grant",
                },
                { status: 400 },
            );
        }

        const clientScopes: string[] = JSON.parse((client as any).scopes || "[]");
        const requestedScope = (scope || "").trim() || clientScopes.join(" ");
        const { valid, invalid } = validateRequestedScopes(requestedScope, clientScopes);
        if (!valid) {
            return NextResponse.json(
                {
                    error: "invalid_scope",
                    error_description: `Requested scope(s) not permitted for this client: ${invalid.join(", ")}`,
                },
                { status: 400 },
            );
        }

        const ipHash = await hashIpForSession(ipAddress);
        const uaShort = shortUaForSession(userAgent);

        const { deviceCode, userCode, expiresAt, interval } =
            await createDeviceAuthorization(db, {
                clientId,
                scopes: requestedScope,
                ipHash,
                uaShort,
            });

        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            request.nextUrl.origin ||
            "https://accounts.elixpo.com";
        const verificationUri = `${baseUrl}/device`;
        const verificationUriComplete = `${verificationUri}?user_code=${encodeURIComponent(userCode)}`;

        return NextResponse.json({
            device_code: deviceCode,
            user_code: userCode,
            verification_uri: verificationUri,
            verification_uri_complete: verificationUriComplete,
            expires_in: DEVICE_CODE_TTL_SECONDS,
            interval,
        });
    } catch (error) {
        console.error("[Device Authorization] Error:", error);
        return NextResponse.json(
            { error: "server_error", error_description: "Failed to create device authorization" },
            { status: 500 },
        );
    }
}
