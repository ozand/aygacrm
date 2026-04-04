import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());

const mockTx = vi.hoisted(() => ({
  contactFieldProvenance: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}));

const mockDb = vi.hoisted(() => ({
  userVault: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn() },
  contactFieldProvenance: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
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

import {
  getProvenanceForContact,
  getProvenanceHistory,
  recordProvenance,
} from "@/lib/actions/provenance";

describe("provenance server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.userVault.findFirst.mockResolvedValue({ vault: { id: "vault-1" } });
    mockDb.contact.findFirst.mockResolvedValue({ id: "contact-1" });
    mockDb.contactFieldProvenance.findMany.mockResolvedValue([]);
    mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));
  });

  describe("recordProvenance", () => {
    it("throws on auth failure", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(recordProvenance("contact-1", { email: "a@example.com" }, "manual")).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("throws when contact is not in vault", async () => {
      mockDb.contact.findFirst.mockResolvedValue(null);

      await expect(recordProvenance("contact-1", { email: "a@example.com" }, "manual")).rejects.toThrow(
        "Contact not found"
      );
    });

    it("returns early for empty fields object", async () => {
      await recordProvenance("contact-1", {}, "manual");

      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(mockTx.contactFieldProvenance.updateMany).not.toHaveBeenCalled();
      expect(mockTx.contactFieldProvenance.create).not.toHaveBeenCalled();
    });

    it("deactivates old and creates new record for a single field", async () => {
      await recordProvenance("contact-1", { email: "a@example.com" }, "manual");

      expect(mockTx.contactFieldProvenance.updateMany).toHaveBeenCalledWith({
        where: {
          contactId: "contact-1",
          field: "email",
          isActive: true,
        },
        data: { isActive: false },
      });

      expect(mockTx.contactFieldProvenance.create).toHaveBeenCalledWith({
        data: {
          contactId: "contact-1",
          field: "email",
          value: "a@example.com",
          source: "manual",
          setBy: null,
          isActive: true,
        },
      });
    });

    it("deactivates and creates records for multiple fields", async () => {
      await recordProvenance(
        "contact-1",
        { email: "a@example.com", phone: "555-1111", company: null },
        "import"
      );

      expect(mockTx.contactFieldProvenance.updateMany).toHaveBeenCalledTimes(3);
      expect(mockTx.contactFieldProvenance.create).toHaveBeenCalledTimes(3);

      expect(mockTx.contactFieldProvenance.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          contactId: "contact-1",
          field: "phone",
          isActive: true,
        },
        data: { isActive: false },
      });

      expect(mockTx.contactFieldProvenance.create).toHaveBeenNthCalledWith(3, {
        data: {
          contactId: "contact-1",
          field: "company",
          value: null,
          source: "import",
          setBy: null,
          isActive: true,
        },
      });
    });

    it("passes setBy through when provided", async () => {
      await recordProvenance("contact-1", { email: "a@example.com" }, "manual", "agent-1");

      expect(mockTx.contactFieldProvenance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          setBy: "agent-1",
        }),
      });
    });
  });

  describe("getProvenanceForContact", () => {
    it("returns active provenance records for valid contact", async () => {
      const records = [
        { id: "p-1", contactId: "contact-1", field: "email", value: "a@example.com", isActive: true },
      ];
      mockDb.contactFieldProvenance.findMany.mockResolvedValue(records);

      const result = await getProvenanceForContact("contact-1");

      expect(result).toEqual(records);
      expect(mockDb.contactFieldProvenance.findMany).toHaveBeenCalledWith({
        where: {
          contactId: "contact-1",
          isActive: true,
        },
        orderBy: [{ field: "asc" }, { createdAt: "desc" }],
      });
    });

    it("returns [] when contact is not in vault", async () => {
      mockDb.contact.findFirst.mockResolvedValue(null);

      await expect(getProvenanceForContact("contact-1")).resolves.toEqual([]);
    });

    it("returns [] on error", async () => {
      mockDb.contactFieldProvenance.findMany.mockRejectedValue(new Error("db down"));

      await expect(getProvenanceForContact("contact-1")).resolves.toEqual([]);
    });
  });

  describe("getProvenanceHistory", () => {
    it("returns all records for a field ordered by createdAt desc", async () => {
      const history = [
        { id: "p-2", contactId: "contact-1", field: "email", value: "new@example.com" },
        { id: "p-1", contactId: "contact-1", field: "email", value: "old@example.com" },
      ];
      mockDb.contactFieldProvenance.findMany.mockResolvedValue(history);

      const result = await getProvenanceHistory("contact-1", "email");

      expect(result).toEqual(history);
      expect(mockDb.contactFieldProvenance.findMany).toHaveBeenCalledWith({
        where: {
          contactId: "contact-1",
          field: "email",
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns [] when contact is not in vault", async () => {
      mockDb.contact.findFirst.mockResolvedValue(null);

      await expect(getProvenanceHistory("contact-1", "email")).resolves.toEqual([]);
    });

    it("returns [] on error", async () => {
      mockDb.userVault.findFirst.mockRejectedValue(new Error("query failed"));

      await expect(getProvenanceHistory("contact-1", "email")).resolves.toEqual([]);
    });
  });
});
