"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordProvenance } from "@/lib/actions/provenance";

// Types
export interface ContactFormData {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  nickname?: string;
  maidenName?: string;
  prefix?: string;
  suffix?: string;
  jobPosition?: string;
  email?: string;
  phone?: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export interface ContactListOptions {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "updated" | "created";
  sortOrder?: "asc" | "desc";
  labelId?: string;
  groupId?: string;
}

export interface ContactListResult {
  contacts: Awaited<ReturnType<typeof db.contact.findMany>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

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

// Get all contacts for current user's vault with filters, sorting, and pagination
export async function getContacts(
  options: ContactListOptions = {}
): Promise<ContactListResult> {
  try {
    const { vault } = await getUserVault();

    const {
      search,
      page = 1,
      pageSize = 24,
      sortBy = "name",
      sortOrder = "asc",
      labelId,
      groupId,
    } = options;

    // Base where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseWhere: any = {
      vaultId: vault.id,
      deletedAt: null,
      listed: true,
      canBeDeleted: true, // Exclude user's "self" contact
    };

    // Add label filter
    if (labelId) {
      baseWhere.labels = { some: { labelId } };
    }

    // Add group filter
    if (groupId) {
      baseWhere.groupContacts = { some: { groupId } };
    }

    // Add search conditions
    const where = search
      ? {
          ...baseWhere,
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { nickname: { contains: search, mode: "insensitive" as const } },
            { jobPosition: { contains: search, mode: "insensitive" as const } },
            {
              contactInformation: {
                some: {
                  data: { contains: search, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : baseWhere;

    // Build orderBy
    const orderBy =
      sortBy === "updated"
        ? [{ lastUpdatedAt: sortOrder }]
        : sortBy === "created"
          ? [{ createdAt: sortOrder }]
          : [{ firstName: sortOrder }, { lastName: sortOrder }];

    // Get total count and paginated results in parallel
    const [total, contacts] = await Promise.all([
      db.contact.count({ where }),
      db.contact.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contactInformation: {
            include: { type: true },
          },
          labels: {
            include: { label: true },
          },
        },
      }),
    ]);

    return {
      contacts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return { contacts: [], total: 0, page: 1, pageSize: 24, totalPages: 0 };
  }
}

// Search contacts (wrapper for client components)
export async function searchContacts(query: string) {
  return getContacts({ search: query });
}

// Get all labels for filtering
export async function getLabels() {
  try {
    const { vault } = await getUserVault();
    return await db.label.findMany({
      where: { vaultId: vault.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { contacts: true } } },
    });
  } catch {
    return [];
  }
}

// Get all groups for filtering
export async function getGroups() {
  try {
    const { vault } = await getUserVault();
    return await db.group.findMany({
      where: { vaultId: vault.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { contacts: true } } },
    });
  } catch {
    return [];
  }
}

// Get single contact by ID
export async function getContact(id: string) {
  try {
    const { vault } = await getUserVault();

    const contact = await db.contact.findFirst({
      where: {
        id,
        vaultId: vault.id,
        deletedAt: null,
      },
      include: {
        contactInformation: {
          include: { type: true },
        },
        addresses: {
          include: { addressType: true },
        },
        importantDates: {
          include: { type: true },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        labels: {
          include: { label: true },
        },
        company: true,
        gender: true,
        pronoun: true,
        religion: true,
      },
    });

    return contact;
  } catch (error) {
    console.error("Error fetching contact:", error);
    return null;
  }
}

// Create new contact
export async function createContact(formData: FormData): Promise<ActionResult> {
  try {
    const { userId, vault } = await getUserVault();

    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const middleName = formData.get("middleName") as string;
    const nickname = formData.get("nickname") as string;
    const maidenName = formData.get("maidenName") as string;
    const prefix = formData.get("prefix") as string;
    const suffix = formData.get("suffix") as string;
    const jobPosition = formData.get("jobPosition") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;

    // Validate - at least first or last name required
    if (!firstName && !lastName && !nickname) {
      return {
        success: false,
        error: "At least a first name, last name, or nickname is required",
      };
    }

    // Create contact
    const contact = await db.contact.create({
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        middleName: middleName || null,
        nickname: nickname || null,
        maidenName: maidenName || null,
        prefix: prefix || null,
        suffix: suffix || null,
        jobPosition: jobPosition || null,
        vaultId: vault.id,
        listed: true,
        canBeDeleted: true,
      },
    });

    // Add email if provided
    if (email) {
      // Find or create email type
      let emailType = await db.contactInformationType.findFirst({
        where: { type: "email" },
      });

      if (!emailType) {
        emailType = await db.contactInformationType.create({
          data: {
            accountId: vault.accountId,
            name: "Email",
            protocol: "mailto:",
            type: "email",
          },
        });
      }

      await db.contactInformation.create({
        data: {
          contactId: contact.id,
          typeId: emailType.id,
          data: email,
          label: "Personal",
        },
      });
    }

    // Add phone if provided
    if (phone) {
      let phoneType = await db.contactInformationType.findFirst({
        where: { type: "phone" },
      });

      if (!phoneType) {
        phoneType = await db.contactInformationType.create({
          data: {
            accountId: vault.accountId,
            name: "Phone",
            protocol: "tel:",
            type: "phone",
          },
        });
      }

      await db.contactInformation.create({
        data: {
          contactId: contact.id,
          typeId: phoneType.id,
          data: phone,
          label: "Mobile",
        },
      });
    }

    try {
      const trackedFields = {
        firstName: firstName || null,
        lastName: lastName || null,
        middleName: middleName || null,
        nickname: nickname || null,
        maidenName: maidenName || null,
        prefix: prefix || null,
        suffix: suffix || null,
        jobPosition: jobPosition || null,
      };

      const fieldsWithValues = Object.fromEntries(
        Object.entries(trackedFields).filter(([, value]) => value !== null)
      );

      if (Object.keys(fieldsWithValues).length > 0) {
        await recordProvenance(contact.id, fieldsWithValues, "manual", userId);
      }
    } catch (provenanceError) {
      console.error("Error recording contact provenance during create:", provenanceError);
    }

    revalidatePath("/contacts");
    
    return { success: true, data: contact };
  } catch (error) {
    console.error("Error creating contact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create contact",
    };
  }
}

// Update contact
export async function updateContact(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { userId, vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const existingContact = await db.contact.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!existingContact) {
      return { success: false, error: "Contact not found" };
    }

    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const middleName = formData.get("middleName") as string;
    const nickname = formData.get("nickname") as string;
    const maidenName = formData.get("maidenName") as string;
    const prefix = formData.get("prefix") as string;
    const suffix = formData.get("suffix") as string;
    const jobPosition = formData.get("jobPosition") as string;

    const updatedFields = {
      firstName: firstName || null,
      lastName: lastName || null,
      middleName: middleName || null,
      nickname: nickname || null,
      maidenName: maidenName || null,
      prefix: prefix || null,
      suffix: suffix || null,
      jobPosition: jobPosition || null,
    };

    const changedFields = Object.fromEntries(
      Object.entries(updatedFields).filter(([field, value]) => {
        const existingValue = existingContact[field as keyof typeof updatedFields] as string | null;
        return existingValue !== value;
      })
    ) as Record<string, string | null>;

    const contact = await db.contact.update({
      where: { id },
      data: {
        ...updatedFields,
        lastUpdatedAt: new Date(),
      },
    });

    if (Object.keys(changedFields).length > 0) {
      try {
        await recordProvenance(id, changedFields, "manual", userId);
      } catch (provenanceError) {
        console.error("Error recording contact provenance during update:", provenanceError);
      }
    }

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);

