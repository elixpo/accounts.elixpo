import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDiscoveryCache, discover } from "../discovery";
import { ConfigError, DiscoveryError } from "../errors";
import {
    createPKCEPair,
    generateCodeChallenge,
    generateCodeVerifier,
} from "../pkce";
import { generateNonce, generateState, validateStateOrNonce } from "../state";
import type { AccountsConfig, OIDCConfiguration } from "../types";

const VALID_CONFIG: AccountsConfig = {
    issuer: "https://accounts.elixpo.com",
    clientId: "test-client-id",
    redirectUri: "https://app.example.com/callback",
};

const VALID_DISCOVERY_DOC: OIDCConfiguration = {
    issuer: "https://accounts.elixpo.com",
    authorization_endpoint: "https://accounts.elixpo.com/oauth/authorize",
    token_endpoint: "https://accounts.elixpo.com/api/auth/token",
    jwks_uri: "https://accounts.elixpo.com/.well-known/jwks.json",
    response_types_supported: ["code"],
    id_token_signing_alg_values_supported: ["RS256"],
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
    return vi.fn().mockResolvedValue({
        ok,
        status,
        json: async () => body,
    });
}

describe("PKCE", () => {
    it("generates a code verifier of sufficient length and charset", () => {
        const verifier = generateCodeVerifier();
        expect(verifier.length).toBeGreaterThanOrEqual(43);
        expect(verifier.length).toBeLessThanOrEqual(128);
        expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it("generates different verifiers on each call", () => {
        const a = generateCodeVerifier();
        const b = generateCodeVerifier();
        expect(a).not.toBe(b);
    });

    it("derives a deterministic S256 challenge from a given verifier", async () => {
        const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        const challenge = await generateCodeChallenge(verifier);
        // Known-answer test vector from RFC 7636 Appendix B.
        expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    });

    it("createPKCEPair returns a matched, verifiable pair", async () => {
        const pair = await createPKCEPair();
        expect(pair.codeChallengeMethod).toBe("S256");
        const recomputed = await generateCodeChallenge(pair.codeVerifier);
        expect(recomputed).toBe(pair.codeChallenge);
    });
});

describe("state/nonce", () => {
    it("generates non-empty, distinct state and nonce values", () => {
        const state = generateState();
        const nonce = generateNonce();
        expect(state.length).toBeGreaterThan(0);
        expect(nonce.length).toBeGreaterThan(0);
        expect(state).not.toBe(nonce);
    });

    it("validateStateOrNonce accepts a matching value", () => {
        const state = generateState();
        expect(validateStateOrNonce(state, state)).toBe(true);
    });

    it("validateStateOrNonce rejects a non-matching value", () => {
        expect(validateStateOrNonce(generateState(), generateState())).toBe(
            false,
        );
    });

    it("validateStateOrNonce rejects null/undefined actual", () => {
        const state = generateState();
        expect(validateStateOrNonce(state, null)).toBe(false);
        expect(validateStateOrNonce(state, undefined)).toBe(false);
    });
});

describe("discovery", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        clearDiscoveryCache();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("throws ConfigError when issuer is missing", async () => {
        await expect(discover({ ...VALID_CONFIG, issuer: "" })).rejects.toThrow(
            ConfigError,
        );
    });

    it("throws ConfigError when clientId is missing", async () => {
        await expect(
            discover({ ...VALID_CONFIG, clientId: "" }),
        ).rejects.toThrow(ConfigError);
    });

    it("fetches and returns a valid discovery document", async () => {
        global.fetch = mockFetchOnce(
            VALID_DISCOVERY_DOC,
        ) as unknown as typeof fetch;
        const result = await discover(VALID_CONFIG);
        expect(result.token_endpoint).toBe(VALID_DISCOVERY_DOC.token_endpoint);
        expect(global.fetch).toHaveBeenCalledWith(
            "https://accounts.elixpo.com/.well-known/openid-configuration",
            expect.objectContaining({
                headers: { accept: "application/json" },
            }),
        );
    });

    it("caches the discovery document across repeated calls", async () => {
        const fetchMock = mockFetchOnce(VALID_DISCOVERY_DOC);
        global.fetch = fetchMock as unknown as typeof fetch;
        await discover(VALID_CONFIG);
        await discover(VALID_CONFIG);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws DiscoveryError on non-ok response", async () => {
        global.fetch = mockFetchOnce({}, false, 404) as unknown as typeof fetch;
        await expect(discover(VALID_CONFIG)).rejects.toThrow(DiscoveryError);
    });

    it("throws DiscoveryError when required fields are missing", async () => {
        global.fetch = mockFetchOnce({
            issuer: VALID_CONFIG.issuer,
        }) as unknown as typeof fetch;
        await expect(discover(VALID_CONFIG)).rejects.toThrow(DiscoveryError);
    });

    it("throws DiscoveryError when the document issuer does not match configured issuer", async () => {
        global.fetch = mockFetchOnce({
            ...VALID_DISCOVERY_DOC,
            issuer: "https://evil.example.com",
        }) as unknown as typeof fetch;
        await expect(discover(VALID_CONFIG)).rejects.toThrow(DiscoveryError);
    });

    it("does not cache a failed lookup, so a later retry can succeed", async () => {
        global.fetch = mockFetchOnce({}, false, 500) as unknown as typeof fetch;
        await expect(discover(VALID_CONFIG)).rejects.toThrow(DiscoveryError);

        global.fetch = mockFetchOnce(
            VALID_DISCOVERY_DOC,
        ) as unknown as typeof fetch;
        const result = await discover(VALID_CONFIG);
        expect(result.token_endpoint).toBe(VALID_DISCOVERY_DOC.token_endpoint);
    });
});
