/**
 * Elixpo Mails dispatcher.
 *
 * All outbound mail from accounts.elixpo goes through mails.elixpo.com via
 * HMAC-signed POST to a per-template webhook endpoint. The signature
 * contract is documented in refer/mails.md:
 *
 *   X-Elixpo-Signature: t=<unix_seconds>,v1=<hex HMAC-SHA256>
 *   HMAC key   = product shared secret (MAILS_SHARED_SECRET)
 *   HMAC input = `${t}.${rawBody}` — must be the EXACT bytes posted
 *
 * Fire-and-forget: if mails.elixpo is unreachable or a template hook is
 * misconfigured, callers MUST NOT 500. We log loudly server-side and
 * return — the auth/profile flows must still succeed.
 *
 * One env var per template hook, plus the shared secret. Names are kept
 * stable so rotating an individual template doesn't touch the others.
 */

const BASE_URL = "https://mails.elixpo.com";
const TIMEOUT_MS = 5_000;

export type MailTemplate =
    | "user_verify_otp"
    | "password_reset"
    | "oauth_app_register"
    | "oauth_app_delete"
    | "account_suspended"
    | "sign_in_device"
    | "webhook_fail";

const HOOK_ENV: Record<MailTemplate, string> = {
    user_verify_otp: "MAILS_HOOK_USER_VERIFY_OTP",
    password_reset: "MAILS_HOOK_PASSWORD_RESET",
    oauth_app_register: "MAILS_HOOK_OAUTH_APP_REGISTER",
    oauth_app_delete: "MAILS_HOOK_OAUTH_APP_DELETE",
    account_suspended: "MAILS_HOOK_ACCOUNT_SUSPENDED",
    sign_in_device: "MAILS_HOOK_SIGN_IN_DEVICE",
    webhook_fail: "MAILS_HOOK_WEBHOOK_FAIL",
};

interface SendOptions {
    /**
     * Optional dedupe key. mails.elixpo guarantees the same key won't
     * deliver twice — use for retry-safe paths (e.g. webhook handlers,
     * cron jobs, anywhere `at-least-once` semantics would otherwise
     * spam the recipient).
     */
    idempotencyKey?: string;
}

export async function sendMail(
    template: MailTemplate,
    to: string,
    variables: Record<string, unknown>,
    options: SendOptions = {},
): Promise<void> {
    const secret = process.env.MAILS_SHARED_SECRET;
    if (!secret) {
        console.warn(
            `[mails] MAILS_SHARED_SECRET not set — skipping ${template} to ${to}`,
        );
        return;
    }
    const endpointKey = process.env[HOOK_ENV[template]];
    if (!endpointKey) {
        console.warn(
            `[mails] ${HOOK_ENV[template]} not set — skipping ${template} to ${to}`,
        );
        return;
    }

    const payload: Record<string, unknown> = { to, variables };
    if (options.idempotencyKey) {
        payload.idempotency_key = options.idempotencyKey;
    }

    // Build the JSON string ONCE; HMAC over the literal bytes; send those
    // same bytes. Re-serializing would change formatting and break the
    // signature.
    const body = JSON.stringify(payload);
    const t = Math.floor(Date.now() / 1000).toString();
    const v1 = await hmacSha256Hex(secret, `${t}.${body}`);

    const controller = new AbortController();
    const tm = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(`${BASE_URL}/v1/hooks/${endpointKey}`, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                "X-Elixpo-Signature": `t=${t},v1=${v1}`,
            },
            body,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error(
                `[mails] ${template} to ${to} failed: HTTP ${res.status} ${text.slice(0, 200)}`,
            );
            return;
        }

        // 200 can mean { ok: true, status: "sent" } OR
        // { ok: false, status: "suppressed" } — both are successful from
        // our perspective. Only log a warning on suppression so it's
        // visible without making it look like an error.
        try {
            const j: any = await res.json();
            if (j && j.ok === false && j.status === "suppressed") {
                console.warn(
                    `[mails] ${template} to ${to} suppressed (recipient unsubscribed)`,
                );
            }
        } catch {
            /* mails.elixpo always returns JSON; non-JSON 200 is OK to ignore */
        }
    } catch (err) {
        console.error(
            `[mails] ${template} to ${to} delivery error:`,
            err instanceof Error ? err.message : err,
        );
    } finally {
        clearTimeout(tm);
    }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const sig = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(message),
    );
    let out = "";
    for (const b of new Uint8Array(sig)) out += b.toString(16).padStart(2, "0");
    return out;
}
