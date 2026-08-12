import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuthorizationUrl } from "../authorize";
import { clearDiscoveryCache } from "../discovery";
import { ConfigError } from "../errors";
import type { AccountsConfig, OIDCConfiguration } from "../types";

const ISSUER = "https://accounts.elixpo.com";

const VALID_CONFIG: AccountsConfig = {
    issuer: ISSUER,
    clientId: "test-client-id",
    redirectUri: "https://app.example.com/callback",
};

const DISCOVERY_DOC: OIDCConfiguration = {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/api/auth/token`,
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    id_token_signing_alg_values_supported: ["RS256"],
};

function mockDiscoveryFetch() {
    return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => DISCOVERY_DOC,
    });
}

describe("buildAuthorizationUrl", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        clearDiscoveryCache();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("throws ConfigError when redirectUri is missing", async () => {
        const config = { ...VALID_CONFIG, redirectUri: undefined };
        await expect(buildAuthorizationUrl(config)).rejects.toThrow(
            ConfigError,
        );
    });

    it("builds a URL with PKCE, state, and nonce, all mutually consistent with the returned fields", async () => {
        global.fetch = mockDiscoveryFetch() as unknown as typeof fetch;

        const result = await buildAuthorizationUrl(VALID_CONFIG);
        const url = new URL(result.url);

        expect(url.origin + url.pathname).toBe(
            DISCOVERY_DOC.authorization_endpoint,
        );
        expect(url.searchParams.get("response_type")).toBe("code");
        expect(url.searchParams.get("client_id")).toBe(VALID_CONFIG.clientId);
        expect(url.searchParams.get("redirect_uri")).toBe(
            VALID_CONFIG.redirectUri,
        );
        expect(url.searchParams.get("code_challenge_method")).toBe("S256");
        expect(url.searchParams.get("state")).toBe(result.state);
        expect(url.searchParams.get("nonce")).toBe(result.nonce);
        expect(url.searchParams.get("code_challenge")).toBeTruthy();
        expect(result.codeVerifier).toBeTruthy();
    });

    it("defaults scope to openid profile when not specified anywhere", async () => {
        global.fetch = mockDiscoveryFetch() as unknown as typeof fetch;

        const result = await buildAuthorizationUrl(VALID_CONFIG);
        const url = new URL(result.url);
        expect(url.searchParams.get("scope")).toBe("openid profile");
    });

    it("uses config.scopes when set", async () => {
        global.fetch = mockDiscoveryFetch() as unknown as typeof fetch;

        const config = {
            ...VALID_CONFIG,
            scopes: ["openid", "email", "custom:scope"],
        };
        const result = await buildAuthorizationUrl(config);
        const url = new URL(result.url);
        expect(url.searchParams.get("scope")).toBe("openid email custom:scope");
    });

    it("options.scopes overrides config.scopes for a single call", async () => {
        global.fetch = mockDiscoveryFetch() as unknown as typeof fetch;

        const config = { ...VALID_CONFIG, scopes: ["openid", "profile"] };
        const result = await buildAuthorizationUrl(config, {
            scopes: ["openid", "org:admin"],
        });
        const url = new URL(result.url);
        expect(url.searchParams.get("scope")).toBe("openid org:admin");
    });

    it("merges extraParams into the query string", async () => {
        global.fetch = mockDiscoveryFetch() as unknown as typeof fetch;

        const result = await buildAuthorizationUrl(VALID_CONFIG, {
            extraParams: { prompt: "consent", login_hint: "user@example.com" },
        });
        const url = new URL(result.url);
        expect(url.searchParams.get("prompt")).toBe("consent");
        expect(url.searchParams.get("login_hint")).toBe("user@example.com");
    });

    it("generates a different state, nonce, and codeVerifier on every call", async () => {
        global.fetch = mockDiscoveryFetch() as unknown as typeof fetch;

        const first = await buildAuthorizationUrl(VALID_CONFIG);
        const second = await buildAuthorizationUrl(VALID_CONFIG);

        expect(first.state).not.toBe(second.state);
        expect(first.nonce).not.toBe(second.nonce);
        expect(first.codeVerifier).not.toBe(second.codeVerifier);
    });
});
