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

// Get avatar for a contact
export async function getContactAvatar(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return null;
    }

    const avatar = await db.file.findFirst({
      where: {
        contactId,
        type: "avatar",
      },
      orderBy: { createdAt: "desc" },
    });

    return avatar;
  } catch (error) {
    console.error("Error fetching avatar:", error);
    return null;
  }
}

// Get all photos for a contact
export async function getContactPhotos(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const photos = await db.file.findMany({
      where: {
        contactId,
        type: { in: ["photo", "avatar"] },
      },
      orderBy: { createdAt: "desc" },
    });

    return photos;
  } catch (error) {
    console.error("Error fetching photos:", error);
    return [];
  }
}

// Set avatar from existing photo
export async function setAvatarFromPhoto(
  contactId: string,
  fileId: string
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

    // Verify file belongs to this contact
    const file = await db.file.findFirst({
      where: { id: fileId, contactId, vaultId: vault.id },
    });

    if (!file) {
      return { success: false, error: "Photo not found" };
    }

    // Remove avatar type from old avatar
    await db.file.updateMany({
      where: { contactId, type: "avatar" },
      data: { type: "photo" },
    });

    // Set new avatar
    await db.file.update({
      where: { id: fileId },
      data: { type: "avatar" },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error setting avatar:", error);
    return { success: false, error: "Failed to set avatar" };
  }
}

// Delete a photo/avatar
export async function deletePhoto(fileId: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify file belongs to user's vault
    const file = await db.file.findFirst({
      where: { id: fileId, vaultId: vault.id },
      include: { contact: true },
    });

    if (!file) {
      return { success: false, error: "Photo not found" };
    }

    const contactId = file.contactId;

    // Delete from database
    await db.file.delete({
      where: { id: fileId },
    });

    // Note: In production, also delete from storage (S3, local filesystem, etc.)

    if (contactId) {
      revalidatePath(`/contacts/${contactId}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting photo:", error);
    return { success: false, error: "Failed to delete photo" };
  }
}

// Create file record (called after upload)
export async function createFileRecord(
  contactId: string,
  data: {
    name: string;
    originalUrl: string;
    mimeType: string;
    size: number;
    type: "avatar" | "photo" | "document";
  }
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

    // If uploading new avatar, demote old one
    if (data.type === "avatar") {
      await db.file.updateMany({
        where: { contactId, type: "avatar" },
        data: { type: "photo" },
      });
    }

    const file = await db.file.create({
      data: {
        uuid: crypto.randomUUID(),
        name: data.name,
        originalUrl: data.originalUrl,
        mimeType: data.mimeType,
        size: data.size,
        type: data.type,
        vaultId: vault.id,
        contactId,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: file };
  } catch (error) {
    console.error("Error creating file record:", error);
    return { success: false, error: "Failed to save file" };
  }
}
