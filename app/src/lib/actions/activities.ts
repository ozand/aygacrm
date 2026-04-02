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

// Get activities for a contact
export async function getActivitiesForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const activities = await db.activity.findMany({
      where: { contactId, vaultId: vault.id },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { happenedAt: "desc" },
    });

    return activities;
  } catch (error) {
    console.error("Error fetching activities:", error);
    return [];
  }
}

// Create an activity
export async function createActivity(formData: FormData): Promise<ActionResult> {
  try {
    const { userId, vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const summary = formData.get("summary") as string;
    const description = formData.get("description") as string | null;
    const happenedAtStr = formData.get("happenedAt") as string | null;

    if (!contactId || !summary) {
      return { success: false, error: "Summary is required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const activity = await db.activity.create({
      data: {
        summary: summary.trim(),
        description: description?.trim() || null,
        happenedAt: happenedAtStr ? new Date(happenedAtStr) : new Date(),
        contactId,
        vaultId: vault.id,
        authorId: userId,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: activity };
  } catch (error) {
    console.error("Error creating activity:", error);
    return { success: false, error: "Failed to create activity" };
  }
}

// Update an activity
export async function updateActivity(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const id = formData.get("id") as string;
    const summary = formData.get("summary") as string | null;
    const description = formData.get("description") as string | null;
    const happenedAtStr = formData.get("happenedAt") as string | null;

    if (!id) {
      return { success: false, error: "Activity ID is required" };
    }

    // Verify activity belongs to user's vault
    const activity = await db.activity.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!activity) {
      return { success: false, error: "Activity not found" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (summary !== null) {
      updateData.summary = summary.trim();
    }

    if (description !== null) {
      updateData.description = description.trim() || null;
    }

    if (happenedAtStr !== null) {
      updateData.happenedAt = new Date(happenedAtStr);
    }

    await db.activity.update({
      where: { id },
      data: updateData,
    });

    revalidatePath(`/contacts/${activity.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating activity:", error);
    return { success: false, error: "Failed to update activity" };
  }
}

// Delete an activity
export async function deleteActivity(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify activity belongs to user's vault
    const activity = await db.activity.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!activity) {
      return { success: false, error: "Activity not found" };
    }

    const contactId = activity.contactId;

    await db.activity.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting activity:", error);
    return { success: false, error: "Failed to delete activity" };
  }
}
