"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function getUserVault() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });

  if (!userVault) {
    throw new Error("No vault found");
  }

  return userVault.vault;
}

export async function getCompanies() {
  const vault = await getUserVault();

  return db.company.findMany({
    where: { vaultId: vault.id },
    include: {
      _count: { select: { contacts: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getCompany(id: string) {
  const vault = await getUserVault();

  return db.company.findFirst({
    where: { id, vaultId: vault.id },
    include: {
      contacts: {
        orderBy: { firstName: "asc" },
      },
    },
  });
}

export async function createCompany(data: {
  name: string;
  website?: string;
  type?: string;
}) {
  const vault = await getUserVault();

  const company = await db.company.create({
    data: {
      name: data.name,
      website: data.website || null,
      type: data.type || null,
      vaultId: vault.id,
    },
  });

  revalidatePath("/companies");
  return company;
}

export async function updateCompany(
  id: string,
  data: { name?: string; website?: string; type?: string }
) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.company.findFirst({
    where: { id, vaultId: vault.id },
  });

  if (!existing) {
    throw new Error("Company not found");
  }

  const company = await db.company.update({
    where: { id },
    data: {
      name: data.name,
      website: data.website,
      type: data.type,
    },
  });

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  return company;
}

export async function deleteCompany(id: string) {
  const vault = await getUserVault();

  // Verify ownership
  const existing = await db.company.findFirst({
    where: { id, vaultId: vault.id },
  });

  if (!existing) {
    throw new Error("Company not found");
  }

  await db.company.delete({ where: { id } });

  revalidatePath("/companies");
  return { success: true };
}

export async function addContactToCompany(companyId: string, contactId: string) {
  const vault = await getUserVault();

  // Verify ownership of both
  const company = await db.company.findFirst({
    where: { id: companyId, vaultId: vault.id },
  });

  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
  });

  if (!company || !contact) {
    throw new Error("Company or contact not found");
  }

  await db.contact.update({
    where: { id: contactId },
    data: { companyId },
  });

  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/contacts/${contactId}`);
  return { success: true };
}

export async function removeContactFromCompany(contactId: string) {
  const vault = await getUserVault();

  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const companyId = contact.companyId;

  await db.contact.update({
    where: { id: contactId },
    data: { companyId: null },
  });

  revalidatePath("/companies");
  if (companyId) {
    revalidatePath(`/companies/${companyId}`);
  }
  revalidatePath(`/contacts/${contactId}`);
  return { success: true };
}

// Get contacts not assigned to any company
export async function getUnassignedContacts() {
  const vault = await getUserVault();

  return db.contact.findMany({
    where: {
      vaultId: vault.id,
      companyId: null,
    },
    orderBy: { firstName: "asc" },
  });
}
