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

// Get quick facts for a contact
export async function getQuickFactsForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const quickFacts = await db.contactQuickFact.findMany({
      where: { contactId },
      orderBy: { position: "asc" },
    });

    return quickFacts;
  } catch (error) {
    console.error("Error fetching quick facts:", error);
    return [];
  }
}

// Create a quick fact
export async function createQuickFact(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const label = formData.get("label") as string;
    const value = formData.get("value") as string;

    if (!contactId || !label || !value) {
      return { success: false, error: "Label and value are required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    // Get max position
    const maxPosition = await db.contactQuickFact.aggregate({
      where: { contactId },
      _max: { position: true },
    });

    const quickFact = await db.contactQuickFact.create({
      data: {
        contactId,
        label: label.trim(),
        value: value.trim(),
        position: (maxPosition._max.position ?? -1) + 1,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: quickFact };
  } catch (error) {
    console.error("Error creating quick fact:", error);
    return { success: false, error: "Failed to create quick fact" };
  }
}

// Update a quick fact
export async function updateQuickFact(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const id = formData.get("id") as string;
    const label = formData.get("label") as string;
    const value = formData.get("value") as string;

    if (!id || !label || !value) {
      return { success: false, error: "ID, label, and value are required" };
    }

    // Verify quick fact belongs to user's vault
    const quickFact = await db.contactQuickFact.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!quickFact || quickFact.contact.vaultId !== vault.id) {
      return { success: false, error: "Quick fact not found" };
    }

    await db.contactQuickFact.update({
      where: { id },
      data: {
        label: label.trim(),
        value: value.trim(),
      },
    });

    revalidatePath(`/contacts/${quickFact.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating quick fact:", error);
    return { success: false, error: "Failed to update quick fact" };
  }
}

// Delete a quick fact
export async function deleteQuickFact(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify quick fact belongs to user's vault
    const quickFact = await db.contactQuickFact.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!quickFact || quickFact.contact.vaultId !== vault.id) {
      return { success: false, error: "Quick fact not found" };
    }

    const contactId = quickFact.contactId;

    await db.contactQuickFact.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting quick fact:", error);
    return { success: false, error: "Failed to delete quick fact" };
  }
}

// Reorder quick facts
export async function reorderQuickFacts(
  contactId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    // Update positions
    await Promise.all(
      orderedIds.map((id, index) =>
        db.contactQuickFact.update({
          where: { id },
          data: { position: index },
        })
      )
    );

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error reordering quick facts:", error);
    return { success: false, error: "Failed to reorder quick facts" };
  }
}
