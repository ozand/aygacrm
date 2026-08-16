import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
  userVault: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn() },
  externalRecord: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import { addExternalRecord } from "@/lib/actions/external-records";

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("addExternalRecord idempotency (issue #25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.userVault.findFirst.mockResolvedValue({ vault: { id: "vault-1" } });
    mockDb.contact.findFirst.mockResolvedValue({ id: "contact-1" });
  });

  it("first insert creates a new row", async () => {
    mockDb.externalRecord.findFirst.mockResolvedValue(null);
    mockDb.externalRecord.create.mockResolvedValue({
      id: "record-1",
      contactId: "contact-1",
      source: "telegram",
      kind: "message",
      externalId: "msg-1",
      content: "hello",
    });

    const result = await addExternalRecord(
      buildFormData({
        contactId: "contact-1",
        source: "telegram",
        kind: "message",
        externalId: "msg-1",
        content: "hello",
      })
    );

    expect(result.success).toBe(true);
    expect(result.created).toBe(true);
    expect(mockDb.externalRecord.create).toHaveBeenCalledTimes(1);
    expect(mockDb.externalRecord.update).not.toHaveBeenCalled();
  });

  it("re-inserting the same (contactId, source, externalId) updates the existing row instead of duplicating", async () => {
    const existing = {
      id: "record-1",
      contactId: "contact-1",
      source: "telegram",
      kind: "message",
      externalId: "msg-1",
      content: "original content",
    };
    mockDb.externalRecord.findFirst.mockResolvedValue(existing);
    mockDb.externalRecord.update.mockResolvedValue({
      ...existing,
      content: "edited content",
    });

    const result = await addExternalRecord(
      buildFormData({
        contactId: "contact-1",
        source: "telegram",
        kind: "message",
        externalId: "msg-1",
        content: "edited content",
      })
    );

    expect(result.success).toBe(true);
    expect(result.created).toBe(false);
    expect((result.data as { content: string }).content).toBe("edited content");
    expect(mockDb.externalRecord.create).not.toHaveBeenCalled();
    expect(mockDb.externalRecord.update).toHaveBeenCalledWith({
      where: { id: "record-1" },
      data: expect.objectContaining({ content: "edited content" }),
    });
  });

  it("two inserts with externalId omitted (manual/free records) create two separate rows, no dedup", async () => {
    mockDb.externalRecord.create
      .mockResolvedValueOnce({ id: "record-1", contactId: "contact-1", source: "manual", kind: "note" })
      .mockResolvedValueOnce({ id: "record-2", contactId: "contact-1", source: "manual", kind: "note" });

    const first = await addExternalRecord(
      buildFormData({ contactId: "contact-1", source: "manual", kind: "note", title: "Note one" })
    );
    const second = await addExternalRecord(
      buildFormData({ contactId: "contact-1", source: "manual", kind: "note", title: "Note two" })
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(mockDb.externalRecord.create).toHaveBeenCalledTimes(2);
    expect(mockDb.externalRecord.update).not.toHaveBeenCalled();
    // No dedup lookup should ever happen when externalId is absent.
    expect(mockDb.externalRecord.findFirst).not.toHaveBeenCalled();
  });
});
