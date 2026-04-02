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

// Get documents for a contact (type = 'document')
export async function getDocumentsForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const documents = await db.file.findMany({
      where: {
        contactId,
        vaultId: vault.id,
        type: "document",
      },
      orderBy: { createdAt: "desc" },
    });

    return documents;
  } catch (error) {
    console.error("Error fetching documents:", error);
    return [];
  }
}

// Create a document record (file upload handled separately via API route)
export async function createDocument(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const name = formData.get("name") as string;
    const originalUrl = formData.get("originalUrl") as string;
    const mimeType = formData.get("mimeType") as string | null;
    const sizeStr = formData.get("size") as string | null;

    if (!contactId || !name || !originalUrl) {
      return { success: false, error: "Name and file URL are required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const document = await db.file.create({
      data: {
        uuid: crypto.randomUUID(),
        name: name.trim(),
        originalUrl,
        mimeType: mimeType || null,
        size: sizeStr ? parseInt(sizeStr) : null,
        type: "document",
        vaultId: vault.id,
        contactId,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: document };
  } catch (error) {
    console.error("Error creating document:", error);
    return { success: false, error: "Failed to create document" };
  }
}

// Rename a document
export async function renameDocument(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;

    if (!id || !name) {
      return { success: false, error: "ID and name are required" };
    }

    // Verify document belongs to user's vault
    const document = await db.file.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!document) {
      return { success: false, error: "Document not found" };
    }

    await db.file.update({
      where: { id },
      data: { name: name.trim() },
    });

    if (document.contactId) {
      revalidatePath(`/contacts/${document.contactId}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error renaming document:", error);
    return { success: false, error: "Failed to rename document" };
  }
}

// Delete a document
export async function deleteDocument(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify document belongs to user's vault
    const document = await db.file.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!document) {
      return { success: false, error: "Document not found" };
    }

    const contactId = document.contactId;

    // TODO: Also delete the actual file from storage
    await db.file.delete({
      where: { id },
    });

    if (contactId) {
      revalidatePath(`/contacts/${contactId}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting document:", error);
    return { success: false, error: "Failed to delete document" };
  }
}
