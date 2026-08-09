export const runtime = "edge";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    // Construct the base issuer URL dynamically from the request
    const url = new URL(request.url);
    const issuer = `${url.protocol}//${url.host}`;

    // RFC 8414 OAuth 2.0 Authorization Server Metadata
    const metadata = {
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/api/auth/token`,
        device_authorization_endpoint: `${issuer}/api/auth/device/authorize`,
        revocation_endpoint: `${issuer}/api/auth/revoke`,
        
        // Supported features
        grant_types_supported: [
            "authorization_code",
            "refresh_token",
            "urn:ietf:params:oauth:grant-type:device_code"
        ],
        response_types_supported: ["code"],
        token_endpoint_auth_methods_supported: [
            "client_secret_post",
            "client_secret_basic",
            "none" // 'none' is required for public clients (like the CLI)
        ],
        revocation_endpoint_auth_methods_supported: [
            "client_secret_post",
            "client_secret_basic",
            "none"
        ],
        
        // Note: PKCE (code_challenge_methods_supported: ["S256"]) is intentionally 
        // omitted here as it is not yet implemented for authorization_code.

        // Proprietary LixBlogs CLI extensions
        elixpo_contract_version: "1.0.0",
        elixpo_min_compatible_cli_version: "0.1.0",
        elixpo_access_token_lifetime_seconds: parseInt(process.env.JWT_EXPIRATION_MINUTES || "15", 10) * 60,
        elixpo_refresh_token_lifetime_seconds: parseInt(process.env.REFRESH_TOKEN_EXPIRATION_DAYS || "30", 10) * 86400,
        elixpo_refresh_token_rotation: {
            policy: "rotate_always",
            reuse_action: "revoke_family"
        },
        elixpo_device_flow_polling: {
            interval_seconds: 5,
            max_attempts: 120, // 10 minutes at 5s intervals
            slow_down_interval_seconds: 10
        }
    };

    return NextResponse.json(metadata, {
        headers: {
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*"
        }
    });
}
