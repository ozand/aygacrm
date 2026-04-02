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

  return {
    userId: session.user.id,
    vault: userVault.vault,
    accountId: userVault.vault.accountId,
  };
}

// Get life events for a contact
export async function getLifeEventsForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const lifeEvents = await db.lifeEvent.findMany({
      where: { contactId },
      include: {
        lifeEventType: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { happenedAt: "desc" },
    });

    return lifeEvents;
  } catch (error) {
    console.error("Error fetching life events:", error);
    return [];
  }
}

// Get life event categories with types
export async function getLifeEventCategories() {
  try {
    const { accountId } = await getUserVault();

    const categories = await db.lifeEventCategory.findMany({
      where: { accountId },
      include: {
        types: {
          orderBy: { position: "asc" },
        },
      },
      orderBy: { position: "asc" },
    });

    return categories;
  } catch (error) {
    console.error("Error fetching life event categories:", error);
    return [];
  }
}

// Create a life event
export async function createLifeEvent(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const summary = formData.get("summary") as string;
    const description = formData.get("description") as string | null;
    const happenedAtStr = formData.get("happenedAt") as string;
    const lifeEventTypeId = formData.get("lifeEventTypeId") as string | null;
    const costsStr = formData.get("costs") as string | null;
    const currency = formData.get("currency") as string | null;

    if (!contactId || !happenedAtStr) {
      return { success: false, error: "Date is required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const lifeEvent = await db.lifeEvent.create({
      data: {
        summary: summary?.trim() || null,
        description: description?.trim() || null,
        happenedAt: new Date(happenedAtStr),
        lifeEventTypeId: lifeEventTypeId || null,
        costs: costsStr ? parseFloat(costsStr) : null,
        currency: currency || null,
        contactId,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: lifeEvent };
  } catch (error) {
    console.error("Error creating life event:", error);
    return { success: false, error: "Failed to create life event" };
  }
}

// Update a life event
export async function updateLifeEvent(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const id = formData.get("id") as string;
    const summary = formData.get("summary") as string | null;
    const description = formData.get("description") as string | null;
    const happenedAtStr = formData.get("happenedAt") as string | null;
    const lifeEventTypeId = formData.get("lifeEventTypeId") as string | null;
    const costsStr = formData.get("costs") as string | null;
    const currency = formData.get("currency") as string | null;

    if (!id) {
      return { success: false, error: "Life event ID is required" };
    }

    // Get life event and verify ownership
    const lifeEvent = await db.lifeEvent.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!lifeEvent || lifeEvent.contact.vaultId !== vault.id) {
      return { success: false, error: "Life event not found" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (summary !== null) {
      updateData.summary = summary.trim() || null;
    }

    if (description !== null) {
      updateData.description = description.trim() || null;
    }

    if (happenedAtStr !== null) {
      updateData.happenedAt = new Date(happenedAtStr);
    }

    if (lifeEventTypeId !== null) {
      updateData.lifeEventTypeId = lifeEventTypeId || null;
    }

    if (costsStr !== null) {
      updateData.costs = costsStr ? parseFloat(costsStr) : null;
    }

    if (currency !== null) {
      updateData.currency = currency || null;
    }

    await db.lifeEvent.update({
      where: { id },
      data: updateData,
    });

    revalidatePath(`/contacts/${lifeEvent.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating life event:", error);
    return { success: false, error: "Failed to update life event" };
  }
}

// Delete a life event
export async function deleteLifeEvent(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify life event belongs to user's vault
    const lifeEvent = await db.lifeEvent.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!lifeEvent || lifeEvent.contact.vaultId !== vault.id) {
      return { success: false, error: "Life event not found" };
    }

    const contactId = lifeEvent.contactId;

    await db.lifeEvent.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting life event:", error);
    return { success: false, error: "Failed to delete life event" };
  }
}

// =====================================================
// Life Event Category CRUD
// =====================================================

// Create a life event category
export async function createLifeEventCategory(name: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVault();

    // Get the highest position
    const lastCategory = await db.lifeEventCategory.findFirst({
      where: { accountId },
      orderBy: { position: "desc" },
    });

    const category = await db.lifeEventCategory.create({
      data: {
        accountId,
        name: name.trim(),
        position: lastCategory ? lastCategory.position + 1 : 0,
      },
    });

    return { success: true, data: category };
  } catch (error) {
    console.error("Error creating life event category:", error);
    return { success: false, error: "Failed to create life event category" };
  }
}

// Update a life event category
export async function updateLifeEventCategory(
  id: string,
  name: string
): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVault();

    const existing = await db.lifeEventCategory.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      return { success: false, error: "Life event category not found" };
    }

    const category = await db.lifeEventCategory.update({
      where: { id },
      data: { name: name.trim() },
    });

    return { success: true, data: category };
  } catch (error) {
    console.error("Error updating life event category:", error);
    return { success: false, error: "Failed to update life event category" };
  }
}

// Delete a life event category
export async function deleteLifeEventCategory(id: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVault();

    const existing = await db.lifeEventCategory.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      return { success: false, error: "Life event category not found" };
    }

    await db.lifeEventCategory.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting life event category:", error);
    return { success: false, error: "Failed to delete life event category" };
  }
}

// =====================================================
// Life Event Type CRUD
// =====================================================

// Create a life event type
export async function createLifeEventType(
  categoryId: string,
  label: string
): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVault();

    // Verify category belongs to account
    const category = await db.lifeEventCategory.findFirst({
      where: { id: categoryId, accountId },
    });

    if (!category) {
      return { success: false, error: "Life event category not found" };
    }

    // Get the highest position
    const lastType = await db.lifeEventType.findFirst({
      where: { categoryId },
      orderBy: { position: "desc" },
    });

    const type = await db.lifeEventType.create({
      data: {
        categoryId,
        label: label.trim(),
        position: lastType ? lastType.position + 1 : 0,
      },
    });

    return { success: true, data: type };
  } catch (error) {
    console.error("Error creating life event type:", error);
    return { success: false, error: "Failed to create life event type" };
  }
}

// Update a life event type
export async function updateLifeEventType(
  id: string,
  label: string
): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVault();

    const existing = await db.lifeEventType.findFirst({
      where: { id },
      include: { category: true },
    });

    if (!existing || existing.category.accountId !== accountId) {
      return { success: false, error: "Life event type not found" };
    }

    const type = await db.lifeEventType.update({
      where: { id },
      data: { label: label.trim() },
    });

    return { success: true, data: type };
  } catch (error) {
    console.error("Error updating life event type:", error);
    return { success: false, error: "Failed to update life event type" };
  }
}

// Delete a life event type
export async function deleteLifeEventType(id: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVault();

    const existing = await db.lifeEventType.findFirst({
      where: { id },
      include: { category: true },
    });

    if (!existing || existing.category.accountId !== accountId) {
      return { success: false, error: "Life event type not found" };
    }

    await db.lifeEventType.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting life event type:", error);
    return { success: false, error: "Failed to delete life event type" };
  }
}

// Seed default life event categories and types
export async function seedLifeEventCategories(): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVault();

    // Check if categories already exist
    const existing = await db.lifeEventCategory.findFirst({
      where: { accountId },
    });

    if (existing) {
      return { success: true, data: { message: "Life event categories already exist" } };
    }

    // Create default categories with types
    const workCategory = await db.lifeEventCategory.create({
      data: { accountId, name: "Work & Education", position: 0 },
    });

    const familyCategory = await db.lifeEventCategory.create({
      data: { accountId, name: "Family & Relationships", position: 1 },
    });

    const homeCategory = await db.lifeEventCategory.create({
      data: { accountId, name: "Home & Living", position: 2 },
    });

    const travelCategory = await db.lifeEventCategory.create({
      data: { accountId, name: "Travel & Experiences", position: 3 },
    });

    const healthCategory = await db.lifeEventCategory.create({
      data: { accountId, name: "Health & Wellness", position: 4 },
    });

    // Create types for each category
    await db.lifeEventType.createMany({
      data: [
        // Work & Education
        { categoryId: workCategory.id, label: "Started new job", position: 0 },
        { categoryId: workCategory.id, label: "Got promoted", position: 1 },
        { categoryId: workCategory.id, label: "Graduated", position: 2 },
        { categoryId: workCategory.id, label: "Started school", position: 3 },
        { categoryId: workCategory.id, label: "Retired", position: 4 },
        // Family & Relationships
        { categoryId: familyCategory.id, label: "Got married", position: 0 },
        { categoryId: familyCategory.id, label: "Had a child", position: 1 },
        { categoryId: familyCategory.id, label: "Got engaged", position: 2 },
        { categoryId: familyCategory.id, label: "Started dating", position: 3 },
        { categoryId: familyCategory.id, label: "Divorced", position: 4 },
        // Home & Living
        { categoryId: homeCategory.id, label: "Bought a house", position: 0 },
        { categoryId: homeCategory.id, label: "Moved", position: 1 },
        { categoryId: homeCategory.id, label: "Renovated home", position: 2 },
        // Travel & Experiences
        { categoryId: travelCategory.id, label: "Took a trip", position: 0 },
        { categoryId: travelCategory.id, label: "Attended event", position: 1 },
        { categoryId: travelCategory.id, label: "Started hobby", position: 2 },
        // Health & Wellness
        { categoryId: healthCategory.id, label: "Had surgery", position: 0 },
        { categoryId: healthCategory.id, label: "Completed marathon", position: 1 },
        { categoryId: healthCategory.id, label: "Health milestone", position: 2 },
      ],
    });

    return { success: true, data: { message: "Life event categories seeded" } };
  } catch (error) {
    console.error("Error seeding life event categories:", error);
    return { success: false, error: "Failed to seed life event categories" };
  }
}
