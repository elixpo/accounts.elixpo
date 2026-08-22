import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import { discover } from "./discovery";
import { AccountsError } from "./errors";
import type { AccountsConfig } from "./types";

export class TokenValidationError extends AccountsError {
    constructor(message: string) {
        super("invalid_token", message);
        this.name = "TokenValidationError";
    }
}

/**
 * ID token claims per OpenID Connect Core §2, plus the standard JWT claims.
 * Only fields the SDK relies on are typed — consumers needing custom claims
 * should treat the return value as a base to extend, not the full contract.
 */
export interface IDTokenClaims extends JWTPayload {
    sub: string;
    nonce?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
}

// One JWKS remote set per issuer, reused across verifications so we're not
// refetching /jwks on every request. jose handles its own internal caching
// and rotation-aware refetch on kid miss.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(jwksUri: string) {
    let jwks = jwksCache.get(jwksUri);
    if (!jwks) {
        jwks = createRemoteJWKSet(new URL(jwksUri));
        jwksCache.set(jwksUri, jwks);
    }
    return jwks;
}

/**
 * Verifies an ID token's signature, issuer, audience, and expiry against the
 * discovered provider configuration. Algorithm is constrained to whatever
 * the provider's discovery document advertises — this SDK never trusts an
 * algorithm the provider itself didn't declare as supported, which rules out
 * algorithm-confusion attacks (e.g. a token claiming "alg: none" or HS256
 * signed with a public RSA key value).
 *
 * Does NOT validate the nonce — nonce comparison requires the value stored
 * client-side at authorization time, which this function has no access to.
 * Callers must separately call validateStateOrNonce() against the returned
 * claims.nonce.
 */
export async function verifyIdToken(
    config: AccountsConfig,
    idToken: string,
): Promise<IDTokenClaims> {
    const discovery = await discover(config);
    const jwks = getJWKS(discovery.jwks_uri);

    try {
        const { payload } = await jwtVerify(idToken, jwks, {
            issuer: discovery.issuer,
            audience: config.clientId,
            algorithms: discovery.id_token_signing_alg_values_supported,
        });
        return payload as IDTokenClaims;
    } catch (err) {
        // jose errors carry their own descriptive messages (e.g. "exp claim timestamp
        // check failed") that are safe to surface — they describe the validation
        // failure, not any secret material. We still don't forward the raw error
        // object, since it may embed the offending token in some jose versions.
        const reason =
            err instanceof Error ? err.message : "unknown validation failure";
        throw new TokenValidationError(
            `ID token verification failed: ${reason}`,
        );
    }
}

/**
 * Verifies an access token issued by Elixpo Accounts. Structurally identical
 * to ID token verification (same issuer/JWKS), but does not assume OIDC
 * standard claims beyond sub/exp/iss/aud — access tokens are opaque-ish by
 * OAuth spec and their claim shape is provider-defined.
 */
export async function verifyAccessToken(
    config: AccountsConfig,
    accessToken: string,
): Promise<JWTPayload> {
    const discovery = await discover(config);
    const jwks = getJWKS(discovery.jwks_uri);

    try {
        const { payload } = await jwtVerify(accessToken, jwks, {
            issuer: discovery.issuer,
            algorithms: discovery.id_token_signing_alg_values_supported,
        });
        return payload;
    } catch (err) {
        const reason =
            err instanceof Error ? err.message : "unknown validation failure";
        throw new TokenValidationError(
            `Access token verification failed: ${reason}`,
        );
    }
}
