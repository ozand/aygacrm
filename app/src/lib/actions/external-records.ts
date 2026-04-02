"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  sourceSchema,
  kindSchema,
  isValidSourceKind,
  type Source,
  type Kind,
} from "@/lib/ingestion-conventions";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

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

function getOptionalTrimmed(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) {
    return null;
  }

  const value = String(raw).trim();
  return value.length > 0 ? value : null;
}

function parseOptionalDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export async function getExternalRecordsForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
      select: { id: true },
    });

    if (!contact) {
      return [];
    }

    return await db.externalRecord.findMany({
      where: { contactId },
      orderBy: [{ happenedAt: "desc" }, { createdAt: "desc" }],
    });
  } catch (error) {
    console.error("Error fetching external records:", error);
    return [];
  }
}

export async function addExternalRecord(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const contactId = getOptionalTrimmed(formData, "contactId");
    const source = getOptionalTrimmed(formData, "source");
    const kind = getOptionalTrimmed(formData, "kind");
    const externalId = getOptionalTrimmed(formData, "externalId");
    const url = getOptionalTrimmed(formData, "url");
    const title = getOptionalTrimmed(formData, "title");
    const content = getOptionalTrimmed(formData, "content");
    const happenedAtInput = getOptionalTrimmed(formData, "happenedAt");

    if (!contactId) {
      return { success: false, error: "Contact ID is required" };
    }
    if (!source) {
      return { success: false, error: "Source is required" };
    }
    if (!kind) {
      return { success: false, error: "Kind is required" };
    }

    // Validate source and kind against ingestion conventions
    const sourceParsed = sourceSchema.safeParse(source);
    if (!sourceParsed.success) {
      return { success: false, error: `Invalid source "${source}". Valid sources: email, telegram, linkedin, todoist, notion, zoom, phone, whatsapp, manual, other` };
    }
    const kindParsed = kindSchema.safeParse(kind);
    if (!kindParsed.success) {
      return { success: false, error: `Invalid kind "${kind}". Valid kinds: message, thread, profile, note, transcript, task, page, meeting, reference, snippet` };
    }
    if (!isValidSourceKind(sourceParsed.data, kindParsed.data)) {
      return { success: false, error: `Invalid source/kind combination: "${source}/${kind}"` };
    }

    if (!url && !title && !content && !externalId) {
      return {
        success: false,
        error: "At least one of URL, title, content, or external ID is required",
      };
    }

    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
      select: { id: true },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const happenedAt = parseOptionalDate(happenedAtInput);
    if (happenedAtInput && !happenedAt) {
      return { success: false, error: "Invalid happened at date" };
    }

    const record = await db.externalRecord.create({
      data: {
        contactId,
        source,
        kind,
        externalId,
        url,
        title,
        content,
        happenedAt,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: record };
  } catch (error) {
    console.error("Error adding external record:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add external record",
    };
  }
}

export async function updateExternalRecord(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const existing = await db.externalRecord.findFirst({
      where: { id },
      include: {
        contact: {
          select: { id: true, vaultId: true },
        },
      },
    });

    if (!existing || existing.contact.vaultId !== vault.id) {
      return { success: false, error: "External record not found" };
    }

    const sourceInput = formData.has("source") ? getOptionalTrimmed(formData, "source") : undefined;
    const kindInput = formData.has("kind") ? getOptionalTrimmed(formData, "kind") : undefined;
    const externalId = formData.has("externalId") ? getOptionalTrimmed(formData, "externalId") : undefined;
    const url = formData.has("url") ? getOptionalTrimmed(formData, "url") : undefined;
    const title = formData.has("title") ? getOptionalTrimmed(formData, "title") : undefined;
    const content = formData.has("content") ? getOptionalTrimmed(formData, "content") : undefined;
    const happenedAtInput = formData.has("happenedAt")
      ? getOptionalTrimmed(formData, "happenedAt")
      : undefined;

    if (sourceInput === null) {
      return { success: false, error: "Source is required" };
    }
    if (kindInput === null) {
      return { success: false, error: "Kind is required" };
    }

    const nextSource = sourceInput === undefined ? existing.source : sourceInput;
    const nextKind = kindInput === undefined ? existing.kind : kindInput;
    const nextExternalId = externalId === undefined ? existing.externalId : externalId;
    const nextUrl = url === undefined ? existing.url : url;
    const nextTitle = title === undefined ? existing.title : title;
    const nextContent = content === undefined ? existing.content : content;

    if (!nextSource) {
      return { success: false, error: "Source is required" };
    }
    if (!nextKind) {
      return { success: false, error: "Kind is required" };
    }
    if (!nextUrl && !nextTitle && !nextContent && !nextExternalId) {
      return {
        success: false,
        error: "At least one of URL, title, content, or external ID is required",
      };
    }

    let happenedAt: Date | null | undefined;
    if (happenedAtInput !== undefined) {
      happenedAt = parseOptionalDate(happenedAtInput);
      if (happenedAtInput && !happenedAt) {
        return { success: false, error: "Invalid happened at date" };
      }
    }

    const updated = await db.externalRecord.update({
      where: { id },
      data: {
        ...(kindInput !== undefined ? { kind: kindInput } : {}),
        ...(sourceInput !== undefined ? { source: sourceInput } : {}),
        ...(externalId !== undefined ? { externalId } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(happenedAt !== undefined ? { happenedAt } : {}),
      },
    });

    revalidatePath(`/contacts/${existing.contactId}`);

    return { success: true, data: updated };
  } catch (error) {
    console.error("Error updating external record:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update external record",
    };
  }
}

export async function deleteExternalRecord(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const existing = await db.externalRecord.findFirst({
      where: { id },
      include: {
        contact: {
          select: { id: true, vaultId: true },
        },
      },
    });

    if (!existing || existing.contact.vaultId !== vault.id) {
      return { success: false, error: "External record not found" };
    }

    await db.externalRecord.delete({ where: { id } });

    revalidatePath(`/contacts/${existing.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting external record:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete external record",
    };
  }
}
