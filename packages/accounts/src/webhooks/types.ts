/**
 * Types for verifying inbound Elixpo Accounts webhooks.
 *
 * Signing scheme (matches src/lib/revocation-webhook.ts, the platform's
 * edge-safe sender): HMAC-SHA256 over JSON.stringify(payload), hex-encoded,
 * sent as X-Webhook-Signature. X-Webhook-Timestamp is an ISO 8601 string.
 */

export interface WebhookHeaders {
    /** Value of the X-Webhook-Signature header (hex HMAC-SHA256). */
    signature: string;
    /** Value of the X-Webhook-Timestamp header (ISO 8601 string). */
    timestamp: string;
}

/**
 * Pluggable replay-protection store. The SDK has no persistence layer of
 * its own, so callers back this with whatever they have (KV, Redis, a DB
 * table, even an in-memory Map for tests/low-traffic use). Signatures are
 * unique per payload+secret, so tracking signature strings is sufficient
 * to detect replay of an identical request.
 */
export interface ReplayStore {
    /** Returns true if this signature has been seen before (i.e., should be rejected as a replay). */
    hasSeen(signature: string): Promise<boolean> | boolean;
    /** Records that this signature has now been processed. */
    markSeen(signature: string): Promise<void> | void;
}

export interface WebhookVerificationOptions {
    /** The shared secret configured for this webhook endpoint. */
    secret: string;
    /**
     * Maximum allowed drift, in milliseconds, between the request's
     * X-Webhook-Timestamp and now. Defaults to 5 minutes.
     */
    toleranceMs?: number;
    /**
     * Optional replay-protection store. If omitted, replay checking is
     * skipped entirely (signature + timestamp are still verified) — callers
     * that need replay protection must supply a store.
     */
    replayStore?: ReplayStore;
}
