import { describe, expect, it } from "vitest";
import { evaluateRateLimit } from "@/lib/api/rate-limit";

type Store = Map<string, { count: number; windowStart: number }>;

function freshStore(): Store {
  return new Map();
}

describe("evaluateRateLimit", () => {
  it("allows the first request in a window", () => {
    const store = freshStore();
    const limit = 5;
    const now = 1_000_000;

    const result = evaluateRateLimit(store, "token-a", limit, now);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(limit);
    expect(result.remaining).toBe(limit - 1);
  });

  it("allows requests up to the limit, decrementing remaining to 0", () => {
    const store = freshStore();
    const limit = 3;
    const now = 500_000;

    const r1 = evaluateRateLimit(store, "token-a", limit, now);
    const r2 = evaluateRateLimit(store, "token-a", limit, now);
    const r3 = evaluateRateLimit(store, "token-a", limit, now);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    const store = freshStore();
    const limit = 2;
    const now = 42_000;

    evaluateRateLimit(store, "token-a", limit, now);
    evaluateRateLimit(store, "token-a", limit, now);
    const over = evaluateRateLimit(store, "token-a", limit, now);

    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.resetSeconds).toBeGreaterThan(0);
  });

  it("restarts the count after the window resets", () => {
    const store = freshStore();
    const limit = 2;
    const start = 1_000_000;

    evaluateRateLimit(store, "token-a", limit, start);
    evaluateRateLimit(store, "token-a", limit, start);
    const blocked = evaluateRateLimit(store, "token-a", limit, start);
    expect(blocked.allowed).toBe(false);

    // Advance past windowStart + 60000.
    const after = evaluateRateLimit(store, "token-a", limit, start + 60_001);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(limit - 1);
  });

  it("keeps counts independent per key", () => {
    const store = freshStore();
    const limit = 2;
    const now = 7_000;

    evaluateRateLimit(store, "token-a", limit, now);
    evaluateRateLimit(store, "token-a", limit, now);
    const aOver = evaluateRateLimit(store, "token-a", limit, now);
    const bFirst = evaluateRateLimit(store, "token-b", limit, now);

    expect(aOver.allowed).toBe(false);
    expect(bFirst.allowed).toBe(true);
    expect(bFirst.remaining).toBe(limit - 1);
  });

  it("reports resetSeconds within (0, 60]", () => {
    const store = freshStore();
    const limit = 5;
    const start = 3_000_000;

    const atStart = evaluateRateLimit(store, "token-a", limit, start);
    expect(atStart.resetSeconds).toBeGreaterThan(0);
    expect(atStart.resetSeconds).toBeLessThanOrEqual(60);

    const late = evaluateRateLimit(store, "token-a", limit, start + 59_500);
    expect(late.resetSeconds).toBeGreaterThan(0);
    expect(late.resetSeconds).toBeLessThanOrEqual(60);
  });
});
