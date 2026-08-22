/**
 * Configuration a consuming app provides to talk to Elixpo Accounts.
 * `issuer` is the only required field — everything else is discovered
 * or defaulted.
 */
export interface AccountsConfig {
    /** e.g. "https://accounts.elixpo.com" — no trailing slash. */
    issuer: string;
    /** OAuth client_id registered in the Accounts dashboard. */
    clientId: string;
    /** Redirect URI registered for this client. Required for auth code flow. */
    redirectUri?: string;
    /** Scopes to request. Defaults to ["openid", "profile"]. */
    scopes?: string[];
}

/**
 * Subset of the OIDC discovery document (RFC 8414 / OpenID Connect Discovery)
 * that @elixpo/accounts actually uses. We don't type the full spec —
 * only fields core relies on.
 */
export interface OIDCConfiguration {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
    userinfo_endpoint?: string;
    revocation_endpoint?: string;
    end_session_endpoint?: string;
    response_types_supported: string[];
    code_challenge_methods_supported?: string[];
    id_token_signing_alg_values_supported: string[];
}

const REQUIRED_DISCOVERY_FIELDS = [
    "issuer",
    "authorization_endpoint",
    "token_endpoint",
    "jwks_uri",
    "response_types_supported",
    "id_token_signing_alg_values_supported",
] as const;

export function isOIDCConfiguration(
    value: unknown,
): value is OIDCConfiguration {
    if (typeof value !== "object" || value === null) return false;
    const record = value as Record<string, unknown>;
    return REQUIRED_DISCOVERY_FIELDS.every((field) => field in record);
}
