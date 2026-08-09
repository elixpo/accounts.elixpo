export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/d1-client";
import { authenticateOAuthClient, getRefreshTokenByHashIncludingRevoked, revokeRefreshTokenFamily, logAuditEvent } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import { generateUUID, hashString } from "@/lib/webcrypto";

export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get("content-type") || "";
        let body: any;
        if (contentType.includes("application/x-www-form-urlencoded")) {
            const formData = await request.formData();
            body = Object.fromEntries(formData.entries());
        } else {
            body = await request.json().catch(() => ({}));
        }

        const { token, client_id, client_secret } = body;

        if (!token || !client_id) {
            return NextResponse.json({ error: "invalid_request" }, { status: 400 });
        }

        const db = await getDatabase();
        const client = await authenticateOAuthClient(db, client_id, client_secret ? await hashString(client_secret) : null);
        
        if (!client) {
            return NextResponse.json({ error: "invalid_client" }, { status: 401 });
        }

        const isJwt = token.split('.').length === 3;
        if (isJwt) {
            const payload = await verifyJWT(token);
            if (payload?.sid) {
                await revokeRefreshTokenFamily(db, payload.sid, "logout");
                await logAuditEvent(db, { id: generateUUID(), userId: payload.sub, eventType: "session_revoked", provider: client_id, status: "success" }).catch(() => {});
            } else {
                const tokenHash = await hashString(token);
                const record = await getRefreshTokenByHashIncludingRevoked(db, tokenHash) as any;
                if (record?.family_id && record.client_id === client_id) {
                    await revokeRefreshTokenFamily(db, record.family_id, "logout");
                    await logAuditEvent(db, { id: generateUUID(), userId: record.user_id, eventType: "session_revoked", provider: client_id, status: "success" }).catch(() => {});
                }
            }
        }

        return NextResponse.json({}, { status: 200 });
    } catch (error) {
        console.error("[Revoke Endpoint] Error:", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