    return { success: true, data: contact };
  } catch (error) {
    console.error("Error updating contact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update contact",
    };
  }
}

// Delete contact (soft delete)
export async function deleteContact(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault and can be deleted
    const contact = await db.contact.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    if (!contact.canBeDeleted) {
      return { success: false, error: "This contact cannot be deleted" };
    }

    // Soft delete
    await db.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/contacts");

    return { success: true };
  } catch (error) {
    console.error("Error deleting contact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete contact",
    };
  }
}

// Permanently delete contact
export async function permanentlyDeleteContact(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contact = await db.contact.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    if (!contact.canBeDeleted) {
      return { success: false, error: "This contact cannot be deleted" };
    }

    await db.contact.delete({
      where: { id },
    });

    revalidatePath("/contacts");

    return { success: true };
  } catch (error) {
    console.error("Error permanently deleting contact:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete contact",
    };
  }
}

// Restore soft-deleted contact
export async function restoreContact(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contact = await db.contact.findFirst({
      where: { id, vaultId: vault.id, deletedAt: { not: null } },
    });

    if (!contact) {
      return { success: false, error: "Contact not found or not deleted" };
    }

    await db.contact.update({
      where: { id },
      data: { deletedAt: null },
    });

    revalidatePath("/contacts");

    return { success: true };
  } catch (error) {
    console.error("Error restoring contact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore contact",
    };
  }
}

// Toggle favorite status
export async function toggleFavorite(contactId: string): Promise<ActionResult> {
  try {
    const { userId, vault } = await getUserVault();

    // Check if record exists
    const existing = await db.contactVaultUser.findUnique({
      where: {
        contactId_vaultId_userId: {
          contactId,
          vaultId: vault.id,
          userId,
        },
      },
    });

    if (existing) {
      await db.contactVaultUser.update({
        where: {
          contactId_vaultId_userId: {
            contactId,
            vaultId: vault.id,
            userId,
          },
        },
        data: { isFavorite: !existing.isFavorite },
      });
    } else {
      await db.contactVaultUser.create({
        data: {
          contactId,
          vaultId: vault.id,
          userId,
          isFavorite: true,
          numberOfViews: 1,
        },
      });
    }

    revalidatePath("/contacts");

    return { success: true };
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to toggle favorite",
    };
  }
}
