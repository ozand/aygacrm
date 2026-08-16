import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  userVault: { findMany: vi.fn() },
  contact: { create: vi.fn() },
  externalIdentity: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, { code }: { code: string }) {
        super(message);
        this.code = code;
      }
    },
  },
}));

import { Prisma } from "@prisma/client";
import { resolveOrCreateContactByIdentity, IngestConflictError } from "@/lib/ingest/resolve";

describe("resolveOrCreateContactByIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.userVault.findMany.mockResolvedValue([{ vaultId: "vault-1" }]);
    // The resolver creates contact + identity inside db.$transaction; the mock
    // just runs the callback against the same mock delegate. A throw inside
    // (e.g. externalIdentity.create rejecting) propagates out, as with a real
    // rolled-back transaction.
    mockDb.$transaction.mockImplementation((cb: (tx: typeof mockDb) => unknown) => cb(mockDb));
  });

  it("throws when the caller has no accessible vault", async () => {
    mockDb.userVault.findMany.mockResolvedValue([]);

    await expect(
      resolveOrCreateContactByIdentity(
        { userId: "user-1" },
        { source: "telegram", externalId: "alice" }
      )
    ).rejects.toThrow("No accessible vault found for this account");

    expect(mockDb.externalIdentity.findFirst).not.toHaveBeenCalled();
  });

  it("returns the existing contact when the identity already resolves within accessible vaults", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue({ contactId: "contact-1" });

    const result = await resolveOrCreateContactByIdentity(
      { userId: "user-1" },
      { source: "telegram", externalId: "alice" }
    );

    expect(result).toEqual({ contactId: "contact-1", contactCreated: false });
    expect(mockDb.externalIdentity.findFirst).toHaveBeenCalledWith({
      where: {
        source: "telegram",
        externalId: "alice",
        contact: { vaultId: { in: ["vault-1"] }, deletedAt: null },
      },
      select: { contactId: true },
    });
    expect(mockDb.contact.create).not.toHaveBeenCalled();
    expect(mockDb.externalIdentity.create).not.toHaveBeenCalled();
  });

  it("creates a contact and attaches the identity when no match exists", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue(null);
    mockDb.contact.create.mockResolvedValue({ id: "contact-new" });
    mockDb.externalIdentity.create.mockResolvedValue({ id: "identity-1" });

    const result = await resolveOrCreateContactByIdentity(
      { userId: "user-1" },
      {
        source: "telegram",
        externalId: "alice",
        hints: { firstName: "Alice", lastName: "Stone", nickname: "ali" },
      }
    );

    expect(result).toEqual({ contactId: "contact-new", contactCreated: true });
    expect(mockDb.contact.create).toHaveBeenCalledWith({
      data: {
        vaultId: "vault-1",
        firstName: "Alice",
        lastName: "Stone",
        nickname: "ali",
      },
    });
    expect(mockDb.externalIdentity.create).toHaveBeenCalledWith({
      data: { contactId: "contact-new", source: "telegram", externalId: "alice" },
    });
  });

  it("falls back to the handle as firstName when no name hints are supplied", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue(null);
    mockDb.contact.create.mockResolvedValue({ id: "contact-new" });
    mockDb.externalIdentity.create.mockResolvedValue({ id: "identity-1" });

    await resolveOrCreateContactByIdentity(
      { userId: "user-1" },
      { source: "telegram", externalId: "bob_handle" }
    );

    expect(mockDb.contact.create).toHaveBeenCalledWith({
      data: {
        vaultId: "vault-1",
        firstName: "bob_handle",
        lastName: null,
        nickname: null,
      },
    });
  });

  it("recovers from a concurrent identity-attach race (P2002) by returning the winning contact", async () => {
    mockDb.externalIdentity.findFirst
      .mockResolvedValueOnce(null) // initial lookup: no match
      .mockResolvedValueOnce({ contactId: "contact-winner" }); // re-lookup after the race
    mockDb.contact.create.mockResolvedValue({ id: "contact-loser" });
    mockDb.externalIdentity.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Duplicate", { code: "P2002", clientVersion: "test" })
    );

    const result = await resolveOrCreateContactByIdentity(
      { userId: "user-1" },
      { source: "telegram", externalId: "alice" }
    );

    expect(result).toEqual({ contactId: "contact-winner", contactCreated: false });
    expect(mockDb.externalIdentity.findFirst).toHaveBeenCalledTimes(2);
  });

  it("rethrows when the identity create fails for a non-unique-constraint reason", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue(null);
    mockDb.contact.create.mockResolvedValue({ id: "contact-new" });
    mockDb.externalIdentity.create.mockRejectedValue(new Error("connection lost"));

    await expect(
      resolveOrCreateContactByIdentity(
        { userId: "user-1" },
        { source: "telegram", externalId: "alice" }
      )
    ).rejects.toThrow("connection lost");
  });

  it("raises a generic IngestConflictError when P2002 has no accessible winner (handle claimed by another account)", async () => {
    // Global (source, externalId) unique rejects; the vault-scoped re-lookup
    // finds nothing => the identity belongs to a different tenant. Must be a
    // deliberate conflict, never the other account's contactId or a raw 500.
    mockDb.externalIdentity.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockDb.contact.create.mockResolvedValue({ id: "contact-loser" });
    mockDb.externalIdentity.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Duplicate", { code: "P2002", clientVersion: "test" })
    );

    await expect(
      resolveOrCreateContactByIdentity(
        { userId: "user-1" },
        { source: "telegram", externalId: "alice" }
      )
    ).rejects.toBeInstanceOf(IngestConflictError);
  });
});
