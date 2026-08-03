export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";

/**
 * GET /.well-known/oauth-authorization-server
 *
 * RFC 8414 discovery document. CLI clients (LixBlogs) fetch this once at
 * startup to locate endpoints and to fail fast with an actionable
 * compatibility error if `device_authorization_endpoint` or the device
 * grant type is missing, rather than guessing URLs.
 */
export async function GET(request: NextRequest) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    return NextResponse.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/api/auth/token`,
        device_authorization_endpoint: `${baseUrl}/api/auth/device`,
        userinfo_endpoint: `${baseUrl}/api/auth/me`,
        revocation_endpoint: `${baseUrl}/api/auth/logout`,
        grant_types_supported: [
            "authorization_code",
            "refresh_token",
            "urn:ietf:params:oauth:grant-type:device_code",
        ],
        response_types_supported: ["code"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
        scopes_supported: [
            "openid",
            "profile",
            "email",
            "profile:read",
            "profile:write",
            "blog:read",
            "blog:write",
            "blog:publish",
            "blog:delete",
            "media:read",
            "media:write",
            "org:read",
            "org:write",
            "collab:read",
            "collab:write",
            "analytics:read",
            "notifications:read",
            "account:delete",
        ],
        // Contract version — CLI clients should compare this and fail
        // with an actionable "please upgrade the CLI" error rather than
        // guessing at unsupported fields.
        elixpo_device_flow_contract_version: "1.0.0",
    });
}
