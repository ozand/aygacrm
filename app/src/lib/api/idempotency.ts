import { db } from "@/lib/db";
import crypto from "crypto";

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

// Stable hash of the write's identity: method + path + raw body.
export function hashRequest(method: string, path: string, body: string): string {
  return crypto.createHash("sha256").update(`${method}\n${path}\n${body}`).digest("hex");
}

export type IdempotencyLookup =
  | { status: "miss" }
  | { status: "hit"; statusCode: number; responseBody: string }
  | { status: "conflict" };

// Look up a stored result. Rows older than the TTL are treated as absent
// (and best-effort deleted). "hit" only when the stored requestHash matches;
// a different hash for the same (tokenId,key) is a "conflict".
export async function lookupIdempotency(
  tokenId: string,
  key: string,
  requestHash: string,
  now: number = Date.now()
): Promise<IdempotencyLookup> {
  const row = await db.apiIdempotencyKey.findUnique({ where: { tokenId_key: { tokenId, key } } });
  if (!row) return { status: "miss" };
  if (now - row.createdAt.getTime() > IDEMPOTENCY_TTL_MS) {
    await db.apiIdempotencyKey.delete({ where: { id: row.id } }).catch(() => {});
    return { status: "miss" };
  }
  if (row.requestHash !== requestHash) return { status: "conflict" };
  return { status: "hit", statusCode: row.statusCode, responseBody: row.responseBody };
}

// Persist a completed write's response. Best-effort: a race that violates the
// unique constraint is swallowed (the other writer already stored it).
export async function storeIdempotency(args: {
  tokenId: string; key: string; method: string; path: string;
  requestHash: string; statusCode: number; responseBody: string;
}): Promise<void> {
  try {
    await db.apiIdempotencyKey.create({ data: { ...args } });
  } catch { /* unique-constraint race or store failure — non-fatal */ }
}

// Opportunistic TTL cleanup; call occasionally, ignore failures.
export async function sweepExpiredIdempotency(now: number = Date.now()): Promise<void> {
  const cutoff = new Date(now - IDEMPOTENCY_TTL_MS);
  await db.apiIdempotencyKey.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
}
