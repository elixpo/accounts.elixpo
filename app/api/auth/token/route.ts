export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/d1-client";
import {
    getOAuthClientByIdWithSecret,
    getRefreshTokenByHash,
    getUserById,
    revokeRefreshToken,
    createRefreshToken as storeRefreshToken,
    validateOAuthClient,
} from "@/lib/db";
import { createAccessToken, createRefreshToken, verifyJWT } from "@/lib/jwt";
import { parseOAuthScopes } from "@/lib/oauth-scopes";
import { generateUUID, hashString } from "@/lib/webcrypto";

import { getOAuthClientById } from "@/lib/db";
    import {
        getDeviceAuthorizationByDeviceCode,
        consumeDeviceAuthorization,
        registerPollAndCheckRate,
    } from "@/lib/device-flow";

export async function POST(request: NextRequest) {
    try {
        const body: any = await request.json();
        const {
            grant_type,
            code,
            client_id,
            client_secret,
            redirect_uri,
            refresh_token,
            scope,
            device_code
        } = body;

        if (!grant_type) {
            return NextResponse.json(
                {
                    error: "invalid_request",
                    error_description: "grant_type is required",
                },
                { status: 400 },
            );
        }

        // Authorization Code Flow (RFC 6749 Section 4.1)
        if (grant_type === "authorization_code") {
            if (!code || !client_id || !client_secret || !redirect_uri) {
                return NextResponse.json(
                    {
                        error: "invalid_request",
                        error_description:
                            "Missing required parameters: code, client_id, client_secret, redirect_uri",
                    },
                    { status: 400 },
                );
            }

            const db = await getDatabase();

            try {
                // 1. Fetch OAuth client and verify secret
                const client = await getOAuthClientByIdWithSecret(
                    db,
                    client_id,
                );
                if (!client) {
                    return NextResponse.json(
                        {
                            error: "invalid_client",
                            error_description: "Client not found",
                        },
                        { status: 401 },
                    );
                }

                // 2. Verify client_secret
                const clientSecretHash = await hashString(client_secret);
                const isValidSecret = await validateOAuthClient(
                    db,
                    client_id,
                    clientSecretHash,
                );
                if (!isValidSecret) {
                    return NextResponse.json(
                        {
                            error: "invalid_client",
                            error_description: "Invalid client credentials",
                        },
                        { status: 401 },
                    );
                }

                // 3. Verify redirect_uri matches
                const redirectUris = JSON.parse(
                    (client as any).redirect_uris || "[]",
                );
                if (!redirectUris.includes(redirect_uri)) {
                    return NextResponse.json(
                        {
                            error: "invalid_grant",
                            error_description: "redirect_uri does not match",
                        },
                        { status: 400 },
                    );
                }

                // 4. Look up auth request by code, get the user_id stored during authorization
                const authRequest = (await db
                    .prepare(
                        "SELECT * FROM auth_requests WHERE code = ? AND client_id = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP",
                    )
                    .bind(code, client_id)
                    .first()) as any;

                if (!authRequest) {
                    return NextResponse.json(
                        {
                            error: "invalid_grant",
                            error_description:
                                "Authorization code not found, expired, or already used",
                        },
                        { status: 400 },
                    );
                }

                // Validate redirect_uri matches what was stored
                if (authRequest.redirect_uri !== redirect_uri) {
                    return NextResponse.json(
                        {
                            error: "invalid_grant",
                            error_description:
                                "redirect_uri mismatch with authorization request",
                        },
                        { status: 400 },
                    );
                }

                // 5. Mark code as used (single-use)
                await db
                    .prepare("UPDATE auth_requests SET used = 1 WHERE code = ?")
                    .bind(code)
                    .run();

                // 6. Get the actual user from DB
                const userId = authRequest.user_id;
                if (!userId) {
                    return NextResponse.json(
                        {
                            error: "invalid_grant",
                            error_description:
                                "No user associated with this authorization code",
                        },
                        { status: 400 },
                    );
                }

                const user = (await getUserById(db, userId)) as any;
                if (!user) {
                    return NextResponse.json(
                        {
                            error: "invalid_grant",
                            error_description: "User not found",
                        },
                        { status: 400 },
                    );
                }

                // MAU counter — fire-and-forget. Counted once per
                // (client_id, user, calendar month). The helper itself
                // dedupes and swallows errors so we never block the
                // token grant on a counter blip.
                try {
                    const { recordMauHit } = await import("@/lib/mau");
                    await recordMauHit(db, client_id, userId);
                } catch {
                    /* best-effort */
                }

                const authorizedScopes = parseOAuthScopes(
                    authRequest.scopes || "openid profile email",
                );
                const scopes = scope
                    ? parseOAuthScopes(scope)
                    : authorizedScopes;
                if (
                    scopes.some(
                        (requestedScope) =>
                            !authorizedScopes.includes(requestedScope),
                    )
                ) {
                    return NextResponse.json(
                        {
                            error: "invalid_scope",
                            error_description:
                                "Requested scope exceeds the user's authorization grant",
                        },
                        { status: 400 },
                    );
                }
                const accessToken = await createAccessToken(
                    userId,
                    user.email,
                    "email",
                    parseInt(process.env.JWT_EXPIRATION_MINUTES || "15", 10),
                    scopes,
                );
                const refreshTokenJWT = await createRefreshToken(
                    userId,
                    "email",
                    parseInt(
                        process.env.REFRESH_TOKEN_EXPIRATION_DAYS || "30",
                        10,
                    ),
                    scopes,
                );

                // Store refresh token
                const refreshTokenHash = await hashString(refreshTokenJWT);
                await storeRefreshToken(db, {
                    id: generateUUID(),
                    userId,
                    tokenHash: refreshTokenHash,
                    clientId: client_id,
                    expiresAt: new Date(
                        Date.now() +
                            parseInt(
                                process.env.REFRESH_TOKEN_EXPIRATION_DAYS ||
                                    "30",
                                10,
                            ) *
                                24 *
                                60 *
                                60 *
                                1000,
                    ),
                });

                return NextResponse.json(
                    {
                        access_token: accessToken,
                        token_type: "Bearer",
                        expires_in:
                            parseInt(
                                process.env.JWT_EXPIRATION_MINUTES || "15",
                                10,
                            ) * 60,
                        refresh_token: refreshTokenJWT,
                        scope: scopes.join(" "),
                    },
                    { status: 200 },
                );
            } catch (error) {
                console.error("[Token] Authorization code flow error:", error);
                return NextResponse.json(
                    {
                        error: "server_error",
                        error_description: "Failed to process token request",
                    },
                    { status: 500 },
                );
            }
        }

        if (grant_type === "urn:ietf:params:oauth:grant-type:device_code") {
            if (!device_code || !client_id) {
                return NextResponse.json(
                    {
                        error: "invalid_request",
                        error_description: "Missing required parameters: device_code, client_id",
                    },
                    { status: 400 },
                );
            }

            const db = await getDatabase();

            try {
                const client = await getOAuthClientById(db, client_id);
                if (!client || !(client as any).is_active) {
                    return NextResponse.json(
                        { error: "invalid_client", error_description: "Client not found or not active" },
                        { status: 401 },
                    );
                }
                // Public clients never present (or need) a client_secret here —
                // this is the one branch of the token endpoint that must NOT
                // call validateOAuthClient()/check client_secret, by design.
                // client_secret is intentionally ignored even if a caller sends one.

                const row = await getDeviceAuthorizationByDeviceCode(db, device_code);
                if (!row) {
                    return NextResponse.json(
                        { error: "invalid_grant", error_description: "Unknown device_code" },
                        { status: 400 },
                    );
                }

                // Reject client substitution: the device_code must have been
                // issued to THIS client_id.
                if (row.client_id !== client_id) {
                    return NextResponse.json(
                        { error: "invalid_grant", error_description: "device_code was not issued to this client" },
                        { status: 400 },
                    );
                }

                if (new Date(row.expires_at).getTime() < Date.now()) {
                    return NextResponse.json(
                        { error: "expired_token", error_description: "device_code has expired" },
                        { status: 400 },
                    );
                }

                if (row.status === "denied") {
                    return NextResponse.json(
                        { error: "access_denied", error_description: "User denied the authorization request" },
                        { status: 400 },
                    );
                }

                if (row.status === "consumed") {
                    // Already minted once — reject the replay, don't mint again.
                    return NextResponse.json(
                        { error: "invalid_grant", error_description: "device_code has already been used" },
                        { status: 400 },
                    );
                }

                if (row.status === "pending") {
                    const { tooFast, newInterval } = await registerPollAndCheckRate(db, row);
                    if (tooFast) {
                        return NextResponse.json(
                            { error: "slow_down", error_description: `Polling too fast; wait ${newInterval}s` },
                            { status: 400 },
                        );
                    }
                    return NextResponse.json(
                        { error: "authorization_pending", error_description: "User has not yet approved this request" },
                        { status: 400 },
                    );
                }

                // status === "approved" — mint tokens exactly once. The atomic
                // approved -> consumed flip is the single-use guarantee: if two
                // poll requests race here, only one UPDATE affects a row, and the
                // loser falls through to invalid_grant below.
                const consumed = await consumeDeviceAuthorization(db, row.id);
                if (!consumed) {
                    return NextResponse.json(
                        { error: "invalid_grant", error_description: "device_code has already been used" },
                        { status: 400 },
                    );
                }

                const user = (await getUserById(db, row.user_id)) as any;
                if (!user) {
                    return NextResponse.json(
                        { error: "invalid_grant", error_description: "Authorizing user no longer exists" },
                        { status: 400 },
                    );
                }

                try {
                    const { recordMauHit } = await import("@/lib/mau");
                    await recordMauHit(db, client_id, row.user_id);
                } catch {
                    /* best-effort */
                }

                const accessToken = await createAccessToken(
                    row.user_id,
                    user.email,
                    "email",
                    parseInt(process.env.JWT_EXPIRATION_MINUTES || "15", 10),
                );
                const refreshTokenJWT = await createRefreshToken(row.user_id, "email");
                const refreshTokenHash = await hashString(refreshTokenJWT);

                await storeRefreshToken(db, {
                    id: generateUUID(),
                    userId: row.user_id,
                    tokenHash: refreshTokenHash,
                    clientId: client_id,
                    ipHash: row.ip_hash,
                    uaShort: row.ua_short,
                    expiresAt: new Date(
                        Date.now() +
                            parseInt(process.env.REFRESH_TOKEN_EXPIRATION_DAYS || "30", 10) *
                                24 * 60 * 60 * 1000,
                    ),
                });

                return NextResponse.json(
                    {
                        access_token: accessToken,
                        token_type: "Bearer",
                        expires_in: parseInt(process.env.JWT_EXPIRATION_MINUTES || "15", 10) * 60,
                        refresh_token: refreshTokenJWT,
                        scope: row.scopes,
                    },
                    { status: 200 },
                );
            } catch (error) {
                console.error("[Token] Device code flow error:", error);
                return NextResponse.json(
                    { error: "server_error", error_description: "Failed to process device token request" },
                    { status: 500 },
                );
            }
        }

        // Refresh Token Flow (RFC 6749 Section 6)
        if (grant_type === "refresh_token") {
            if (!refresh_token || !client_id) {
                return NextResponse.json(
                    {
                        error: "invalid_request",
                        error_description:
                            "Missing required parameters: refresh_token, client_id",
                    },
                    { status: 400 },
                );
            }

            const db = await getDatabase();

            try {
                const payload = await verifyJWT(refresh_token);
                if (payload?.type !== "refresh") {
                    return NextResponse.json(
                        {
                            error: "invalid_grant",
                            error_description:
                                "Invalid or expired refresh token",
                        },
                        { status: 400 },
                    );
                }

                const refreshTokenHash = await hashString(refresh_token);
                const tokenRecord = await getRefreshTokenByHash(
                    db,
                    refreshTokenHash,
                );
                if (!tokenRecord) {
                    return NextResponse.json(
                        {
                            error: "invalid_grant",
                            error_description:
                                "Refresh token not found or revoked",
                        },
                        { status: 400 },
                    );
                }

                if (
                    (tokenRecord as any).client_id &&
                    (tokenRecord as any).client_id !== client_id
                ) {
                    return NextResponse.json(
                        {
                            error: "invalid_client",
                            error_description: "Client ID does not match token",
                        },
                        { status: 401 },
                    );
                }

                // Get fresh user data
                const user = (await getUserById(db, payload.sub)) as any;
                const email = user ? user.email : payload.email;
                // Tokens issued before scope claims were introduced carried
                // the documented default grant. Preserve those sessions
                // during their normal refresh lifetime.
                const originalScopes = payload.scopes || [
                    "openid",
                    "profile",
                    "email",
                ];
                const scopes = scope ? parseOAuthScopes(scope) : originalScopes;
                if (
                    scopes.some(
                        (requestedScope) =>
                            !originalScopes.includes(requestedScope),
                    )
                ) {
                    return NextResponse.json(
                        {
                            error: "invalid_scope",
                            error_description:
                                "Requested scope exceeds the refresh token grant",
                        },
                        { status: 400 },
                    );
                }

                const newAccessToken = await createAccessToken(
                    payload.sub,
                    email,
                    payload.provider,
                    parseInt(process.env.JWT_EXPIRATION_MINUTES || "15", 10),
                    scopes,
                );

                const newRefreshToken = await createRefreshToken(
                    payload.sub,
                    payload.provider,
                    parseInt(
                        process.env.REFRESH_TOKEN_EXPIRATION_DAYS || "30",
                        10,
                    ),
                    scopes,
                );
                const newRefreshTokenHash = await hashString(newRefreshToken);

                try {
                    await revokeRefreshToken(db, refreshTokenHash);
                    await storeRefreshToken(db, {
                        id: generateUUID(),
                        userId: payload.sub,
                        tokenHash: newRefreshTokenHash,
                        clientId: client_id,
                        expiresAt: new Date(
                            Date.now() +
                                parseInt(
                                    process.env.REFRESH_TOKEN_EXPIRATION_DAYS ||
                                        "30",
                                    10,
                                ) *
                                    24 *
                                    60 *
                                    60 *
                                    1000,
                        ),
                    });
                } catch (storageError) {
                    console.error(
                        "[Token] Token rotation error:",
                        storageError,
                    );
                }

                return NextResponse.json(
                    {
                        access_token: newAccessToken,
                        refresh_token: newRefreshToken,
                        token_type: "Bearer",
                        expires_in:
                            parseInt(
                                process.env.JWT_EXPIRATION_MINUTES || "15",
                                10,
                            ) * 60,
                        scope: scopes.join(" "),
                    },
                    { status: 200 },
                );
            } catch (error) {
                console.error("[Token] Refresh token flow error:", error);
                return NextResponse.json(
                    {
                        error: "server_error",
                        error_description: "Failed to refresh token",
                    },
                    { status: 500 },
                );
            }
        }

        // Client Credentials Flow - not yet implemented
        if (grant_type === "client_credentials") {
            return NextResponse.json(
                {
                    error: "unsupported_grant_type",
                    error_description: "client_credentials not yet implemented",
                },
                { status: 501 },
            );
        }

        return NextResponse.json(
            {
                error: "unsupported_grant_type",
                error_description: `grant_type '${grant_type}' is not supported`,
            },
            { status: 400 },
        );
    } catch (error) {
        console.error("[Token Endpoint] Error:", error);
        return NextResponse.json(
            {
                error: "server_error",
                error_description: "Failed to process token request",
            },
            { status: 500 },
        );
    }
}
