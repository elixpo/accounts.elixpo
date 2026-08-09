export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/d1-client";
import { verifyJWT } from "@/lib/jwt";
import { revokeAllRefreshTokensForUser, logAuditEvent } from "@/lib/db";
import { generateUUID } from "@/lib/webcrypto";

export async function DELETE(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.split(" ")[1];
    const payload = await verifyJWT(token);
    
    if (!payload || payload.type !== "access") {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const db = await getDatabase();
    await revokeAllRefreshTokensForUser(db, payload.sub, "account_revoke");
    
    await logAuditEvent(db, {
        id: generateUUID(),
        userId: payload.sub,
        eventType: "sessions_revoked_all",
        status: "success"
    }).catch(() => {});

    return NextResponse.json({ success: true });
}
