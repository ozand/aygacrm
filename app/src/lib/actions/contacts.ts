"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Types
export interface ContactFormData {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  nickname?: string;
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

// Get all contacts for current user's vault with optional search
export async function getContacts(searchQuery?: string) {
  try {
    const { vault } = await getUserVault();

    // Base where clause
    const baseWhere = {
      vaultId: vault.id,
      deletedAt: null,
      listed: true,
      canBeDeleted: true, // Exclude user's "self" contact
    };

    // Add search conditions if query provided
    const where = searchQuery
      ? {
          ...baseWhere,
          OR: [
            { firstName: { contains: searchQuery, mode: "insensitive" as const } },
            { lastName: { contains: searchQuery, mode: "insensitive" as const } },
            { nickname: { contains: searchQuery, mode: "insensitive" as const } },
            { jobPosition: { contains: searchQuery, mode: "insensitive" as const } },
            {
              contactInformation: {
                some: {
                  data: { contains: searchQuery, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : baseWhere;

    const contacts = await db.contact.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        contactInformation: {
          include: { type: true },
        },
        labels: {
          include: { label: true },
        },
      },
    });

    return contacts;
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return [];
  }
}

// Search contacts (wrapper for client components)
export async function searchContacts(query: string) {
  return getContacts(query);
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
    const { vault } = await getUserVault();

    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const middleName = formData.get("middleName") as string;
    const nickname = formData.get("nickname") as string;
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
    const { vault } = await getUserVault();

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
    const prefix = formData.get("prefix") as string;
    const suffix = formData.get("suffix") as string;
    const jobPosition = formData.get("jobPosition") as string;

    const contact = await db.contact.update({
      where: { id },
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        middleName: middleName || null,
        nickname: nickname || null,
        prefix: prefix || null,
        suffix: suffix || null,
        jobPosition: jobPosition || null,
        lastUpdatedAt: new Date(),
      },
    });

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
