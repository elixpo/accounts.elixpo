import type { D1Database } from "@cloudflare/workers-types";
import { getRefreshTokenByHashIncludingRevoked, revokeRefreshToken, revokeRefreshTokenFamily, logAuditEvent, createRefreshToken as storeRefreshToken, getUserById, hashIpForSession, shortUaForSession } from "./db";
import { createAccessToken, createRefreshToken, verifyJWT } from "./jwt";
import { generateUUID, hashString } from "./webcrypto";

export type RefreshTokenRow = {
    id: string;
    token_hash: string;
    user_id: string;
    expires_at: number;
    revoked: number;
    revoked_reason: string | null;
    family_id: string | null;
    parent_token_hash: string | null;
    sid: string | null;
    client_id: string | null;
};

export type RotationDecision =
    | { kind: "not_found_or_expired" }
    | { kind: "reuse_detected"; familyId: string }
    | { kind: "rotate" };

export function evaluateRefreshTokenForRotation(
    existing: RefreshTokenRow | null | undefined,
    now: number
): RotationDecision {
    if (!existing) return { kind: "not_found_or_expired" };
    
    const expiresAt = new Date(existing.expires_at).getTime();
    if (expiresAt < now) return { kind: "not_found_or_expired" };

    if (existing.revoked === 1 || existing.revoked_reason) {
        if (existing.revoked_reason === "rotated" && existing.family_id) {
            return { kind: "reuse_detected", familyId: existing.family_id };
        }
        return { kind: "not_found_or_expired" };
    }

    return { kind: "rotate" };
}

export async function rotateRefreshToken(
    db: D1Database,
    params: {
        refreshTokenJWT: string;
        clientId: string;
        clientAudience?: string;
        ipAddress?: string;
        userAgent?: string;
    }
) {
    const payload = await verifyJWT(params.refreshTokenJWT);
    if (payload?.type !== "refresh") {
        return { error: "invalid_grant", error_description: "Invalid or expired refresh token", status: 400 };
    }

    const tokenHash = await hashString(params.refreshTokenJWT);
    const existing = await getRefreshTokenByHashIncludingRevoked(db, tokenHash) as RefreshTokenRow | undefined;
    
    const decision = evaluateRefreshTokenForRotation(existing, Date.now());

    if (decision.kind === "reuse_detected") {
        await revokeRefreshTokenFamily(db, decision.familyId, "reuse_detected");
        await logAuditEvent(db, {
            id: generateUUID(),
            userId: existing?.user_id,
            eventType: "refresh_token_reuse_detected",
            provider: params.clientId,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            status: "failure",
            errorMessage: "Refresh token reuse detected. Entire session revoked."
        }).catch(() => {});
        return { error: "invalid_grant", error_description: "Token reuse detected. Session revoked.", status: 400 };
    }

    if (decision.kind === "not_found_or_expired") {
        return { error: "invalid_grant", error_description: "Refresh token not found, expired, or revoked", status: 400 };
    }

    if (existing?.client_id && existing.client_id !== params.clientId) {
        return { error: "invalid_client", error_description: "Client ID does not match token", status: 401 };
    }

    const user = await getUserById(db, payload.sub) as any;
    if (!user) {
        return { error: "invalid_grant", error_description: "User not found", status: 400 };
    }

    const scopes = payload.scopes || ["openid", "profile", "email"];
    const familyId = existing?.family_id || existing?.sid || generateUUID(); 
    const sid = existing?.sid || familyId;

    const oauthClaims = {
        clientId: params.clientId,
        audience: params.clientAudience,
        sid: sid
    };

    const newAccessToken = await createAccessToken(
        payload.sub,
        user.email,
        payload.provider,
        parseInt(process.env.JWT_EXPIRATION_MINUTES || "15", 10),
        scopes,
        oauthClaims
    );

    const newRefreshToken = await createRefreshToken(
        payload.sub,
        payload.provider,
        parseInt(process.env.REFRESH_TOKEN_EXPIRATION_DAYS || "30", 10),
        scopes,
        oauthClaims
    );
    
    const newRefreshTokenHash = await hashString(newRefreshToken);
    const newId = generateUUID();

    await revokeRefreshToken(db, tokenHash, "rotated");
    
    const ipHash = params.ipAddress ? await hashIpForSession(params.ipAddress) : null;
    const uaShort = params.userAgent ? shortUaForSession(params.userAgent) : null;

    await storeRefreshToken(db, {
        id: newId,
        userId: payload.sub,
        tokenHash: newRefreshTokenHash,
        clientId: params.clientId,
        expiresAt: new Date(Date.now() + parseInt(process.env.REFRESH_TOKEN_EXPIRATION_DAYS || "30", 10) * 24 * 60 * 60 * 1000),
        ipHash,
        uaShort,
        familyId,
        parentTokenHash: tokenHash,
        sid
    });

    return {
        success: true,
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: "Bearer",
        expires_in: parseInt(process.env.JWT_EXPIRATION_MINUTES || "15", 10) * 60,
        scope: scopes.join(" ")
    };
}
