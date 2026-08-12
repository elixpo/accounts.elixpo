/**
 * PKCE (RFC 7636) helpers. Web Crypto only — no Node built-ins, so this
 * works unmodified in browsers, Cloudflare Workers/edge, and Node 20+.
 */

const CODE_VERIFIER_LENGTH = 64; // bytes of entropy before base64url encoding

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/**
 * Generates a cryptographically random PKCE code verifier.
 * Per RFC 7636 §4.1, must be 43-128 characters from the unreserved URI set.
 * base64url-encoding CODE_VERIFIER_LENGTH random bytes satisfies this.
 */
export function generateCodeVerifier(): string {
    const bytes = new Uint8Array(CODE_VERIFIER_LENGTH);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

/**
 * Derives the S256 code challenge from a code verifier per RFC 7636 §4.2.
 * Plain "plain" method is intentionally not supported — S256 is mandatory
 * for public clients per the SDK's security requirements.
 */
export async function generateCodeChallenge(
    codeVerifier: string,
): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(new Uint8Array(digest));
}

export interface PKCEPair {
    codeVerifier: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
}

/** Generates a matched verifier/challenge pair in one call. */
export async function createPKCEPair(): Promise<PKCEPair> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    return { codeVerifier, codeChallenge, codeChallengeMethod: "S256" };
}
