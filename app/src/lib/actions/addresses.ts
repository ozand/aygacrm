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

// Address Types
export async function getAddressTypes() {
  try {
    const accountId = await getUserAccountId();
    const types = await db.addressType.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    });
    return types;
  } catch (error) {
    console.error("Error fetching address types:", error);
    return [];
  }
}

export async function createAddressType(name: string) {
  const accountId = await getUserAccountId();
  const type = await db.addressType.create({
    data: {
      accountId,
      name,
    },
  });
  return type;
}

export async function ensureDefaultAddressTypes() {
  const accountId = await getUserAccountId();
  const existing = await db.addressType.findMany({
    where: { accountId },
  });

  if (existing.length === 0) {
    const defaults = ["Home", "Work", "Other"];
    for (const name of defaults) {
      await db.addressType.create({
        data: { accountId, name },
      });
    }
  }

  return getAddressTypes();
}

// Addresses
export async function getAddressesForContact(contactId: string) {
  try {
    const vault = await getUserVault();
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });
    if (!contact) throw new Error("Contact not found");

    const addresses = await db.address.findMany({
      where: { contactId },
      include: { addressType: true },
      orderBy: { createdAt: "desc" },
    });
    return addresses;
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return [];
  }
}

export async function createAddress(data: {
  contactId: string;
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  addressTypeId?: string;
}) {
  const vault = await getUserVault();
  const contact = await db.contact.findFirst({
    where: { id: data.contactId, vaultId: vault.id },
  });
  if (!contact) throw new Error("Contact not found");

  const address = await db.address.create({
    data: {
      contactId: data.contactId,
      line1: data.line1 || null,
      line2: data.line2 || null,
      city: data.city || null,
      province: data.province || null,
      postalCode: data.postalCode || null,
      country: data.country || null,
      addressTypeId: data.addressTypeId || null,
    },
    include: { addressType: true },
  });

  revalidatePath(`/contacts/${data.contactId}`);
  return address;
}

export async function updateAddress(
  id: string,
  data: {
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    addressTypeId?: string;
    isActive?: boolean;
  }
) {
  const vault = await getUserVault();
  const address = await db.address.findFirst({
    where: { id },
    include: { contact: true },
  });
  if (!address || address.contact.vaultId !== vault.id) {
    throw new Error("Address not found");
  }

  const updated = await db.address.update({
    where: { id },
    data: {
      line1: data.line1 !== undefined ? data.line1 || null : undefined,
      line2: data.line2 !== undefined ? data.line2 || null : undefined,
      city: data.city !== undefined ? data.city || null : undefined,
      province: data.province !== undefined ? data.province || null : undefined,
      postalCode: data.postalCode !== undefined ? data.postalCode || null : undefined,
      country: data.country !== undefined ? data.country || null : undefined,
      addressTypeId: data.addressTypeId !== undefined ? data.addressTypeId || null : undefined,
      isActive: data.isActive !== undefined ? data.isActive : undefined,
    },
    include: { addressType: true },
  });

  revalidatePath(`/contacts/${address.contactId}`);
  return updated;
}

export async function deleteAddress(id: string) {
  const vault = await getUserVault();
  const address = await db.address.findFirst({
    where: { id },
    include: { contact: true },
  });
  if (!address || address.contact.vaultId !== vault.id) {
    throw new Error("Address not found");
  }

  await db.address.delete({ where: { id } });
  revalidatePath(`/contacts/${address.contactId}`);
  return { success: true };
}
