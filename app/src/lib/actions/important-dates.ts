"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

// Get important dates for a contact
export async function getImportantDatesForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const dates = await db.contactImportantDate.findMany({
      where: { contactId },
      orderBy: [{ month: "asc" }, { day: "asc" }],
      include: { type: true },
    });

    return dates;
  } catch (error) {
    console.error("Error fetching important dates:", error);
    return [];
  }
}

// Get upcoming birthdays/dates for all contacts
export async function getUpcomingDates(daysAhead: number = 30) {
  try {
    const { vault } = await getUserVault();

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // Get all important dates
    const allDates = await db.contactImportantDate.findMany({
      where: {
        contact: {
          vaultId: vault.id,
          deletedAt: null,
          listed: true,
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
        type: true,
      },
    });

    // Calculate days until each date and filter
    const upcomingDates = allDates
      .map((date) => {
        if (!date.month || !date.day) return null;

        let daysUntil: number;
        const dateThisYear = new Date(today.getFullYear(), date.month - 1, date.day);
        const dateNextYear = new Date(today.getFullYear() + 1, date.month - 1, date.day);

        if (dateThisYear >= today) {
          daysUntil = Math.ceil(
            (dateThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
        } else {
          daysUntil = Math.ceil(
            (dateNextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        if (daysUntil > daysAhead) return null;

        const contactName =
          [date.contact.firstName, date.contact.lastName]
            .filter(Boolean)
            .join(" ") ||
          date.contact.nickname ||
          "Unnamed";

        // Calculate age if year is known
        let age: number | null = null;
        if (date.year) {
          age = today.getFullYear() - date.year;
          if (daysUntil > 0) age--; // Birthday hasn't happened yet this year
        }

        return {
          id: date.id,
          contactId: date.contact.id,
          contactName,
          label: date.label || date.type?.name || "Important Date",
          typeName: date.type?.type || "other",
          day: date.day,
          month: date.month,
          year: date.year,
          age: age !== null ? age + 1 : null, // Age they will turn
          daysUntil,
          isToday: daysUntil === 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.daysUntil - b!.daysUntil);

    return upcomingDates;
  } catch (error) {
    console.error("Error fetching upcoming dates:", error);
    return [];
  }
}

// Create important date
export async function createImportantDate(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const label = formData.get("label") as string;
    const day = formData.get("day") as string;
    const month = formData.get("month") as string;
    const year = formData.get("year") as string;
    const typeId = formData.get("typeId") as string;
    const dateType = formData.get("dateType") as string;

    if (!contactId) {
      return { success: false, error: "Contact ID is required" };
    }

    if (!day || !month) {
      return { success: false, error: "Day and month are required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    let resolvedTypeId: string | null = typeId || null;
    if (!resolvedTypeId && ["birthday", "anniversary", "other"].includes(dateType)) {
      let typeRow = await db.contactImportantDateType.findFirst({
        where: { accountId: vault.accountId, type: dateType },
      });
      if (!typeRow) {
        typeRow = await db.contactImportantDateType.create({
          data: {
            accountId: vault.accountId,
            name: dateType.charAt(0).toUpperCase() + dateType.slice(1),
            type: dateType,
          },
        });
      }
      resolvedTypeId = typeRow.id;
    }

    const importantDate = await db.contactImportantDate.create({
      data: {
        contactId,
        day: parseInt(day),
        month: parseInt(month),
        year: year ? parseInt(year) : null,
        label: label || null,
        typeId: resolvedTypeId,
      },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/dashboard");

    return { success: true, data: importantDate };
  } catch (error) {
    console.error("Error creating important date:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create important date",
    };
  }
}

// Update important date
export async function updateImportantDate(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const label = formData.get("label") as string;
    const day = formData.get("day") as string;
    const month = formData.get("month") as string;
    const year = formData.get("year") as string;

    // Verify date belongs to user's vault
    const existingDate = await db.contactImportantDate.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!existingDate || existingDate.contact.vaultId !== vault.id) {
      return { success: false, error: "Important date not found" };
    }

    const importantDate = await db.contactImportantDate.update({
      where: { id },
      data: {
        day: day ? parseInt(day) : null,
        month: month ? parseInt(month) : null,
        year: year ? parseInt(year) : null,
        label: label || null,
      },
    });

    revalidatePath(`/contacts/${existingDate.contactId}`);
    revalidatePath("/dashboard");

    return { success: true, data: importantDate };
  } catch (error) {
    console.error("Error updating important date:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update important date",
    };
  }
}

// Delete important date
export async function deleteImportantDate(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const date = await db.contactImportantDate.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!date || date.contact.vaultId !== vault.id) {
      return { success: false, error: "Important date not found" };
    }

    await db.contactImportantDate.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${date.contactId}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error deleting important date:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete important date",
    };
  }
}

// Get or create date type (birthday, anniversary, etc.)
export async function getOrCreateDateType(
  name: string,
  type: string = "other"
) {
  try {
    const { vault } = await getUserVault();

    let dateType = await db.contactImportantDateType.findFirst({
      where: {
        accountId: vault.accountId,
        type,
      },
    });

    if (!dateType) {
      dateType = await db.contactImportantDateType.create({
        data: {
          accountId: vault.accountId,
          name,
          type,
        },
      });
    }

    return dateType;
  } catch (error) {
    console.error("Error getting/creating date type:", error);
    return null;
  }
}

// Get all date types for account
export async function getDateTypes() {
  try {
    const { vault } = await getUserVault();

    const types = await db.contactImportantDateType.findMany({
      where: { accountId: vault.accountId },
      orderBy: { name: "asc" },
    });

    return types;
  } catch (error) {
    console.error("Error fetching date types:", error);
    return [];
  }
}
