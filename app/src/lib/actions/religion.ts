"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getUserVault() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });
  if (!userVault) throw new Error("No vault found");
  return userVault.vault;
}

async function getUserAccountId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });
  if (!userVault) throw new Error("No vault found");
  return userVault.vault.accountId;
}

// Religions
export async function getReligions() {
  try {
    const accountId = await getUserAccountId();
    const religions = await db.religion.findMany({
      where: { accountId },
      orderBy: { position: "asc" },
    });
    return religions;
  } catch (error) {
    console.error("Error fetching religions:", error);
    return [];
  }
}

export async function ensureDefaultReligions() {
  const accountId = await getUserAccountId();
  const existing = await db.religion.findMany({
    where: { accountId },
  });

  if (existing.length === 0) {
    const defaults = [
      "Christianity",
      "Islam",
      "Hinduism",
      "Buddhism",
      "Judaism",
      "Sikhism",
      "Atheism",
      "Agnosticism",
      "Spiritual",
      "Other",
      "Prefer not to say",
    ];
    for (let i = 0; i < defaults.length; i++) {
      await db.religion.create({
        data: { accountId, name: defaults[i], position: i },
      });
    }
  }

  return getReligions();
}

export async function createReligion(name: string) {
  const accountId = await getUserAccountId();
  const maxPos = await db.religion.aggregate({
    where: { accountId },
    _max: { position: true },
  });
  const religion = await db.religion.create({
    data: {
      accountId,
      name,
      position: (maxPos._max.position ?? -1) + 1,
    },
  });
  return religion;
}

export async function deleteReligion(id: string) {
  const accountId = await getUserAccountId();
  const religion = await db.religion.findFirst({
    where: { id, accountId },
  });
  if (!religion) throw new Error("Religion not found");

  await db.religion.delete({ where: { id } });
  return { success: true };
}

// Update contact religion
export async function updateContactReligion(
  contactId: string,
  religionId: string | null
) {
  const vault = await getUserVault();
  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
  });
  if (!contact) throw new Error("Contact not found");

  const updated = await db.contact.update({
    where: { id: contactId },
    data: { religionId },
    include: { religion: true },
  });

  revalidatePath(`/contacts/${contactId}`);
  return updated;
}
