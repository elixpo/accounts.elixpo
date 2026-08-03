import type { D1Database } from "@cloudflare/workers-types";
import { generateRandomString, generateUUID, hashString } from "@/lib/webcrypto";

// Unambiguous charset: no 0/O, 1/I/L, safe to read aloud and type.
const USER_CODE_ALPHABET = "BCDFGHJKMNPQRSTVWXYZ23456789";
const USER_CODE_GROUP_LEN = 4;
const USER_CODE_GROUPS = 2; // e.g. "WXHF-7NKQ"

export const DEVICE_CODE_TTL_SECONDS = 10 * 60; // 10 min, per RFC 8628 typical default
export const DEVICE_CODE_BASE_POLL_INTERVAL = 5; // seconds
export const DEVICE_CODE_SLOW_DOWN_INCREMENT = 5; // seconds added after slow_down

export function generateUserCode(): string {
    const bytes = crypto.getRandomValues(
        new Uint8Array(USER_CODE_GROUP_LEN * USER_CODE_GROUPS),
    );
    let out = "";
    for (let g = 0; g < USER_CODE_GROUPS; g++) {
        if (g > 0) out += "-";
        for (let i = 0; i < USER_CODE_GROUP_LEN; i++) {
            const b = bytes[g * USER_CODE_GROUP_LEN + i];
            out += USER_CODE_ALPHABET[b % USER_CODE_ALPHABET.length];
        }
    }
    return out;
}

/** Case-insensitive, whitespace/dash-insensitive normalization for lookups. */
export function normalizeUserCode(input: string): string {
    return input
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .trim();
}

export interface CreateDeviceAuthorizationInput {
    clientId: string;
    scopes: string;
    ipHash?: string | null;
    uaShort?: string | null;
}

export interface DeviceAuthorizationResult {
    deviceCode: string; // raw, returned to the CLI once
    userCode: string; // raw display form, e.g. "WXHF-7NKQ"
    expiresAt: Date;
    interval: number;
}

export async function createDeviceAuthorization(
    db: D1Database,
    input: CreateDeviceAuthorizationInput,
): Promise<DeviceAuthorizationResult> {
    const deviceCode = `dvc_${generateRandomString(32)}`; // 256 bits of entropy
    const deviceCodeHash = await hashString(deviceCode);

    // Collision on the (very large) user-code space is astronomically
    // unlikely, but since it's short and human-typed we still guard it
    // with a bounded retry against the UNIQUE constraint.
    let userCode = "";
    let userCodeHash = "";
    for (let attempt = 0; attempt < 5; attempt++) {
        userCode = generateUserCode();
        userCodeHash = await hashString(normalizeUserCode(userCode));
        const existing = await db
            .prepare(
                "SELECT 1 FROM device_authorizations WHERE user_code_hash = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP",
            )
            .bind(userCodeHash)
            .first();
        if (!existing) break;
    }

    const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_SECONDS * 1000);

    await db
        .prepare(
            `INSERT INTO device_authorizations
                (id, device_code_hash, user_code_hash, user_code_display, client_id,
                 scopes, status, poll_interval_seconds, ip_hash, ua_short, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        )
        .bind(
            generateUUID(),
            deviceCodeHash,
            userCodeHash,
            userCode,
            input.clientId,
            input.scopes,
            DEVICE_CODE_BASE_POLL_INTERVAL,
            input.ipHash ?? null,
            input.uaShort ?? null,
            expiresAt.toISOString(),
        )
        .run();

    return {
        deviceCode,
        userCode,
        expiresAt,
        interval: DEVICE_CODE_BASE_POLL_INTERVAL,
    };
}

export async function getDeviceAuthorizationByUserCode(
    db: D1Database,
    rawUserCode: string,
) {
    const hash = await hashString(normalizeUserCode(rawUserCode));
    return db
        .prepare("SELECT * FROM device_authorizations WHERE user_code_hash = ?")
        .bind(hash)
        .first<any>();
}

export async function getDeviceAuthorizationByDeviceCode(
    db: D1Database,
    rawDeviceCode: string,
) {
    const hash = await hashString(rawDeviceCode);
    return db
        .prepare("SELECT * FROM device_authorizations WHERE device_code_hash = ?")
        .bind(hash)
        .first<any>();
}

/**
 * Approve a pending device authorization for the signed-in user.
 * Returns false if the row wasn't in `pending` state (already
 * approved/denied/expired) — callers must treat that as "nothing to do"
 * rather than retrying, since it means the code was already resolved
 * (possibly by a concurrent tab).
 */
export async function approveDeviceAuthorization(
    db: D1Database,
    id: string,
    userId: string,
): Promise<boolean> {
    const result = await db
        .prepare(
            `UPDATE device_authorizations
             SET status = 'approved', user_id = ?, approved_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP`,
        )
        .bind(userId, id)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

export async function denyDeviceAuthorization(
    db: D1Database,
    id: string,
): Promise<boolean> {
    const result = await db
        .prepare(
            `UPDATE device_authorizations
             SET status = 'denied', denied_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'pending'`,
        )
        .bind(id)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Atomically flip approved -> consumed. Only ONE caller can ever win this
 * race (D1/SQLite serializes the UPDATE), which is what guarantees an
 * approved device code cannot mint two token sets even if the CLI fires
 * overlapping poll requests.
 */
export async function consumeDeviceAuthorization(
    db: D1Database,
    id: string,
): Promise<boolean> {
    const result = await db
        .prepare(
            `UPDATE device_authorizations
             SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'approved'`,
        )
        .bind(id)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Poll-rate bookkeeping: record the poll and decide whether the caller is
 * polling faster than the advertised interval. On violation, the stored
 * interval is bumped by DEVICE_CODE_SLOW_DOWN_INCREMENT so subsequent
 * polls must back off further (RFC 8628 §3.5).
 */
export async function registerPollAndCheckRate(
    db: D1Database,
    row: { id: string; last_polled_at: string | null; poll_interval_seconds: number },
): Promise<{ tooFast: boolean; newInterval: number }> {
    const now = Date.now();
    const last = row.last_polled_at ? new Date(row.last_polled_at).getTime() : 0;
    const minGapMs = row.poll_interval_seconds * 1000;
    const tooFast = last > 0 && now - last < minGapMs;
    const newInterval = tooFast
        ? row.poll_interval_seconds + DEVICE_CODE_SLOW_DOWN_INCREMENT
        : row.poll_interval_seconds;

    await db
        .prepare(
            `UPDATE device_authorizations
             SET last_polled_at = CURRENT_TIMESTAMP, poll_count = poll_count + 1, poll_interval_seconds = ?
             WHERE id = ?`,
        )
        .bind(newInterval, row.id)
        .run();

    return { tooFast, newInterval };
}

/** Bounded cleanup query for a cron worker — deletes long-expired rows only. */
export async function cleanupExpiredDeviceAuthorizations(
    db: D1Database,
    olderThanHours = 24,
) {
    return db
        .prepare(
            `DELETE FROM device_authorizations
             WHERE expires_at < datetime('now', ?)`,
        )
        .bind(`-${olderThanHours} hours`)
        .run();
}
