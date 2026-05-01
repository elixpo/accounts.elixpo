import { describe, it, expect } from "vitest";

function generateUUID(): string {
  return crypto.randomUUID();
}

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

async function hashValue(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Tests

describe("webcrypto — UUID", () => {
  it("generates a valid v4 UUID", () => {
    const id = generateUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generates unique UUIDs on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, generateUUID));
    expect(ids.size).toBe(100);
  });
});

describe("webcrypto — randomString", () => {
  it("returns a string of the requested length", () => {
    for (const len of [8, 16, 32, 64]) {
      expect(randomString(len)).toHaveLength(len);
    }
  });

  it("returns different values on successive calls", () => {
    const a = randomString(32);
    const b = randomString(32);
    expect(a).not.toBe(b);
  });

  it("contains only hex characters", () => {
    const s = randomString(40);
    expect(s).toMatch(/^[0-9a-f]+$/);
  });
});

describe("webcrypto — hash determinism", () => {
  it("produces the same hash for the same input", async () => {
    const h1 = await hashValue("elixpo-test-input");
    const h2 = await hashValue("elixpo-test-input");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different inputs", async () => {
    const h1 = await hashValue("input-a");
    const h2 = await hashValue("input-b");
    expect(h1).not.toBe(h2);
  });

  it("output is a 64-char hex SHA-256 digest", async () => {
    const h = await hashValue("hello world");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});