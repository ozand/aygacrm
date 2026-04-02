"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// Helper to get current user's vault and account
async function getUserVaultAndAccount() {
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

  return {
    userId: session.user.id,
    vault: userVault.vault,
    accountId: userVault.vault.accountId,
  };
}

// Get gifts for a contact
export async function getGiftsForContact(contactId: string) {
  try {
    const { vault } = await getUserVaultAndAccount();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const gifts = await db.gift.findMany({
      where: { contactId },
      include: { occasion: true },
      orderBy: { createdAt: "desc" },
    });

    return gifts;
  } catch (error) {
    console.error("Error fetching gifts:", error);
    return [];
  }
}

// Get gift occasions
export async function getGiftOccasions() {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const occasions = await db.giftOccasion.findMany({
      where: { accountId },
      orderBy: { position: "asc" },
    });

    return occasions;
  } catch (error) {
    console.error("Error fetching gift occasions:", error);
    return [];
  }
}

// Create a gift
export async function createGift(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVaultAndAccount();

    const contactId = formData.get("contactId") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const amountStr = formData.get("amount") as string | null;
    const currency = formData.get("currency") as string | null;
    const url = formData.get("url") as string | null;
    const status = formData.get("status") as string;
    const dateStr = formData.get("date") as string | null;
    const occasionId = formData.get("occasionId") as string | null;

    if (!contactId || !name) {
      return { success: false, error: "Name is required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const gift = await db.gift.create({
      data: {
        contactId,
        name: name.trim(),
        description: description?.trim() || null,
        amount: amountStr ? parseFloat(amountStr) : null,
        currency: currency || null,
        url: url?.trim() || null,
        status: status || "idea",
        date: dateStr ? new Date(dateStr) : null,
        occasionId: occasionId || null,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: gift };
  } catch (error) {
    console.error("Error creating gift:", error);
    return { success: false, error: "Failed to create gift" };
  }
}

// Update gift status
export async function updateGiftStatus(
  id: string,
  status: string
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVaultAndAccount();

    // Verify gift belongs to user's vault
    const gift = await db.gift.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!gift || gift.contact.vaultId !== vault.id) {
      return { success: false, error: "Gift not found" };
    }

    await db.gift.update({
      where: { id },
      data: { status },
    });

    revalidatePath(`/contacts/${gift.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating gift status:", error);
    return { success: false, error: "Failed to update gift" };
  }
}

// Delete a gift
export async function deleteGift(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVaultAndAccount();

    // Verify gift belongs to user's vault
    const gift = await db.gift.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!gift || gift.contact.vaultId !== vault.id) {
      return { success: false, error: "Gift not found" };
    }

    const contactId = gift.contactId;

    await db.gift.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting gift:", error);
    return { success: false, error: "Failed to delete gift" };
  }
}

// Create a gift occasion
export async function createGiftOccasion(label: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    // Get the highest position
    const lastOccasion = await db.giftOccasion.findFirst({
      where: { accountId },
      orderBy: { position: "desc" },
    });

    const occasion = await db.giftOccasion.create({
      data: {
        accountId,
        label: label.trim(),
        position: lastOccasion ? lastOccasion.position + 1 : 0,
      },
    });

    return { success: true, data: occasion };
  } catch (error) {
    console.error("Error creating gift occasion:", error);
    return { success: false, error: "Failed to create gift occasion" };
  }
}

// Update a gift occasion
export async function updateGiftOccasion(
  id: string,
  label: string
): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const existing = await db.giftOccasion.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      return { success: false, error: "Gift occasion not found" };
    }

    const occasion = await db.giftOccasion.update({
      where: { id },
      data: { label: label.trim() },
    });

    return { success: true, data: occasion };
  } catch (error) {
    console.error("Error updating gift occasion:", error);
    return { success: false, error: "Failed to update gift occasion" };
  }
}

// Delete a gift occasion
export async function deleteGiftOccasion(id: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const existing = await db.giftOccasion.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      return { success: false, error: "Gift occasion not found" };
    }

    await db.giftOccasion.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting gift occasion:", error);
    return { success: false, error: "Failed to delete gift occasion" };
  }
}

// Seed default gift occasions
export async function seedGiftOccasions(): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    // Check if occasions already exist
    const existing = await db.giftOccasion.findFirst({
      where: { accountId },
    });

    if (existing) {
      return { success: true, data: { message: "Gift occasions already exist" } };
    }

    // Create default occasions
    await db.giftOccasion.createMany({
      data: [
        { accountId, label: "Birthday", position: 0 },
        { accountId, label: "Christmas", position: 1 },
        { accountId, label: "Anniversary", position: 2 },
        { accountId, label: "Wedding", position: 3 },
        { accountId, label: "Graduation", position: 4 },
        { accountId, label: "Valentine's Day", position: 5 },
        { accountId, label: "Mother's Day", position: 6 },
        { accountId, label: "Father's Day", position: 7 },
        { accountId, label: "Just Because", position: 8 },
      ],
    });

    return { success: true, data: { message: "Gift occasions seeded" } };
  } catch (error) {
    console.error("Error seeding gift occasions:", error);
    return { success: false, error: "Failed to seed gift occasions" };
  }
}
