/**
 * State and nonce generation/validation. Both are opaque random tokens
 * echoed through the OAuth/OIDC flow to prevent CSRF (state) and replay (nonce).
 */

const TOKEN_BYTES = 32;

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

/** Generates a cryptographically random state parameter. */
export function generateState(): string {
    const bytes = new Uint8Array(TOKEN_BYTES);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

/** Generates a cryptographically random nonce parameter. */
export function generateNonce(): string {
    const bytes = new Uint8Array(TOKEN_BYTES);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

/**
 * Constant-time string comparison to prevent timing attacks when validating
 * state/nonce against a stored value.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/**
 * Validates that the state/nonce returned from the provider matches the one
 * stored at the start of the flow. Throws is intentionally left to the caller —
 * this returns a boolean so callers can choose their own error type/messaging
 * (e.g. nextjs may want a redirect-to-error-page vs. server throwing).
 */
export function validateStateOrNonce(
    expected: string,
    actual: string | null | undefined,
): boolean {
    if (!actual) return false;
    return timingSafeEqual(expected, actual);
}
