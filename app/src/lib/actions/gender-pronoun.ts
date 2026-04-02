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

// Genders
export async function getGenders() {
  try {
    const accountId = await getUserAccountId();
    const genders = await db.gender.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    });
    return genders;
  } catch (error) {
    console.error("Error fetching genders:", error);
    return [];
  }
}

export async function ensureDefaultGenders() {
  const accountId = await getUserAccountId();
  const existing = await db.gender.findMany({
    where: { accountId },
  });

  if (existing.length === 0) {
    const defaults = [
      { name: "Male", type: "male" },
      { name: "Female", type: "female" },
      { name: "Non-binary", type: "other" },
      { name: "Other", type: "other" },
      { name: "Prefer not to say", type: "other" },
    ];
    for (const g of defaults) {
      await db.gender.create({
        data: { accountId, name: g.name, type: g.type },
      });
    }
  }

  return getGenders();
}

export async function createGender(name: string, type: string = "other") {
  const accountId = await getUserAccountId();
  const gender = await db.gender.create({
    data: { accountId, name, type },
  });
  return gender;
}

export async function deleteGender(id: string) {
  const accountId = await getUserAccountId();
  const gender = await db.gender.findFirst({
    where: { id, accountId },
  });
  if (!gender) throw new Error("Gender not found");

  await db.gender.delete({ where: { id } });
  return { success: true };
}

// Pronouns
export async function getPronouns() {
  try {
    const accountId = await getUserAccountId();
    const pronouns = await db.pronoun.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    });
    return pronouns;
  } catch (error) {
    console.error("Error fetching pronouns:", error);
    return [];
  }
}

export async function ensureDefaultPronouns() {
  const accountId = await getUserAccountId();
  const existing = await db.pronoun.findMany({
    where: { accountId },
  });

  if (existing.length === 0) {
    const defaults = ["he/him", "she/her", "they/them", "ze/zir", "prefer not to say"];
    for (const name of defaults) {
      await db.pronoun.create({
        data: { accountId, name },
      });
    }
  }

  return getPronouns();
}

export async function createPronoun(name: string) {
  const accountId = await getUserAccountId();
  const pronoun = await db.pronoun.create({
    data: { accountId, name },
  });
  return pronoun;
}

export async function deletePronoun(id: string) {
  const accountId = await getUserAccountId();
  const pronoun = await db.pronoun.findFirst({
    where: { id, accountId },
  });
  if (!pronoun) throw new Error("Pronoun not found");

  await db.pronoun.delete({ where: { id } });
  return { success: true };
}

// Update contact gender/pronoun
export async function updateContactGenderPronoun(
  contactId: string,
  data: { genderId?: string | null; pronounId?: string | null }
) {
  const vault = await getUserVault();
  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
  });
  if (!contact) throw new Error("Contact not found");

  const updated = await db.contact.update({
    where: { id: contactId },
    data: {
      genderId: data.genderId !== undefined ? data.genderId : undefined,
      pronounId: data.pronounId !== undefined ? data.pronounId : undefined,
    },
    include: { gender: true, pronoun: true },
  });

  revalidatePath(`/contacts/${contactId}`);
  return updated;
}
