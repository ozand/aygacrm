import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
  userVault: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn() },
  externalIdentity: {
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

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  addExternalIdentity,
  deleteExternalIdentity,
  findContactsByExternalId,
  getExternalIdentitiesForContact,
  updateExternalIdentity,
} from "@/lib/actions/external-identities";

describe("external identities server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.userVault.findFirst.mockResolvedValue({ vault: { id: "vault-1" } });
    mockDb.contact.findFirst.mockResolvedValue({ id: "contact-1", vaultId: "vault-1" });

    mockDb.externalIdentity.findFirst.mockResolvedValue(null);
    mockDb.externalIdentity.findMany.mockResolvedValue([]);
    mockDb.externalIdentity.create.mockResolvedValue({ id: "identity-1" });
    mockDb.externalIdentity.update.mockResolvedValue({ id: "identity-1" });
    mockDb.externalIdentity.delete.mockResolvedValue({ id: "identity-1" });
  });

  it("getExternalIdentitiesForContact returns identities", async () => {
    const identities = [
      { id: "identity-1", source: "github", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "identity-2", source: "twitter", createdAt: new Date("2026-01-02T00:00:00.000Z") },
    ];
    mockDb.externalIdentity.findMany.mockResolvedValue(identities);

    const result = await getExternalIdentitiesForContact("contact-1");

    expect(result).toEqual(identities);
    expect(mockDb.externalIdentity.findMany).toHaveBeenCalledWith({
      where: { contactId: "contact-1" },
      orderBy: [{ source: "asc" }, { createdAt: "asc" }],
    });
  });

  it("getExternalIdentitiesForContact returns empty array for wrong vault contact", async () => {
    mockDb.contact.findFirst.mockResolvedValue(null);

    const result = await getExternalIdentitiesForContact("contact-2");

    expect(result).toEqual([]);
    expect(mockDb.externalIdentity.findMany).not.toHaveBeenCalled();
  });

  it("getExternalIdentitiesForContact returns empty array on auth error", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getExternalIdentitiesForContact("contact-1");

    expect(result).toEqual([]);
  });

  it("addExternalIdentity succeeds with all fields", async () => {
    const created = {
      id: "identity-1",
      contactId: "contact-1",
      source: "github",
      externalId: "alice",
      label: "Primary",
      verified: true,
    };
    mockDb.externalIdentity.create.mockResolvedValue(created);

    const formData = new FormData();
    formData.set("contactId", "contact-1");
    formData.set("source", "  github  ");
    formData.set("externalId", "  alice  ");
    formData.set("label", "  Primary  ");
    formData.set("verified", "true");

    const result = await addExternalIdentity(formData);

    expect(result).toEqual({ success: true, data: created });
    expect(mockDb.externalIdentity.create).toHaveBeenCalledWith({
      data: {
        contactId: "contact-1",
        source: "github",
        externalId: "alice",
        label: "Primary",
        verified: true,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/contacts/contact-1");
  });

  it("addExternalIdentity succeeds with only required fields", async () => {
    const formData = new FormData();
    formData.set("contactId", "contact-1");
    formData.set("source", "github");
    formData.set("externalId", "alice");

    const result = await addExternalIdentity(formData);

    expect(result.success).toBe(true);
    expect(mockDb.externalIdentity.create).toHaveBeenCalledWith({
      data: {
        contactId: "contact-1",
        source: "github",
        externalId: "alice",
        label: null,
      },
    });
  });

  it("addExternalIdentity returns error when contactId is missing", async () => {
    const formData = new FormData();
    formData.set("source", "github");
    formData.set("externalId", "alice");

    const result = await addExternalIdentity(formData);

    expect(result).toEqual({ success: false, error: "Contact ID is required" });
  });

  it("addExternalIdentity returns error when source is missing", async () => {
    const formData = new FormData();
    formData.set("contactId", "contact-1");
    formData.set("externalId", "alice");

    const result = await addExternalIdentity(formData);

    expect(result).toEqual({ success: false, error: "Source is required" });
  });

  it("addExternalIdentity returns error when externalId is missing", async () => {
    const formData = new FormData();
    formData.set("contactId", "contact-1");
    formData.set("source", "github");

    const result = await addExternalIdentity(formData);

    expect(result).toEqual({ success: false, error: "External ID is required" });
  });

  it("addExternalIdentity returns contact not found error", async () => {
    mockDb.contact.findFirst.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("contactId", "contact-1");
    formData.set("source", "github");
    formData.set("externalId", "alice");

    const result = await addExternalIdentity(formData);

    expect(result).toEqual({ success: false, error: "Contact not found" });
  });

  it("addExternalIdentity returns duplicate error for P2002", async () => {
    mockDb.externalIdentity.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Duplicate", { code: "P2002" })
    );
    const formData = new FormData();
    formData.set("contactId", "contact-1");
    formData.set("source", "github");
    formData.set("externalId", "alice");

    const result = await addExternalIdentity(formData);

    expect(result).toEqual({
      success: false,
      error: "This external identity already exists for that source",
    });
  });

  it("updateExternalIdentity succeeds with partial label update", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue({
      id: "identity-1",
      contactId: "contact-1",
      contact: { id: "contact-1", vaultId: "vault-1" },
    });
    mockDb.externalIdentity.update.mockResolvedValue({
      id: "identity-1",
      label: "Updated Label",
    });

    const formData = new FormData();
    formData.set("label", "  Updated Label  ");

    const result = await updateExternalIdentity("identity-1", formData);

    expect(result).toEqual({ success: true, data: { id: "identity-1", label: "Updated Label" } });
    expect(mockDb.externalIdentity.update).toHaveBeenCalledWith({
      where: { id: "identity-1" },
      data: { label: "Updated Label" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/contacts/contact-1");
  });

  it("updateExternalIdentity succeeds with verified update", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue({
      id: "identity-1",
      contactId: "contact-1",
      contact: { id: "contact-1", vaultId: "vault-1" },
    });

    const formData = new FormData();
    formData.set("verified", "false");

    const result = await updateExternalIdentity("identity-1", formData);

    expect(result.success).toBe(true);
    expect(mockDb.externalIdentity.update).toHaveBeenCalledWith({
      where: { id: "identity-1" },
      data: { verified: false },
    });
  });

  it("updateExternalIdentity returns error for empty externalId", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue({
      id: "identity-1",
      contactId: "contact-1",
      contact: { id: "contact-1", vaultId: "vault-1" },
    });

    const formData = new FormData();
    formData.set("externalId", "   ");

    const result = await updateExternalIdentity("identity-1", formData);

    expect(result).toEqual({ success: false, error: "External ID cannot be empty" });
    expect(mockDb.externalIdentity.update).not.toHaveBeenCalled();
  });

  it("updateExternalIdentity returns not found when identity is missing", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("label", "Updated");

    const result = await updateExternalIdentity("identity-missing", formData);

    expect(result).toEqual({ success: false, error: "External identity not found" });
  });

  it("updateExternalIdentity returns not found for vault mismatch", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue({
      id: "identity-1",
      contactId: "contact-1",
      contact: { id: "contact-1", vaultId: "vault-2" },
    });
    const formData = new FormData();
    formData.set("label", "Updated");

    const result = await updateExternalIdentity("identity-1", formData);

    expect(result).toEqual({ success: false, error: "External identity not found" });
  });

  it("deleteExternalIdentity succeeds", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue({
      id: "identity-1",
      contactId: "contact-1",
      contact: { id: "contact-1", vaultId: "vault-1" },
    });

    const result = await deleteExternalIdentity("identity-1");

    expect(result).toEqual({ success: true });
    expect(mockDb.externalIdentity.delete).toHaveBeenCalledWith({ where: { id: "identity-1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/contacts/contact-1");
  });

  it("deleteExternalIdentity returns not found when identity is missing", async () => {
    mockDb.externalIdentity.findFirst.mockResolvedValue(null);

    const result = await deleteExternalIdentity("identity-missing");

    expect(result).toEqual({ success: false, error: "External identity not found" });
    expect(mockDb.externalIdentity.delete).not.toHaveBeenCalled();
  });

  it("findContactsByExternalId returns matches", async () => {
    mockDb.externalIdentity.findMany.mockResolvedValue([
      {
        source: "github",
        externalId: "alice",
        contact: { id: "contact-1", firstName: "Alice", lastName: "Stone", nickname: "Ali" },
      },
      {
        source: "github",
        externalId: "alice",
        contact: { id: "contact-2", firstName: null, lastName: null, nickname: "Bobby" },
      },
    ]);

    const result = await findContactsByExternalId("github", "alice");

    expect(result).toEqual([
      {
        contactId: "contact-1",
        contactName: "Alice Stone",
        source: "github",
        externalId: "alice",
      },
      {
        contactId: "contact-2",
        contactName: "Bobby",
        source: "github",
        externalId: "alice",
      },
    ]);
  });

  it("findContactsByExternalId returns empty array for empty source or externalId", async () => {
    await expect(findContactsByExternalId("", "alice")).resolves.toEqual([]);
    await expect(findContactsByExternalId("github", "")).resolves.toEqual([]);
    expect(mockDb.externalIdentity.findMany).not.toHaveBeenCalled();
  });

  it("findContactsByExternalId returns empty array on error", async () => {
    mockDb.externalIdentity.findMany.mockRejectedValue(new Error("db failure"));

    const result = await findContactsByExternalId("github", "alice");

    expect(result).toEqual([]);
  });
});
