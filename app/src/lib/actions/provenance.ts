"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

export async function recordProvenance(
  contactId: string,
  fields: Record<string, string | null>,
  source: string,
  setBy?: string
) {
  const { vault } = await getUserVault();

  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
    select: { id: true },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return;
  }

  await db.$transaction(async (tx) => {
    for (const [field, value] of entries) {
      await tx.contactFieldProvenance.updateMany({
        where: {
          contactId,
          field,
          isActive: true,
        },
        data: { isActive: false },
      });

      await tx.contactFieldProvenance.create({
        data: {
          contactId,
          field,
          value,
          source,
          setBy: setBy ?? null,
          isActive: true,
        },
      });
    }
  });
}

export async function getProvenanceForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
      select: { id: true },
    });

    if (!contact) {
      return [];
    }

    return await db.contactFieldProvenance.findMany({
      where: {
        contactId,
        isActive: true,
      },
      orderBy: [{ field: "asc" }, { createdAt: "desc" }],
    });
  } catch (error) {
    console.error("Error fetching provenance for contact:", error);
    return [];
  }
}

export async function getProvenanceHistory(contactId: string, field: string) {
  try {
    const { vault } = await getUserVault();

    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
      select: { id: true },
    });

    if (!contact) {
      return [];
    }

    return await db.contactFieldProvenance.findMany({
      where: {
        contactId,
        field,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Error fetching provenance history:", error);
    return [];
  }
}
