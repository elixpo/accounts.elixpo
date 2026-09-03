import { describe, expect, it } from "vitest";
import type { AccountsError } from "../core/errors.js";
import type { ReplayStore, WebhookHeaders } from "../webhooks/types.js";
import { verifyWebhookSignature } from "../webhooks/verify.js";

const SECRET = "test-webhook-secret-value-1234567890";

async function signHex(payload: string, secret: string): Promise<string> {
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

function nowIso(offsetMs = 0): string {
    return new Date(Date.now() + offsetMs).toISOString();
}

class InMemoryReplayStore implements ReplayStore {
    private seen = new Set<string>();

    hasSeen(signature: string): boolean {
        return this.seen.has(signature);
    }

    markSeen(signature: string): void {
        this.seen.add(signature);
    }
}

describe("verifyWebhookSignature", () => {
    it("resolves for a valid signature and fresh timestamp", async () => {
        const payload = JSON.stringify({
            event: "user.deleted",
            user_id: "user_1",
        });
        const signature = await signHex(payload, SECRET);
        const headers: WebhookHeaders = { signature, timestamp: nowIso() };

        await expect(
            verifyWebhookSignature(payload, headers, { secret: SECRET }),
        ).resolves.toBeUndefined();
    });

    it("rejects a tampered payload", async () => {
        const originalPayload = JSON.stringify({
            event: "user.deleted",
            user_id: "user_1",
        });
        const signature = await signHex(originalPayload, SECRET);
        const tamperedPayload = JSON.stringify({
            event: "user.deleted",
            user_id: "attacker",
        });
        const headers: WebhookHeaders = { signature, timestamp: nowIso() };

        await expect(
            verifyWebhookSignature(tamperedPayload, headers, {
                secret: SECRET,
            }),
        ).rejects.toMatchObject({ code: "webhook_verification_error" });
    });

    it("rejects a signature produced with the wrong secret", async () => {
        const payload = JSON.stringify({ event: "app.revoked" });
        const signature = await signHex(
            payload,
            "a-completely-different-secret-value",
        );
        const headers: WebhookHeaders = { signature, timestamp: nowIso() };

        await expect(
            verifyWebhookSignature(payload, headers, { secret: SECRET }),
        ).rejects.toMatchObject({ code: "webhook_verification_error" });
    });

    it("rejects a signature shorter than expected without throwing an unrelated error", async () => {
        const payload = JSON.stringify({ event: "user.deleted" });
        const headers: WebhookHeaders = {
            signature: "abcd",
            timestamp: nowIso(),
        };

        await expect(
            verifyWebhookSignature(payload, headers, { secret: SECRET }),
        ).rejects.toMatchObject({ code: "webhook_verification_error" });
    });

    it("rejects a missing signature header", async () => {
        const payload = JSON.stringify({ event: "user.deleted" });
        const headers: WebhookHeaders = { signature: "", timestamp: nowIso() };

        await expect(
            verifyWebhookSignature(payload, headers, { secret: SECRET }),
        ).rejects.toMatchObject({ code: "webhook_verification_error" });
    });

    it("rejects a timestamp outside the default tolerance window", async () => {
        const payload = JSON.stringify({ event: "user.deleted" });
        const signature = await signHex(payload, SECRET);
        const headers: WebhookHeaders = {
            signature,
            timestamp: nowIso(-10 * 60 * 1000), // 10 minutes old, default tolerance is 5
        };

        await expect(
            verifyWebhookSignature(payload, headers, { secret: SECRET }),
        ).rejects.toMatchObject({ code: "webhook_verification_error" });
    });

    it("accepts a timestamp within a custom tolerance window", async () => {
        const payload = JSON.stringify({ event: "user.deleted" });
        const signature = await signHex(payload, SECRET);
        const headers: WebhookHeaders = {
            signature,
            timestamp: nowIso(-10 * 60 * 1000),
        };

        await expect(
            verifyWebhookSignature(payload, headers, {
                secret: SECRET,
                toleranceMs: 15 * 60 * 1000, // 15 minutes
            }),
        ).resolves.toBeUndefined();
    });

    it("rejects a missing or unparseable timestamp", async () => {
        const payload = JSON.stringify({ event: "user.deleted" });
        const signature = await signHex(payload, SECRET);
        const headers: WebhookHeaders = { signature, timestamp: "not-a-date" };

        await expect(
            verifyWebhookSignature(payload, headers, { secret: SECRET }),
        ).rejects.toMatchObject({ code: "webhook_verification_error" });
    });

    it("does not leak the secret or signature in the thrown error message", async () => {
        const payload = JSON.stringify({ event: "user.deleted" });
        const wrongSignature = "0".repeat(64);
        const headers: WebhookHeaders = {
            signature: wrongSignature,
            timestamp: nowIso(),
        };

        try {
            await verifyWebhookSignature(payload, headers, { secret: SECRET });
            throw new Error("expected verifyWebhookSignature to throw");
        } catch (err) {
            const message = (err as AccountsError).message;
            expect(message).not.toContain(SECRET);
            expect(message).not.toContain(wrongSignature);
        }
    });

    it("accepts a first-seen signature and rejects a replay with a replayStore", async () => {
        const payload = JSON.stringify({ event: "user.deleted" });
        const signature = await signHex(payload, SECRET);
        const headers: WebhookHeaders = { signature, timestamp: nowIso() };
        const replayStore = new InMemoryReplayStore();

        await expect(
            verifyWebhookSignature(payload, headers, {
                secret: SECRET,
                replayStore,
            }),
        ).resolves.toBeUndefined();

        await expect(
            verifyWebhookSignature(payload, headers, {
                secret: SECRET,
                replayStore,
            }),
        ).rejects.toMatchObject({ code: "webhook_verification_error" });
    });

    it("does not enforce replay protection when no replayStore is supplied", async () => {
        const payload = JSON.stringify({ event: "user.deleted" });
        const signature = await signHex(payload, SECRET);
        const headers: WebhookHeaders = { signature, timestamp: nowIso() };

        await expect(
            verifyWebhookSignature(payload, headers, { secret: SECRET }),
        ).resolves.toBeUndefined();
        // Same signature verified again, no store — should still resolve,
        // since replay checking is opt-in.
        await expect(
            verifyWebhookSignature(payload, headers, { secret: SECRET }),
        ).resolves.toBeUndefined();
    });
});
