import { beforeEach, describe, expect, it, vi } from "vitest";
import { upsertExternalRecord } from "@/lib/external-record-upsert";

describe("upsertExternalRecord", () => {
  const mockDb = {
    externalRecord: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new row when no existing record matches (contactId, source, externalId)", async () => {
    mockDb.externalRecord.findFirst.mockResolvedValue(null);
    mockDb.externalRecord.create.mockResolvedValue({ id: "record-1" });

    const result = await upsertExternalRecord(mockDb, {
      contactId: "contact-1",
      source: "telegram",
      kind: "message",
      externalId: "msg-123",
      content: "hello",
    });

    expect(result).toEqual({ record: { id: "record-1" }, created: true });
    expect(mockDb.externalRecord.findFirst).toHaveBeenCalledWith({
      where: { contactId: "contact-1", source: "telegram", externalId: "msg-123" },
    });
    expect(mockDb.externalRecord.create).toHaveBeenCalledWith({
      data: {
        contactId: "contact-1",
        source: "telegram",
        kind: "message",
        externalId: "msg-123",
        // Omitted fields stay undefined so Prisma falls back to column
        // defaults on create rather than writing explicit nulls.
        url: undefined,
        title: undefined,
        content: "hello",
        metadata: undefined,
        happenedAt: undefined,
      },
    });
    expect(mockDb.externalRecord.update).not.toHaveBeenCalled();
  });

  it("updates the existing row when (contactId, source, externalId) already exists — re-push is idempotent", async () => {
    mockDb.externalRecord.findFirst.mockResolvedValue({ id: "record-1", content: "old content" });
    mockDb.externalRecord.update.mockResolvedValue({ id: "record-1", content: "new content" });

    const result = await upsertExternalRecord(mockDb, {
      contactId: "contact-1",
      source: "telegram",
      kind: "message",
      externalId: "msg-123",
      content: "new content",
    });

    expect(result).toEqual({ record: { id: "record-1", content: "new content" }, created: false });
    expect(mockDb.externalRecord.create).not.toHaveBeenCalled();
    expect(mockDb.externalRecord.update).toHaveBeenCalledWith({
      where: { id: "record-1" },
      data: {
        kind: "message",
        // Omitted fields stay undefined so a re-push preserves the stored
        // value instead of wiping it to null.
        url: undefined,
        title: undefined,
        content: "new content",
        metadata: undefined,
        happenedAt: undefined,
      },
    });
  });

  it("recovers from a concurrent create (P2002) by updating the row the racer inserted", async () => {
    // First findFirst sees nothing; create loses the race and throws the
    // unique-violation; the fallback findFirst now sees the winner's row.
    mockDb.externalRecord.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "record-9", content: "from racer" });
    mockDb.externalRecord.create.mockRejectedValue({ code: "P2002" });
    mockDb.externalRecord.update.mockResolvedValue({ id: "record-9", content: "final" });

    const result = await upsertExternalRecord(mockDb, {
      contactId: "contact-1",
      source: "telegram",
      kind: "message",
      externalId: "msg-race",
      content: "final",
    });

    expect(result).toEqual({ record: { id: "record-9", content: "final" }, created: false });
    expect(mockDb.externalRecord.create).toHaveBeenCalledTimes(1);
    expect(mockDb.externalRecord.update).toHaveBeenCalledWith({
      where: { id: "record-9" },
      data: expect.objectContaining({ content: "final" }),
    });
  });

  it("rethrows a non-P2002 create error", async () => {
    mockDb.externalRecord.findFirst.mockResolvedValue(null);
    mockDb.externalRecord.create.mockRejectedValue(new Error("db down"));

    await expect(
      upsertExternalRecord(mockDb, {
        contactId: "contact-1",
        source: "telegram",
        kind: "message",
        externalId: "msg-x",
        content: "x",
      })
    ).rejects.toThrow("db down");
  });

  it("never dedups when externalId is null — every call creates a new row", async () => {
    mockDb.externalRecord.create
      .mockResolvedValueOnce({ id: "record-1" })
      .mockResolvedValueOnce({ id: "record-2" });

    const first = await upsertExternalRecord(mockDb, {
      contactId: "contact-1",
      source: "manual",
      kind: "note",
      externalId: null,
      content: "note one",
    });
    const second = await upsertExternalRecord(mockDb, {
      contactId: "contact-1",
      source: "manual",
      kind: "note",
      externalId: null,
      content: "note two",
    });

    expect(first).toEqual({ record: { id: "record-1" }, created: true });
    expect(second).toEqual({ record: { id: "record-2" }, created: true });
    expect(mockDb.externalRecord.create).toHaveBeenCalledTimes(2);
    // No dedup lookup should ever happen for null externalId.
    expect(mockDb.externalRecord.findFirst).not.toHaveBeenCalled();
  });
});
