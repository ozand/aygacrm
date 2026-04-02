"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
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

function parseOptionalBoolean(value: FormDataEntryValue | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  const normalized = String(value).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "on") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "off") {
    return false;
  }

  return undefined;
}

// Get external identities for a contact
export async function getExternalIdentitiesForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const identities = await db.externalIdentity.findMany({
      where: { contactId },
      orderBy: [{ source: "asc" }, { createdAt: "asc" }],
    });

    return identities;
  } catch (error) {
    console.error("Error fetching external identities:", error);
    return [];
  }
}

// Add external identity
export async function addExternalIdentity(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contactId = formData.get("contactId") as string;
    const source = formData.get("source") as string;
    const externalId = formData.get("externalId") as string;
    const label = formData.get("label") as string;
    const verified = parseOptionalBoolean(formData.get("verified"));

    if (!contactId) {
      return { success: false, error: "Contact ID is required" };
    }

    if (!source || source.trim() === "") {
      return { success: false, error: "Source is required" };
    }

    if (!externalId || externalId.trim() === "") {
      return { success: false, error: "External ID is required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const identity = await db.externalIdentity.create({
      data: {
        contactId,
        source: source.trim(),
        externalId: externalId.trim(),
        label: label?.trim() || null,
        ...(verified !== undefined ? { verified } : {}),
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: identity };
  } catch (error) {
    console.error("Error adding external identity:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "This external identity already exists for that source",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add external identity",
    };
  }
}

// Update external identity
export async function updateExternalIdentity(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const identity = await db.externalIdentity.findFirst({
      where: { id },
      include: {
        contact: {
          select: { id: true, vaultId: true },
        },
      },
    });

    if (!identity || identity.contact.vaultId !== vault.id) {
      return { success: false, error: "External identity not found" };
    }

    const updateData: {
      label?: string | null;
      verified?: boolean;
      externalId?: string;
    } = {};

    if (formData.has("label")) {
      const label = formData.get("label") as string;
      updateData.label = label?.trim() || null;
    }

    if (formData.has("verified")) {
      const verified = parseOptionalBoolean(formData.get("verified"));
      if (verified !== undefined) {
        updateData.verified = verified;
      }
    }

    if (formData.has("externalId")) {
      const externalId = formData.get("externalId") as string;
      if (!externalId || externalId.trim() === "") {
        return { success: false, error: "External ID cannot be empty" };
      }
      updateData.externalId = externalId.trim();
    }

    const updatedIdentity = await db.externalIdentity.update({
      where: { id },
      data: updateData,
    });

    revalidatePath(`/contacts/${identity.contactId}`);

    return { success: true, data: updatedIdentity };
  } catch (error) {
    console.error("Error updating external identity:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update external identity",
    };
  }
}

// Delete external identity
export async function deleteExternalIdentity(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const identity = await db.externalIdentity.findFirst({
      where: { id },
      include: {
        contact: {
          select: { id: true, vaultId: true },
        },
      },
    });

    if (!identity || identity.contact.vaultId !== vault.id) {
      return { success: false, error: "External identity not found" };
    }

    const contactId = identity.contactId;

    await db.externalIdentity.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting external identity:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete external identity",
    };
  }
}

// Find contacts by external identity (duplicate detection)
export async function findContactsByExternalId(source: string, externalId: string) {
  try {
    const { vault } = await getUserVault();

    if (!source || !externalId) {
      return [];
    }

    const matches = await db.externalIdentity.findMany({
      where: {
        source,
        externalId,
        contact: {
          vaultId: vault.id,
        },
      },
      select: {
        source: true,
        externalId: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
      },
      orderBy: [{ contact: { firstName: "asc" } }, { contact: { lastName: "asc" } }],
    });

    return matches.map((match) => ({
      contactId: match.contact.id,
      contactName:
        [match.contact.firstName, match.contact.lastName].filter(Boolean).join(" ") ||
        match.contact.nickname ||
        "Unnamed",
      source: match.source,
      externalId: match.externalId,
    }));
  } catch (error) {
    console.error("Error finding contacts by external identity:", error);
    return [];
  }
}
