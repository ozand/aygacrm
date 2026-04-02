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

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Get all labels for current user's vault
export async function getLabels() {
  try {
    const { vault } = await getUserVault();

    const labels = await db.label.findMany({
      where: { vaultId: vault.id },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
    });

    return labels;
  } catch (error) {
    console.error("Error fetching labels:", error);
    return [];
  }
}

// Get single label
export async function getLabel(id: string) {
  try {
    const { vault } = await getUserVault();

    const label = await db.label.findFirst({
      where: { id, vaultId: vault.id },
      include: {
        contacts: {
          include: {
            contact: {
              include: {
                contactInformation: {
                  include: { type: true },
                },
              },
            },
          },
        },
      },
    });

    return label;
  } catch (error) {
    console.error("Error fetching label:", error);
    return null;
  }
}

// Create label
export async function createLabel(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const bgColor = (formData.get("bgColor") as string) || "#e5e7eb";
    const textColor = (formData.get("textColor") as string) || "#1f2937";

    if (!name || name.trim() === "") {
      return { success: false, error: "Label name is required" };
    }

    const slug = generateSlug(name);

    // Check for duplicate
    const existing = await db.label.findFirst({
      where: { vaultId: vault.id, slug },
    });

    if (existing) {
      return { success: false, error: "A label with this name already exists" };
    }

    const label = await db.label.create({
      data: {
        name: name.trim(),
        slug,
        description: description || null,
        bgColor,
        textColor,
        vaultId: vault.id,
      },
    });

    revalidatePath("/labels");
    revalidatePath("/contacts");

    return { success: true, data: label };
  } catch (error) {
    console.error("Error creating label:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create label",
    };
  }
}

// Update label
export async function updateLabel(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const bgColor = formData.get("bgColor") as string;
    const textColor = formData.get("textColor") as string;

    const existing = await db.label.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!existing) {
      return { success: false, error: "Label not found" };
    }

    const slug = name ? generateSlug(name) : existing.slug;

    const label = await db.label.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        slug,
        description: description ?? existing.description,
        bgColor: bgColor || existing.bgColor,
        textColor: textColor || existing.textColor,
      },
    });

    revalidatePath("/labels");
    revalidatePath("/contacts");

    return { success: true, data: label };
  } catch (error) {
    console.error("Error updating label:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update label",
    };
  }
}

// Delete label
export async function deleteLabel(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const label = await db.label.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!label) {
      return { success: false, error: "Label not found" };
    }

    await db.label.delete({
      where: { id },
    });

    revalidatePath("/labels");
    revalidatePath("/contacts");

    return { success: true };
  } catch (error) {
    console.error("Error deleting label:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete label",
    };
  }
}

// Add label to contact
export async function addLabelToContact(
  contactId: string,
  labelId: string
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify contact and label belong to vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    const label = await db.label.findFirst({
      where: { id: labelId, vaultId: vault.id },
    });

    if (!contact || !label) {
      return { success: false, error: "Contact or label not found" };
    }

    // Check if already exists
    const existing = await db.contactLabel.findUnique({
      where: {
        contactId_labelId: { contactId, labelId },
      },
    });

    if (existing) {
      return { success: true, data: existing }; // Already assigned
    }

    const contactLabel = await db.contactLabel.create({
      data: { contactId, labelId },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/contacts");

    return { success: true, data: contactLabel };
  } catch (error) {
    console.error("Error adding label to contact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add label",
    };
  }
}

// Remove label from contact
export async function removeLabelFromContact(
  contactId: string,
  labelId: string
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    await db.contactLabel.delete({
      where: {
        contactId_labelId: { contactId, labelId },
      },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/contacts");

    return { success: true };
  } catch (error) {
    console.error("Error removing label from contact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove label",
    };
  }
}

// Get contacts by label
export async function getContactsByLabel(labelId: string) {
  try {
    const { vault } = await getUserVault();

    const label = await db.label.findFirst({
      where: { id: labelId, vaultId: vault.id },
    });

    if (!label) {
      return [];
    }

    const contactLabels = await db.contactLabel.findMany({
      where: { labelId },
      include: {
        contact: {
          include: {
            contactInformation: {
              include: { type: true },
            },
          },
        },
      },
    });

    return contactLabels
      .map((cl) => cl.contact)
      .filter((c) => !c.deletedAt && c.listed);
  } catch (error) {
    console.error("Error fetching contacts by label:", error);
    return [];
  }
}
