import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolve = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());

const mockTx = vi.hoisted(() => ({
  contactFieldProvenance: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}));

const mockDb = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/ingest/resolve", () => ({
  resolveOrCreateContactByIdentity: mockResolve,
}));

vi.mock("@/lib/external-record-upsert", () => ({
  upsertExternalRecord: mockUpsert,
}));

import { IngestValidationError, ingestExternalItem } from "@/lib/ingest/ingest";

describe("ingestExternalItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));
    mockResolve.mockResolvedValue({ contactId: "contact-1", contactCreated: false });
    mockUpsert.mockResolvedValue({ record: { id: "record-1" }, created: false });
  });

  it("rejects an invalid source", async () => {
    await expect(
      ingestExternalItem(
        { userId: "user-1" },
        { source: "not-a-source", kind: "message", handle: "alice" }
      )
    ).rejects.toThrow(IngestValidationError);

    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid source/kind combination", async () => {
    await expect(
      ingestExternalItem(
        { userId: "user-1" },
        { source: "todoist", kind: "meeting", handle: "alice" }
      )
    ).rejects.toThrow(/Invalid source\/kind combination/);
  });

  it("rejects an empty handle", async () => {
    await expect(
      ingestExternalItem({ userId: "user-1" }, { source: "telegram", kind: "message", handle: "" })
    ).rejects.toThrow(IngestValidationError);
  });

  it("rejects metadata that fails the source-specific schema", async () => {
    await expect(
      ingestExternalItem(
        { userId: "user-1" },
        {
          source: "linkedin",
          kind: "profile",
          handle: "alice",
          metadata: { profileUrl: "not-a-url" },
        }
      )
    ).rejects.toThrow(IngestValidationError);

    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("creates a new contact and a new record on first ingest", async () => {
    mockResolve.mockResolvedValue({ contactId: "contact-new", contactCreated: true });
    mockUpsert.mockResolvedValue({ record: { id: "record-new" }, created: true });

    const result = await ingestExternalItem(
      { userId: "user-1" },
      {
        source: "telegram",
        kind: "message",
        handle: "alice_handle",
        externalId: "msg-1",
        content: "hello",
        contactHints: { firstName: "Alice", nickname: "alice_handle" },
      },
      { setBy: "token-1" }
    );

    expect(result).toEqual({
      contactId: "contact-new",
      recordId: "record-new",
      contactCreated: true,
      recordCreated: true,
    });

    expect(mockResolve).toHaveBeenCalledWith(
      { userId: "user-1" },
      { source: "telegram", externalId: "alice_handle", hints: { firstName: "Alice", nickname: "alice_handle" } }
    );

    expect(mockUpsert).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        contactId: "contact-new",
        source: "telegram",
        kind: "message",
        externalId: "msg-1",
        content: "hello",
      })
    );

    // Provenance written for the supplied hints.
    expect(mockTx.contactFieldProvenance.create).toHaveBeenCalledWith({
      data: { contactId: "contact-new", field: "firstName", value: "Alice", source: "telegram", setBy: "token-1", isActive: true },
    });
    expect(mockTx.contactFieldProvenance.create).toHaveBeenCalledWith({
      data: { contactId: "contact-new", field: "nickname", value: "alice_handle", source: "telegram", setBy: "token-1", isActive: true },
    });
  });

  it("is idempotent on repeat ingest of the same handle + external_id: no new contact, no new record", async () => {
    mockResolve.mockResolvedValue({ contactId: "contact-1", contactCreated: false });
    mockUpsert.mockResolvedValue({ record: { id: "record-1" }, created: false });

    const result = await ingestExternalItem(
      { userId: "user-1" },
      { source: "telegram", kind: "message", handle: "alice_handle", externalId: "msg-1", content: "hello again" }
    );

    expect(result).toEqual({
      contactId: "contact-1",
      recordId: "record-1",
      contactCreated: false,
      recordCreated: false,
    });
  });

  it("skips the provenance write when no contact hints are supplied", async () => {
    await ingestExternalItem(
      { userId: "user-1" },
      { source: "telegram", kind: "message", handle: "alice_handle", externalId: "msg-1" }
    );

    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});
