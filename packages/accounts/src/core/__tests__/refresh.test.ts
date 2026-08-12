import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDiscoveryCache } from "../discovery";
import { AccountsError } from "../errors";
import {
    exchangeCodeForTokens,
    refreshTokens,
    revokeToken,
    TokenRefreshError,
    type TokenResponse,
    TokenRevocationError,
} from "../refresh";
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
    revocation_endpoint: `${ISSUER}/api/auth/revoke`,
    response_types_supported: ["code"],
    id_token_signing_alg_values_supported: ["RS256"],
};

const VALID_TOKEN_RESPONSE: TokenResponse = {
    access_token: "access-abc",
    refresh_token: "refresh-xyz",
    id_token: "id-token-value",
    token_type: "Bearer",
    expires_in: 900,
};

type RouteHandler = () => {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
};

/** Routes fetch calls by exact URL match; throws if an unexpected URL is hit. */
function mockFetchRouter(routes: Record<string, RouteHandler>) {
    return vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        const handler = routes[url];
        if (!handler) {
            throw new Error(`Unexpected fetch to unmocked URL: ${url}`);
        }
        return handler() as unknown as Response;
    });
}

function jsonRoute(body: unknown, ok = true, status = 200): RouteHandler {
    return () => ({ ok, status, json: async () => body });
}

function discoveryRoute(): RouteHandler {
    return jsonRoute(DISCOVERY_DOC);
}

describe("exchangeCodeForTokens", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        clearDiscoveryCache();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("throws AccountsError when redirectUri is missing", async () => {
        const config = { ...VALID_CONFIG, redirectUri: undefined };
        await expect(
            exchangeCodeForTokens(config, {
                code: "auth-code",
                codeVerifier: "verifier",
            }),
        ).rejects.toThrow(AccountsError);
    });

    it("posts the correct grant_type and PKCE fields, returns the token response", async () => {
        const fetchMock = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]: discoveryRoute(),
            [`${ISSUER}/api/auth/token`]: jsonRoute(VALID_TOKEN_RESPONSE),
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await exchangeCodeForTokens(VALID_CONFIG, {
            code: "auth-code-123",
            codeVerifier: "verifier-abc",
        });

        expect(result).toEqual(VALID_TOKEN_RESPONSE);

        const tokenCall = fetchMock.mock.calls.find(
            ([url]) => url === `${ISSUER}/api/auth/token`,
        );
        expect(tokenCall).toBeDefined();
        const [, init] = tokenCall as [string, RequestInit];
        const body = init.body as URLSearchParams;
        expect(body.get("grant_type")).toBe("authorization_code");
        expect(body.get("code")).toBe("auth-code-123");
        expect(body.get("code_verifier")).toBe("verifier-abc");
        expect(body.get("redirect_uri")).toBe(VALID_CONFIG.redirectUri);
        expect(body.get("client_id")).toBe(VALID_CONFIG.clientId);
        expect(body.has("client_secret")).toBe(false);
    });

    it("includes client_secret in the body when provided", async () => {
        const fetchMock = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]: discoveryRoute(),
            [`${ISSUER}/api/auth/token`]: jsonRoute(VALID_TOKEN_RESPONSE),
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await exchangeCodeForTokens(VALID_CONFIG, {
            code: "auth-code-123",
            codeVerifier: "verifier-abc",
            clientSecret: "shh-its-a-secret",
        });

        const tokenCall = fetchMock.mock.calls.find(
            ([url]) => url === `${ISSUER}/api/auth/token`,
        );
        const [, init] = tokenCall as [string, RequestInit];
        const body = init.body as URLSearchParams;
        expect(body.get("client_secret")).toBe("shh-its-a-secret");
    });

    it("throws TokenRefreshError with the OAuth error code on a non-ok response", async () => {
        global.fetch = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]: discoveryRoute(),
            [`${ISSUER}/api/auth/token`]: jsonRoute(
                {
                    error: "invalid_grant",
                    error_description: "code expired or already used",
                },
                false,
                400,
            ),
        }) as unknown as typeof fetch;

        await expect(
            exchangeCodeForTokens(VALID_CONFIG, {
                code: "stale-code",
                codeVerifier: "verifier",
            }),
        ).rejects.toThrow(TokenRefreshError);

        try {
            await exchangeCodeForTokens(VALID_CONFIG, {
                code: "stale-code",
                codeVerifier: "verifier",
            });
        } catch (err) {
            expect((err as Error).message).toContain("invalid_grant");
        }
    });

    it("throws TokenRefreshError when the token endpoint is unreachable", async () => {
        global.fetch = vi.fn((input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();
            if (url === `${ISSUER}/.well-known/openid-configuration`) {
                return Promise.resolve(
                    discoveryRoute()() as unknown as Response,
                );
            }
            return Promise.reject(new Error("network down"));
        }) as unknown as typeof fetch;

        await expect(
            exchangeCodeForTokens(VALID_CONFIG, {
                code: "auth-code",
                codeVerifier: "verifier",
            }),
        ).rejects.toThrow(TokenRefreshError);
    });

    it("throws TokenRefreshError when the token endpoint returns non-JSON", async () => {
        global.fetch = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]: discoveryRoute(),
            [`${ISSUER}/api/auth/token`]: () => ({
                ok: true,
                status: 200,
                json: async () => {
                    throw new Error("not json");
                },
            }),
        }) as unknown as typeof fetch;

        await expect(
            exchangeCodeForTokens(VALID_CONFIG, {
                code: "auth-code",
                codeVerifier: "verifier",
            }),
        ).rejects.toThrow(TokenRefreshError);
    });
});

