/**
 * Inbound webhook signature verification for Elixpo Accounts webhooks.
 * Web Crypto only (crypto.subtle) — no Node built-ins, works in Node,
 * browsers, and edge runtimes alike.
 */
import { AccountsError } from "../core/errors.js";
import type { WebhookHeaders, WebhookVerificationOptions } from "./types.js";

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

async function hmacHex(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(payload),
    );
    return Array.from(new Uint8Array(signature))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Constant-time comparison of two hex strings. Unlike Node's
 * crypto.timingSafeEqual, this returns false on length mismatch instead
 * of throwing — a length mismatch is an expected outcome here (e.g. a
 * malformed or truncated signature header), not an exceptional one.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

function parseTimestamp(timestamp: string): number | null {
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Verifies an inbound webhook: checks the HMAC-SHA256 signature over the
 * raw JSON payload, enforces a timestamp tolerance window, and — if a
 * replayStore is supplied — rejects a previously-seen signature.
 *
 * `payload` must be the exact raw request body string as received (not
 * re-serialized), since the sender signs the exact bytes it sent — any
 * re-serialization (e.g. via JSON.parse then JSON.stringify) can change
 * key order or whitespace and produce a signature mismatch even for a
 * legitimate request.
 *
 * Throws AccountsError with code "webhook_verification_error" on any
 * failure. Never includes the secret, signature, or payload contents in
 * the thrown message.
 */
export async function verifyWebhookSignature(
    payload: string,
    headers: WebhookHeaders,
    options: WebhookVerificationOptions,
): Promise<void> {
    const toleranceMs = options.toleranceMs ?? DEFAULT_TOLERANCE_MS;

    const requestTime = parseTimestamp(headers.timestamp);
    if (requestTime === null) {
        throw new AccountsError(
            "webhook_verification_error",
            "Webhook timestamp header is missing or not a valid date",
        );
    }

    const drift = Math.abs(Date.now() - requestTime);
    if (drift > toleranceMs) {
        throw new AccountsError(
            "webhook_verification_error",
            `Webhook timestamp is outside the allowed tolerance window (drift ${drift}ms > ${toleranceMs}ms)`,
        );
    }

    if (!headers.signature) {
        throw new AccountsError(
            "webhook_verification_error",
            "Webhook signature header is missing",
        );
    }

    const expectedSignature = await hmacHex(payload, options.secret);
    if (!timingSafeEqualHex(headers.signature, expectedSignature)) {
        throw new AccountsError(
            "webhook_verification_error",
            "Webhook signature does not match the expected value",
        );
    }

    if (options.replayStore) {
        const alreadySeen = await options.replayStore.hasSeen(
            headers.signature,
        );
        if (alreadySeen) {
            throw new AccountsError(
                "webhook_verification_error",
                "Webhook signature has already been processed (possible replay)",
            );
        }
        await options.replayStore.markSeen(headers.signature);
    }
}
