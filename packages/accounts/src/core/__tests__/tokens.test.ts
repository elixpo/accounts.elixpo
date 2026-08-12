import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearDiscoveryCache } from "../discovery";
import { AccountsError } from "../errors";
import {
    TokenValidationError,
    verifyAccessToken,
    verifyIdToken,
} from "../tokens";
import type { AccountsConfig, OIDCConfiguration } from "../types";

async function makeKeyPair(kid: string) {
    const { publicKey, privateKey } = await generateKeyPair("RS256", {
        extractable: true,
    });
    const jwk = await exportJWK(publicKey);
    jwk.kid = kid;
    jwk.alg = "RS256";
    jwk.use = "sig";
    return { privateKey, jwk };
}

function discoveryDocFor(issuer: string): OIDCConfiguration {
    return {
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/api/auth/token`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
        response_types_supported: ["code"],
        id_token_signing_alg_values_supported: ["RS256"],
    };
}

async function startIssuerServer(
    jwk: object,
): Promise<{ issuer: string; close: () => Promise<void> }> {
    let issuer = "";
    const server: Server = createServer((req, res) => {
        res.setHeader("content-type", "application/json");
        if (req.url === "/.well-known/openid-configuration") {
            res.end(JSON.stringify(discoveryDocFor(issuer)));
            return;
        }
        if (req.url === "/.well-known/jwks.json") {
            res.end(JSON.stringify({ keys: [jwk] }));
            return;
        }
        res.statusCode = 404;
        res.end("{}");
    });

    await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    issuer = `http://127.0.0.1:${port}`;

    return {
        issuer,
        close: () =>
            new Promise<void>((resolve) => server.close(() => resolve())),
    };
}

function baseConfig(issuer: string): AccountsConfig {
    return {
        issuer,
        clientId: "test-client-id",
        redirectUri: "https://app.example.com/callback",
    };
}

function b64url(input: object | string): string {
    const str = typeof input === "string" ? input : JSON.stringify(input);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("tokens", () => {
    let closeServer: (() => Promise<void>) | null = null;

    beforeEach(() => {
        clearDiscoveryCache();
    });

    afterEach(async () => {
        if (closeServer) {
            await closeServer();
            closeServer = null;
        }
    });

    it("verifies a valid ID token and returns its claims", async () => {
        const { privateKey, jwk } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const idToken = await new SignJWT({
            nonce: "abc123",
            email: "user@example.com",
        })
            .setProtectedHeader({ alg: "RS256", kid: "key-1" })
            .setIssuer(issuer)
            .setAudience("test-client-id")
            .setSubject("user-123")
            .setIssuedAt()
            .setExpirationTime("5m")
            .sign(privateKey);

        const claims = await verifyIdToken(baseConfig(issuer), idToken);
        expect(claims.sub).toBe("user-123");
        expect(claims.nonce).toBe("abc123");
    });

    it("rejects a token with the wrong issuer claim", async () => {
        const { privateKey, jwk } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const idToken = await new SignJWT({})
            .setProtectedHeader({ alg: "RS256", kid: "key-1" })
            .setIssuer("https://attacker.example.com")
            .setAudience("test-client-id")
            .setSubject("user-123")
            .setExpirationTime("5m")
            .sign(privateKey);

        await expect(
            verifyIdToken(baseConfig(issuer), idToken),
        ).rejects.toThrow(TokenValidationError);
    });

    it("rejects a token with the wrong audience claim", async () => {
        const { privateKey, jwk } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const idToken = await new SignJWT({})
            .setProtectedHeader({ alg: "RS256", kid: "key-1" })
            .setIssuer(issuer)
            .setAudience("some-other-client")
            .setSubject("user-123")
            .setExpirationTime("5m")
            .sign(privateKey);

        await expect(
            verifyIdToken(baseConfig(issuer), idToken),
        ).rejects.toThrow(TokenValidationError);
    });

    it("rejects an expired token", async () => {
        const { privateKey, jwk } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const idToken = await new SignJWT({})
            .setProtectedHeader({ alg: "RS256", kid: "key-1" })
            .setIssuer(issuer)
            .setAudience("test-client-id")
            .setSubject("user-123")
            .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
            .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
            .sign(privateKey);

        await expect(
            verifyIdToken(baseConfig(issuer), idToken),
        ).rejects.toThrow(TokenValidationError);
    });

    it("rejects a token signed with an unrelated key claiming a known kid", async () => {
        const { jwk } = await makeKeyPair("key-1");
        const { privateKey: attackerKey } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const forgedToken = await new SignJWT({})
            .setProtectedHeader({ alg: "RS256", kid: "key-1" })
            .setIssuer(issuer)
            .setAudience("test-client-id")
            .setSubject("attacker")
            .setExpirationTime("5m")
            .sign(attackerKey);

        await expect(
            verifyIdToken(baseConfig(issuer), forgedToken),
        ).rejects.toThrow(TokenValidationError);
    });

    it("rejects a token referencing an unknown kid", async () => {
        const { privateKey, jwk } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const idToken = await new SignJWT({})
            .setProtectedHeader({ alg: "RS256", kid: "does-not-exist" })
            .setIssuer(issuer)
            .setAudience("test-client-id")
            .setSubject("user-123")
            .setExpirationTime("5m")
            .sign(privateKey);

        await expect(
            verifyIdToken(baseConfig(issuer), idToken),
        ).rejects.toThrow(TokenValidationError);
    });

    it("rejects an unsigned token with alg=none", async () => {
        const { jwk } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const header = b64url({ alg: "none", typ: "JWT" });
        const payload = b64url({
            iss: issuer,
            aud: "test-client-id",
            sub: "user-123",
            exp: Math.floor(Date.now() / 1000) + 300,
        });
        const forgedToken = `${header}.${payload}.`;

        await expect(
            verifyIdToken(baseConfig(issuer), forgedToken),
        ).rejects.toThrow(TokenValidationError);
    });

    it("does not leak the raw token string in the thrown error message", async () => {
        const { jwk } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const bogusToken = "not-a-real-jwt-but-a-secret-looking-value.xyz789";

        try {
            await verifyIdToken(baseConfig(issuer), bogusToken);
            throw new Error("expected verifyIdToken to throw");
        } catch (err) {
            expect(err).toBeInstanceOf(TokenValidationError);
            expect(err).toBeInstanceOf(AccountsError);
            const message = (err as Error).message;
            expect(message).not.toContain(bogusToken);
        }
    });

    it("verifyAccessToken accepts a valid access token", async () => {
        const { privateKey, jwk } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const accessToken = await new SignJWT({ scope: "openid profile" })
            .setProtectedHeader({ alg: "RS256", kid: "key-1" })
            .setIssuer(issuer)
            .setSubject("user-123")
            .setExpirationTime("5m")
            .sign(privateKey);

        const claims = await verifyAccessToken(baseConfig(issuer), accessToken);
        expect(claims.sub).toBe("user-123");
    });

    it("verifyAccessToken rejects an expired access token", async () => {
        const { privateKey, jwk } = await makeKeyPair("key-1");
        const { issuer, close } = await startIssuerServer(jwk);
        closeServer = close;

        const accessToken = await new SignJWT({})
            .setProtectedHeader({ alg: "RS256", kid: "key-1" })
            .setIssuer(issuer)
            .setSubject("user-123")
            .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
            .sign(privateKey);

        await expect(
            verifyAccessToken(baseConfig(issuer), accessToken),
        ).rejects.toThrow(TokenValidationError);
    });
});
