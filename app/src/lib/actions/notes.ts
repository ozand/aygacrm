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

// Get notes for a contact
export async function getNotesForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const notes = await db.note.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { firstName: true, lastName: true, email: true },
        },
        emotion: true,
      },
    });

    return notes;
  } catch (error) {
    console.error("Error fetching notes:", error);
    return [];
  }
}

// Get single note
export async function getNote(id: number) {
  try {
    const { vault } = await getUserVault();

    const note = await db.note.findFirst({
      where: { id, vaultId: vault.id },
      include: {
        contact: true,
        author: {
          select: { firstName: true, lastName: true, email: true },
        },
        emotion: true,
      },
    });

    return note;
  } catch (error) {
    console.error("Error fetching note:", error);
    return null;
  }
}

// Create new note
export async function createNote(formData: FormData): Promise<ActionResult> {
  try {
    const { userId, vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const title = formData.get("title") as string;
    const body = formData.get("body") as string;
    const emotionId = formData.get("emotionId") as string;

    if (!contactId) {
      return { success: false, error: "Contact ID is required" };
    }

    if (!body || body.trim() === "") {
      return { success: false, error: "Note body is required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const note = await db.note.create({
      data: {
        title: title || null,
        body: body.trim(),
        contactId,
        vaultId: vault.id,
        authorId: userId,
        emotionId: emotionId || null,
      },
    });

    // Update contact's lastUpdatedAt
    await db.contact.update({
      where: { id: contactId },
      data: { lastUpdatedAt: new Date() },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: note };
  } catch (error) {
    console.error("Error creating note:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create note",
    };
  }
}

// Update note
export async function updateNote(
  id: number,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const title = formData.get("title") as string;
    const body = formData.get("body") as string;
    const emotionId = formData.get("emotionId") as string;

    if (!body || body.trim() === "") {
      return { success: false, error: "Note body is required" };
    }

    // Verify note belongs to user's vault
    const existingNote = await db.note.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!existingNote) {
      return { success: false, error: "Note not found" };
    }

    const note = await db.note.update({
      where: { id },
      data: {
        title: title || null,
        body: body.trim(),
        emotionId: emotionId || null,
      },
    });

    revalidatePath(`/contacts/${existingNote.contactId}`);

    return { success: true, data: note };
  } catch (error) {
    console.error("Error updating note:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update note",
    };
  }
}

// Delete note
export async function deleteNote(id: number): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const note = await db.note.findFirst({
      where: { id, vaultId: vault.id },
    });

    if (!note) {
      return { success: false, error: "Note not found" };
    }

    await db.note.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${note.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting note:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete note",
    };
  }
}
