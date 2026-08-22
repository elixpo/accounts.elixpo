import { discover } from "./discovery";
import { ConfigError } from "./errors";
import { createPKCEPair, type PKCEPair } from "./pkce";
import { generateNonce, generateState } from "./state";
import type { AccountsConfig } from "./types";

export interface AuthorizationRequest {
    /** The URL to redirect the user's browser to. */
    url: string;
    /** Must be persisted (e.g. in an encrypted cookie) and compared against the callback. */
    state: string;
    /** Must be persisted and compared against the ID token's nonce claim. */
    nonce: string;
    /** Must be persisted and sent in the token exchange request. */
    codeVerifier: string;
}

export interface BuildAuthorizationUrlOptions {
    /** Overrides config.scopes for this specific request. */
    scopes?: string[];
    /** Additional provider-specific query params (e.g. prompt, login_hint). */
    extraParams?: Record<string, string>;
}

/**
 * Builds a complete authorization request: discovers the provider, generates
 * PKCE/state/nonce, and returns the URL to redirect to plus the values the
 * caller must persist for the callback step.
 *
 * PKCE is always applied — there is no non-PKCE code path, per the SDK's
 * security requirement that PKCE is mandatory for public/browser clients.
 */
export async function buildAuthorizationUrl(
    config: AccountsConfig,
    options: BuildAuthorizationUrlOptions = {},
): Promise<AuthorizationRequest> {
    if (!config.redirectUri) {
        throw new ConfigError(
            "AccountsConfig.redirectUri is required to build an authorization URL",
        );
    }

    const discovery = await discover(config);
    const pkce: PKCEPair = await createPKCEPair();
    const state = generateState();
    const nonce = generateNonce();
    const scopes = options.scopes ?? config.scopes ?? ["openid", "profile"];

    const params = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: scopes.join(" "),
        state,
        nonce,
        code_challenge: pkce.codeChallenge,
        code_challenge_method: pkce.codeChallengeMethod,
        ...options.extraParams,
    });

    return {
        url: `${discovery.authorization_endpoint}?${params.toString()}`,
        state,
        nonce,
        codeVerifier: pkce.codeVerifier,
    };
}
