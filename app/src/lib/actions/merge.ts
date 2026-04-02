"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

const MERGEABLE_FIELDS = [
  "firstName",
  "lastName",
  "middleName",
  "nickname",
  "maidenName",
  "prefix",
  "suffix",
  "jobPosition",
  "companyId",
  "genderId",
  "pronounId",
  "religionId",
] as const;

type MergeableField = (typeof MERGEABLE_FIELDS)[number];

// Helper to get current user's vault
async function getUserVault() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });

  if (!userVault) {
    throw new Error("No vault found for user");
  }

  return { userId: session.user.id, vault: userVault.vault };
}

export async function mergeContacts(
  primaryContactId: string,
  secondaryContactId: string,
  options?: { fieldsFromSecondary?: string[] }
): Promise<ActionResult> {
  try {
    const { userId, vault } = await getUserVault();

    if (!primaryContactId || !secondaryContactId) {
      return { success: false, error: "Both contact IDs are required" };
    }

    if (primaryContactId === secondaryContactId) {
      return { success: false, error: "Cannot merge a contact into itself" };
    }

    const fieldsToCopy = (options?.fieldsFromSecondary ?? []).filter((field): field is MergeableField =>
      (MERGEABLE_FIELDS as readonly string[]).includes(field)
    );

    const result = await db.$transaction(async (tx) => {
      const contacts = await tx.contact.findMany({
        where: {
          id: { in: [primaryContactId, secondaryContactId] },
          vaultId: vault.id,
          deletedAt: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          nickname: true,
          maidenName: true,
          prefix: true,
          suffix: true,
          jobPosition: true,
          companyId: true,
          genderId: true,
          pronounId: true,
          religionId: true,
        },
      });

      if (contacts.length !== 2) {
        throw new Error("One or both contacts were not found in your vault");
      }

      const primaryContact = contacts.find((contact) => contact.id === primaryContactId);
      const secondaryContact = contacts.find((contact) => contact.id === secondaryContactId);

      if (!primaryContact || !secondaryContact) {
        throw new Error("One or both contacts were not found in your vault");
      }

      const mergedFieldValues: Partial<Record<MergeableField, string | null>> = {};

      if (fieldsToCopy.length > 0) {
        const primaryUpdate: Record<string, string | null> = {};

        for (const field of fieldsToCopy) {
          const value = secondaryContact[field];
          mergedFieldValues[field] = value;
          primaryUpdate[field] = value;
        }

        if (Object.keys(primaryUpdate).length > 0) {
          await tx.contact.update({
            where: { id: primaryContactId },
            data: primaryUpdate,
          });
        }
      }

      await Promise.all([
        tx.note.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.address.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.contactInformation.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.contactImportantDate.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.contactReminder.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.contactTask.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.activity.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.contactFeedItem.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.pet.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.goal.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.gift.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.call.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.lifeEvent.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.file.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.contactQuickFact.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.auditLog.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.moodTrackingEvent.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.photo.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.externalIdentity.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
        tx.contactFieldProvenance.updateMany({
          where: { contactId: secondaryContactId },
          data: { contactId: primaryContactId },
        }),
      ]);

      await tx.relationship.updateMany({
        where: {
          contactId: secondaryContactId,
          NOT: { relatedContactId: primaryContactId },
        },
        data: { contactId: primaryContactId },
      });

      await tx.relationship.updateMany({
        where: {
          relatedContactId: secondaryContactId,
          NOT: { contactId: primaryContactId },
        },
        data: { relatedContactId: primaryContactId },
      });

      const [primaryLabels, secondaryLabels] = await Promise.all([
        tx.contactLabel.findMany({
          where: { contactId: primaryContactId },
          select: { labelId: true },
        }),
        tx.contactLabel.findMany({
          where: { contactId: secondaryContactId },
          select: { labelId: true },
        }),
      ]);

      const existingLabelIds = new Set(primaryLabels.map((item) => item.labelId));
      const labelsToCreate = secondaryLabels
        .filter((item) => !existingLabelIds.has(item.labelId))
        .map((item) => ({ contactId: primaryContactId, labelId: item.labelId }));

      if (labelsToCreate.length > 0) {
        await tx.contactLabel.createMany({ data: labelsToCreate });
      }

      await tx.contactLabel.deleteMany({ where: { contactId: secondaryContactId } });

      const [primaryGroups, secondaryGroups] = await Promise.all([
        tx.contactGroup.findMany({
          where: { contactId: primaryContactId },
          select: { groupId: true },
        }),
        tx.contactGroup.findMany({
          where: { contactId: secondaryContactId },
          select: { groupId: true, roleId: true },
        }),
      ]);

      const existingGroupIds = new Set(primaryGroups.map((item) => item.groupId));
      const groupsToCreate = secondaryGroups
        .filter((item) => !existingGroupIds.has(item.groupId))
        .map((item) => ({
          contactId: primaryContactId,
          groupId: item.groupId,
          roleId: item.roleId,
        }));

      if (groupsToCreate.length > 0) {
        await tx.contactGroup.createMany({ data: groupsToCreate });
      }

      await tx.contactGroup.deleteMany({ where: { contactId: secondaryContactId } });

      const [primaryTags, secondaryTags] = await Promise.all([
        tx.contactTag.findMany({
          where: { contactId: primaryContactId },
          select: { tagId: true },
        }),
        tx.contactTag.findMany({
          where: { contactId: secondaryContactId },
          select: { tagId: true },
        }),
      ]);

      const existingTagIds = new Set(primaryTags.map((item) => item.tagId));
      const tagsToCreate = secondaryTags
        .filter((item) => !existingTagIds.has(item.tagId))
        .map((item) => ({ contactId: primaryContactId, tagId: item.tagId }));

      if (tagsToCreate.length > 0) {
        await tx.contactTag.createMany({ data: tagsToCreate });
      }

      await tx.contactTag.deleteMany({ where: { contactId: secondaryContactId } });

      await Promise.all([
        tx.loan.updateMany({
          where: { loanerId: secondaryContactId },
          data: { loanerId: primaryContactId },
        }),
        tx.loan.updateMany({
          where: { loaneeId: secondaryContactId },
          data: { loaneeId: primaryContactId },
        }),
      ]);

      await tx.contact.update({
        where: { id: secondaryContactId },
        data: {
          deletedAt: new Date(),
          listed: false,
        },
      });

      const mergeLog = await tx.contactMergeLog.create({
        data: {
          action: "merge",
          primaryContactId,
          secondaryContactId,
          mergedFields:
            fieldsToCopy.length > 0
              ? ({
                  fieldsFromSecondary: fieldsToCopy,
                  values: mergedFieldValues,
                } as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          mergedBy: userId,
          reason: "manual",
        },
      });

      return mergeLog;
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${primaryContactId}`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error merging contacts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to merge contacts",
    };
  }
}

export async function unmergeContacts(mergeLogId: string): Promise<ActionResult> {
  try {
    const { userId, vault } = await getUserVault();

    if (!mergeLogId) {
      return { success: false, error: "Merge log ID is required" };
    }

    const mergeLog = await db.contactMergeLog.findUnique({
      where: { id: mergeLogId },
      include: {
        primaryContact: {
          select: { id: true, vaultId: true },
        },
        secondaryContact: {
          select: { id: true },
        },
      },
    });

    if (!mergeLog || mergeLog.primaryContact.vaultId !== vault.id) {
      return { success: false, error: "Merge log entry not found" };
    }

    await db.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id: mergeLog.secondaryContactId },
        data: {
          deletedAt: null,
          listed: true,
        },
      });

      await tx.contactMergeLog.create({
        data: {
          action: "unmerge",
          primaryContactId: mergeLog.primaryContactId,
          secondaryContactId: mergeLog.secondaryContactId,
          mergedBy: userId,
          reason: "manual",
        },
      });
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${mergeLog.primaryContactId}`);
    revalidatePath(`/contacts/${mergeLog.secondaryContactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error unmerging contacts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to unmerge contacts",
    };
  }
}

export async function getMergeHistory(contactId: string) {
  try {
    const { vault } = await getUserVault();

    if (!contactId) {
      return [];
    }

    const contact = await db.contact.findFirst({
      where: {
        id: contactId,
        vaultId: vault.id,
      },
      select: { id: true },
    });

    if (!contact) {
      return [];
    }

    const history = await db.contactMergeLog.findMany({
      where: {
        OR: [{ primaryContactId: contactId }, { secondaryContactId: contactId }],
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

    return history;
  } catch (error) {
    console.error("Error fetching merge history:", error);
    return [];
  }
}
