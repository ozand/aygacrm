import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  apiIdempotencyKey: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import {
  IDEMPOTENCY_TTL_MS,
  hashRequest,
  lookupIdempotency,
  storeIdempotency,
} from "@/lib/api/idempotency";

describe("hashRequest", () => {
  it("same inputs produce same hash", () => {
    expect(hashRequest("POST", "/contacts", "{}")).toBe(hashRequest("POST", "/contacts", "{}"));
  });

  it("differing method produces different hash", () => {
    expect(hashRequest("POST", "/contacts", "{}")).not.toBe(hashRequest("PUT", "/contacts", "{}"));
  });

  it("differing path produces different hash", () => {
    expect(hashRequest("POST", "/contacts", "{}")).not.toBe(hashRequest("POST", "/notes", "{}"));
  });

  it("differing body produces different hash", () => {
    expect(hashRequest("POST", "/contacts", "{}")).not.toBe(
      hashRequest("POST", "/contacts", '{"a":1}')
    );
  });
});

describe("lookupIdempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns miss when no row exists", async () => {
    mockDb.apiIdempotencyKey.findUnique.mockResolvedValue(null);

    const result = await lookupIdempotency("token-1", "key-1", "hash-1");

    expect(result).toEqual({ status: "miss" });
    expect(mockDb.apiIdempotencyKey.findUnique).toHaveBeenCalledWith({
      where: { tokenId_key: { tokenId: "token-1", key: "key-1" } },
    });
  });

  it("returns hit with statusCode/responseBody for matching hash within TTL", async () => {
    const now = Date.now();
    mockDb.apiIdempotencyKey.findUnique.mockResolvedValue({
      id: "row-1",
      requestHash: "hash-1",
      statusCode: 201,
      responseBody: '{"id":"c1"}',
      createdAt: new Date(now - 1000),
    });

    const result = await lookupIdempotency("token-1", "key-1", "hash-1", now);

    expect(result).toEqual({ status: "hit", statusCode: 201, responseBody: '{"id":"c1"}' });
    expect(mockDb.apiIdempotencyKey.delete).not.toHaveBeenCalled();
  });

  it("returns conflict for different hash within TTL", async () => {
    const now = Date.now();
    mockDb.apiIdempotencyKey.findUnique.mockResolvedValue({
      id: "row-1",
      requestHash: "hash-other",
      statusCode: 201,
      responseBody: "{}",
      createdAt: new Date(now - 1000),
    });

    const result = await lookupIdempotency("token-1", "key-1", "hash-1", now);

    expect(result).toEqual({ status: "conflict" });
  });

  it("returns miss and deletes when row is older than TTL", async () => {
    const now = Date.now();
    mockDb.apiIdempotencyKey.delete.mockResolvedValue({});
    mockDb.apiIdempotencyKey.findUnique.mockResolvedValue({
      id: "row-1",
      requestHash: "hash-1",
      statusCode: 201,
      responseBody: "{}",
      createdAt: new Date(now - IDEMPOTENCY_TTL_MS - 1),
    });

    const result = await lookupIdempotency("token-1", "key-1", "hash-1", now);

    expect(result).toEqual({ status: "miss" });
    expect(mockDb.apiIdempotencyKey.delete).toHaveBeenCalledWith({ where: { id: "row-1" } });
  });
});

describe("storeIdempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls create with the args", async () => {
    mockDb.apiIdempotencyKey.create.mockResolvedValue({});
    const args = {
      tokenId: "token-1",
      key: "key-1",
      method: "POST",
      path: "/contacts",
      requestHash: "hash-1",
      statusCode: 201,
      responseBody: '{"id":"c1"}',
    };

    await storeIdempotency(args);

    expect(mockDb.apiIdempotencyKey.create).toHaveBeenCalledWith({ data: args });
  });

  it("swallows a thrown create", async () => {
    mockDb.apiIdempotencyKey.create.mockRejectedValue(new Error("unique constraint"));

    await expect(
      storeIdempotency({
        tokenId: "token-1",
        key: "key-1",
        method: "POST",
        path: "/contacts",
        requestHash: "hash-1",
        statusCode: 201,
        responseBody: "{}",
      })
    ).resolves.toBeUndefined();
  });
});