describe("refreshTokens", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        clearDiscoveryCache();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("posts grant_type=refresh_token with the given refresh token", async () => {
        const fetchMock = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]: discoveryRoute(),
            [`${ISSUER}/api/auth/token`]: jsonRoute(VALID_TOKEN_RESPONSE),
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await refreshTokens(VALID_CONFIG, "old-refresh-token");
        expect(result.refresh_token).toBe(VALID_TOKEN_RESPONSE.refresh_token);

        const tokenCall = fetchMock.mock.calls.find(
            ([url]) => url === `${ISSUER}/api/auth/token`,
        );
        const [, init] = tokenCall as [string, RequestInit];
        const body = init.body as URLSearchParams;
        expect(body.get("grant_type")).toBe("refresh_token");
        expect(body.get("refresh_token")).toBe("old-refresh-token");
    });

    it("sends the refresh token exactly once in the request body", async () => {
        const fetchMock = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]: discoveryRoute(),
            [`${ISSUER}/api/auth/token`]: jsonRoute(VALID_TOKEN_RESPONSE),
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await refreshTokens(VALID_CONFIG, "single-use-token");

        const tokenCall = fetchMock.mock.calls.find(
            ([url]) => url === `${ISSUER}/api/auth/token`,
        );
        const [, init] = tokenCall as [string, RequestInit];
        const body = init.body as URLSearchParams;
        expect(body.getAll("refresh_token")).toEqual(["single-use-token"]);
    });

    it("throws TokenRefreshError and does not leak the refresh token on failure", async () => {
        global.fetch = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]: discoveryRoute(),
            [`${ISSUER}/api/auth/token`]: jsonRoute(
                { error: "invalid_grant" },
                false,
                400,
            ),
        }) as unknown as typeof fetch;

        const secretToken = "super-secret-refresh-value";
        try {
            await refreshTokens(VALID_CONFIG, secretToken);
            throw new Error("expected refreshTokens to throw");
        } catch (err) {
            expect(err).toBeInstanceOf(TokenRefreshError);
            expect((err as Error).message).not.toContain(secretToken);
        }
    });
});

describe("revokeToken", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        clearDiscoveryCache();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("throws TokenRevocationError when the provider has no revocation_endpoint", async () => {
        const docWithoutRevocation = {
            ...DISCOVERY_DOC,
            revocation_endpoint: undefined,
        };
        global.fetch = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]:
                jsonRoute(docWithoutRevocation),
        }) as unknown as typeof fetch;

        await expect(revokeToken(VALID_CONFIG, "some-token")).rejects.toThrow(
            TokenRevocationError,
        );
    });

    it("resolves on a 200 response and includes token_type_hint when given", async () => {
        const fetchMock = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]: discoveryRoute(),
            [`${ISSUER}/api/auth/revoke`]: jsonRoute({}),
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(
            revokeToken(VALID_CONFIG, "token-to-revoke", "refresh_token"),
        ).resolves.toBeUndefined();

        const revokeCall = fetchMock.mock.calls.find(
            ([url]) => url === `${ISSUER}/api/auth/revoke`,
        );
        const [, init] = revokeCall as [string, RequestInit];
        const body = init.body as URLSearchParams;
        expect(body.get("token")).toBe("token-to-revoke");
        expect(body.get("token_type_hint")).toBe("refresh_token");
    });

    it("throws TokenRevocationError on a non-ok response", async () => {
        global.fetch = mockFetchRouter({
            [`${ISSUER}/.well-known/openid-configuration`]: discoveryRoute(),
            [`${ISSUER}/api/auth/revoke`]: jsonRoute({}, false, 503),
        }) as unknown as typeof fetch;

        await expect(revokeToken(VALID_CONFIG, "some-token")).rejects.toThrow(
            TokenRevocationError,
        );
    });

    it("throws TokenRevocationError when the revocation endpoint is unreachable", async () => {
        global.fetch = vi.fn((input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();
            if (url === `${ISSUER}/.well-known/openid-configuration`) {
                return Promise.resolve(
                    discoveryRoute()() as unknown as Response,
                );
            }
            return Promise.reject(new Error("network down"));
        }) as unknown as typeof fetch;

        await expect(revokeToken(VALID_CONFIG, "some-token")).rejects.toThrow(
            TokenRevocationError,
        );
    });
});
