import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => {
  const createModelMock = () => ({
    updateMany: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  });

  return {
    userVault: { findFirst: vi.fn() },
    contact: createModelMock(),
    note: createModelMock(),
    address: createModelMock(),
    contactInformation: createModelMock(),
    contactImportantDate: createModelMock(),
    contactReminder: createModelMock(),
    contactTask: createModelMock(),
    activity: createModelMock(),
    contactFeedItem: createModelMock(),
    pet: createModelMock(),
    goal: createModelMock(),
    gift: createModelMock(),
    call: createModelMock(),
    lifeEvent: createModelMock(),
    file: createModelMock(),
    contactQuickFact: createModelMock(),
    auditLog: createModelMock(),
    moodTrackingEvent: createModelMock(),
    photo: createModelMock(),
    externalIdentity: createModelMock(),
    contactFieldProvenance: createModelMock(),
    relationship: createModelMock(),
    contactLabel: createModelMock(),
    contactGroup: createModelMock(),
    contactTag: createModelMock(),
    loan: createModelMock(),
    contactMergeLog: createModelMock(),
    $transaction: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  Prisma: {
    JsonNull: Symbol("JsonNull"),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import { Prisma } from "@prisma/client";
import { getMergeHistory, mergeContacts, unmergeContacts } from "@/lib/actions/merge";

const RELATION_MODELS = [
  "note",
  "address",
  "contactInformation",
  "contactImportantDate",
  "contactReminder",
  "contactTask",
  "activity",
  "contactFeedItem",
  "pet",
  "goal",
  "gift",
  "call",
  "lifeEvent",
  "file",
  "contactQuickFact",
  "auditLog",
  "moodTrackingEvent",
  "photo",
  "externalIdentity",
  "contactFieldProvenance",
] as const;

describe("merge server actions", () => {
  let mockTx: typeof mockDb;

  beforeEach(() => {
    vi.clearAllMocks();

    const createModelMock = () => ({
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    });

    mockTx = {
      userVault: { findFirst: vi.fn() },
      contact: createModelMock(),
      note: createModelMock(),
      address: createModelMock(),
      contactInformation: createModelMock(),
      contactImportantDate: createModelMock(),
      contactReminder: createModelMock(),
      contactTask: createModelMock(),
      activity: createModelMock(),
      contactFeedItem: createModelMock(),
      pet: createModelMock(),
      goal: createModelMock(),
      gift: createModelMock(),
      call: createModelMock(),
      lifeEvent: createModelMock(),
      file: createModelMock(),
      contactQuickFact: createModelMock(),
      auditLog: createModelMock(),
      moodTrackingEvent: createModelMock(),
      photo: createModelMock(),
      externalIdentity: createModelMock(),
      contactFieldProvenance: createModelMock(),
      relationship: createModelMock(),
      contactLabel: createModelMock(),
      contactGroup: createModelMock(),
      contactTag: createModelMock(),
      loan: createModelMock(),
      contactMergeLog: createModelMock(),
      $transaction: vi.fn(),
    };

    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.userVault.findFirst.mockResolvedValue({ vault: { id: "vault-1" } });

    mockDb.contact.findFirst.mockResolvedValue({ id: "contact-1" });
    mockDb.contactMergeLog.findMany.mockResolvedValue([]);
    mockDb.contactMergeLog.findUnique.mockResolvedValue(null);

    mockDb.$transaction = vi.fn(async (fn) => fn(mockTx));

    mockTx.contact.findMany.mockResolvedValue([
      {
        id: "contact-primary",
        firstName: "Primary",
        lastName: "User",
        middleName: null,
        nickname: null,
        maidenName: null,
        prefix: null,
        suffix: null,
        jobPosition: "Lead",
        companyId: null,
        genderId: null,
        pronounId: null,
        religionId: null,
      },
      {
        id: "contact-secondary",
        firstName: "Secondary",
        lastName: "User",
        middleName: "M",
        nickname: "Sec",
        maidenName: "Old",
        prefix: "Ms",
        suffix: "Jr",
        jobPosition: "Manager",
        companyId: "company-2",
        genderId: "gender-2",
        pronounId: "pronoun-2",
        religionId: "religion-2",
      },
    ]);

    mockTx.contactMergeLog.create.mockResolvedValue({
      id: "merge-log-1",
      action: "merge",
      primaryContactId: "contact-primary",
      secondaryContactId: "contact-secondary",
    });
  });

  it("mergeContacts returns error when IDs are missing", async () => {
    const result = await mergeContacts("", "contact-secondary");

    expect(result).toEqual({ success: false, error: "Both contact IDs are required" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("mergeContacts rejects merging a contact into itself", async () => {
    const result = await mergeContacts("contact-1", "contact-1");

    expect(result).toEqual({ success: false, error: "Cannot merge a contact into itself" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("mergeContacts requires both contacts to exist in the same vault", async () => {
    mockTx.contact.findMany.mockResolvedValue([{ id: "contact-primary" }]);

    const result = await mergeContacts("contact-primary", "contact-secondary");

    expect(result).toEqual({
      success: false,
      error: "One or both contacts were not found in your vault",
    });
  });

  it("mergeContacts successfully transfers selected fields", async () => {
    const result = await mergeContacts("contact-primary", "contact-secondary", {
      fieldsFromSecondary: ["firstName", "nickname", "invalidField"],
    });

    expect(result.success).toBe(true);
    expect(mockTx.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-primary" },
      data: { firstName: "Secondary", nickname: "Sec" },
    });
  });

  it("mergeContacts successfully merges without field transfer", async () => {
    const result = await mergeContacts("contact-primary", "contact-secondary");

    expect(result.success).toBe(true);
    expect(mockTx.contactMergeLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mergedFields: Prisma.JsonNull,
        }),
      })
    );
  });

  it("mergeContacts transfers all supported relation records", async () => {
    await mergeContacts("contact-primary", "contact-secondary");

    for (const model of RELATION_MODELS) {
      expect(mockTx[model].updateMany).toHaveBeenCalledWith({
        where: { contactId: "contact-secondary" },
        data: { contactId: "contact-primary" },
      });
    }

    expect(mockTx.relationship.updateMany).toHaveBeenCalledTimes(2);
    expect(mockTx.relationship.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        contactId: "contact-secondary",
        NOT: { relatedContactId: "contact-primary" },
      },
      data: { contactId: "contact-primary" },
    });
    expect(mockTx.relationship.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        relatedContactId: "contact-secondary",
        NOT: { contactId: "contact-primary" },
      },
      data: { relatedContactId: "contact-primary" },
    });
    expect(mockTx.loan.updateMany).toHaveBeenCalledTimes(2);
  });

  it("mergeContacts deduplicates labels, groups, and tags", async () => {
    mockTx.contactLabel.findMany
      .mockResolvedValueOnce([{ labelId: "label-1" }])
      .mockResolvedValueOnce([{ labelId: "label-1" }, { labelId: "label-2" }]);

    mockTx.contactGroup.findMany
      .mockResolvedValueOnce([{ groupId: "group-1" }])
      .mockResolvedValueOnce([
        { groupId: "group-1", roleId: "role-1" },
        { groupId: "group-2", roleId: "role-2" },
      ]);

    mockTx.contactTag.findMany
      .mockResolvedValueOnce([{ tagId: "tag-1" }])
      .mockResolvedValueOnce([{ tagId: "tag-1" }, { tagId: "tag-2" }]);

    await mergeContacts("contact-primary", "contact-secondary");

    expect(mockTx.contactLabel.createMany).toHaveBeenCalledWith({
      data: [{ contactId: "contact-primary", labelId: "label-2" }],
    });
    expect(mockTx.contactGroup.createMany).toHaveBeenCalledWith({
      data: [{ contactId: "contact-primary", groupId: "group-2", roleId: "role-2" }],
    });
    expect(mockTx.contactTag.createMany).toHaveBeenCalledWith({
      data: [{ contactId: "contact-primary", tagId: "tag-2" }],
    });
  });

  it("mergeContacts soft-deletes the secondary contact", async () => {
    await mergeContacts("contact-primary", "contact-secondary");

    expect(mockTx.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-secondary" },
      data: {
        deletedAt: expect.any(Date),
        listed: false,
      },
    });
  });

  it("mergeContacts creates a merge log entry", async () => {
    await mergeContacts("contact-primary", "contact-secondary", {
      fieldsFromSecondary: ["firstName"],
    });

    expect(mockTx.contactMergeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "merge",
        primaryContactId: "contact-primary",
        secondaryContactId: "contact-secondary",
        mergedBy: "user-1",
        reason: "manual",
        mergedFields: {
          fieldsFromSecondary: ["firstName"],
          values: { firstName: "Secondary" },
        },
      }),
    });
  });

  it("unmergeContacts returns error when merge log ID is missing", async () => {
    const result = await unmergeContacts("");

    expect(result).toEqual({ success: false, error: "Merge log ID is required" });
    expect(mockDb.contactMergeLog.findUnique).not.toHaveBeenCalled();
  });

  it("unmergeContacts returns error when merge log is not found", async () => {
    mockDb.contactMergeLog.findUnique.mockResolvedValue(null);

    const result = await unmergeContacts("merge-log-1");

    expect(result).toEqual({ success: false, error: "Merge log entry not found" });
  });

  it("unmergeContacts enforces vault scoping", async () => {
    mockDb.contactMergeLog.findUnique.mockResolvedValue({
      id: "merge-log-1",
      primaryContactId: "contact-primary",
      secondaryContactId: "contact-secondary",
      primaryContact: { id: "contact-primary", vaultId: "vault-2" },
      secondaryContact: { id: "contact-secondary" },
    });

    const result = await unmergeContacts("merge-log-1");

    expect(result).toEqual({ success: false, error: "Merge log entry not found" });
  });

  it("unmergeContacts restores the secondary contact", async () => {
    mockDb.contactMergeLog.findUnique.mockResolvedValue({
      id: "merge-log-1",
      primaryContactId: "contact-primary",
      secondaryContactId: "contact-secondary",
      primaryContact: { id: "contact-primary", vaultId: "vault-1" },
      secondaryContact: { id: "contact-secondary" },
    });

    const result = await unmergeContacts("merge-log-1");

    expect(result).toEqual({ success: true });
    expect(mockTx.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-secondary" },
      data: {
        deletedAt: null,
        listed: true,
      },
    });
    expect(mockTx.contactMergeLog.create).toHaveBeenCalledWith({
      data: {
        action: "unmerge",
        primaryContactId: "contact-primary",
        secondaryContactId: "contact-secondary",
        mergedBy: "user-1",
        reason: "manual",
      },
    });
  });

  it("getMergeHistory returns empty array when no history exists", async () => {
    mockDb.contact.findFirst.mockResolvedValue(null);

    const result = await getMergeHistory("contact-primary");

    expect(result).toEqual([]);
    expect(mockDb.contactMergeLog.findMany).not.toHaveBeenCalled();
  });

  it("getMergeHistory returns merge entries for a contact", async () => {
    const history = [
      {
        id: "merge-log-1",
        action: "merge",
        primaryContactId: "contact-primary",
        secondaryContactId: "contact-secondary",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    mockDb.contact.findFirst.mockResolvedValue({ id: "contact-primary" });
    mockDb.contactMergeLog.findMany.mockResolvedValue(history);

    const result = await getMergeHistory("contact-primary");

    expect(result).toEqual(history);
    expect(mockDb.contactMergeLog.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ primaryContactId: "contact-primary" }, { secondaryContactId: "contact-primary" }],
      },
      include: {
        primaryContact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        secondaryContact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });
});
