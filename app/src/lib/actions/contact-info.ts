"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Helper to get user's account
async function getUserAccount() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { accountId: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return { userId: session.user.id, accountId: user.accountId };
}

// ============================================
// CONTACT INFORMATION TYPES
// ============================================

export async function getContactInformationTypes() {
  const { accountId } = await getUserAccount();
  
  return db.contactInformationType.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
  });
}

export async function createContactInformationType(data: {
  name: string;
  protocol?: string;
  type: string; // email, phone, social, other
}) {
  const { accountId } = await getUserAccount();
  
  const infoType = await db.contactInformationType.create({
    data: {
      accountId,
      name: data.name,
      protocol: data.protocol || null,
      type: data.type,
    },
  });
  
  revalidatePath("/settings");
  return infoType;
}

export async function updateContactInformationType(
  id: string,
  data: {
    name?: string;
    protocol?: string;
    type?: string;
  }
) {
  const infoType = await db.contactInformationType.update({
    where: { id },
    data: {
      name: data.name,
      protocol: data.protocol,
      type: data.type,
    },
  });
  
  revalidatePath("/settings");
  return infoType;
}

export async function deleteContactInformationType(id: string) {
  await db.contactInformationType.delete({ where: { id } });
  revalidatePath("/settings");
  return { success: true };
}

// ============================================
// ADDRESS TYPES
// ============================================

export async function getAddressTypes() {
  const { accountId } = await getUserAccount();
  
  return db.addressType.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
  });
}

export async function createAddressType(name: string) {
  const { accountId } = await getUserAccount();
  
  const addressType = await db.addressType.create({
    data: {
      accountId,
      name,
    },
  });
  
  revalidatePath("/settings");
  return addressType;
}

export async function deleteAddressType(id: string) {
  await db.addressType.delete({ where: { id } });
  revalidatePath("/settings");
  return { success: true };
}

// ============================================
// CONTACT INFORMATION (for contacts)
// ============================================

export async function getContactInformationForContact(contactId: string) {
  return db.contactInformation.findMany({
    where: { contactId },
    include: {
      type: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createContactInformation(data: {
  contactId: string;
  typeId: string;
  data: string;
  label?: string;
}) {
  const info = await db.contactInformation.create({
    data: {
      contactId: data.contactId,
      typeId: data.typeId,
      data: data.data,
      label: data.label || null,
    },
    include: {
      type: true,
    },
  });
  
  revalidatePath(`/contacts/${data.contactId}`);
  return info;
}

export async function updateContactInformation(
  id: string,
  data: {
    data?: string;
    label?: string;
    typeId?: string;
  }
) {
  const info = await db.contactInformation.update({
    where: { id },
    data: {
      data: data.data,
      label: data.label,
      typeId: data.typeId,
    },
    include: {
      type: true,
      contact: { select: { id: true } },
    },
  });
  
  revalidatePath(`/contacts/${info.contact.id}`);
  return info;
}

export async function deleteContactInformation(id: string) {
  const info = await db.contactInformation.findUnique({
    where: { id },
    select: { contactId: true },
  });
  
  await db.contactInformation.delete({ where: { id } });
  
  if (info) {
    revalidatePath(`/contacts/${info.contactId}`);
  }
  return { success: true };
}

// ============================================
// ADDRESSES (for contacts)
// ============================================

export async function getAddressesForContact(contactId: string) {
  return db.address.findMany({
    where: { contactId },
    include: {
      addressType: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAddress(data: {
  contactId: string;
  addressTypeId?: string;
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}) {
  const address = await db.address.create({
    data: {
      contactId: data.contactId,
      addressTypeId: data.addressTypeId || null,
      line1: data.line1 || null,
      line2: data.line2 || null,
      city: data.city || null,
      province: data.province || null,
      postalCode: data.postalCode || null,
      country: data.country || null,
    },
    include: {
      addressType: true,
    },
  });
  
  revalidatePath(`/contacts/${data.contactId}`);
  return address;
}

export async function updateAddress(
  id: string,
  data: {
    addressTypeId?: string | null;
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    isActive?: boolean;
  }
) {
  const address = await db.address.update({
    where: { id },
    data: {
      addressTypeId: data.addressTypeId,
      line1: data.line1,
      line2: data.line2,
      city: data.city,
      province: data.province,
      postalCode: data.postalCode,
      country: data.country,
      isActive: data.isActive,
    },
    include: {
      addressType: true,
      contact: { select: { id: true } },
    },
  });
  
  revalidatePath(`/contacts/${address.contact.id}`);
  return address;
}

export async function deleteAddress(id: string) {
  const address = await db.address.findUnique({
    where: { id },
    select: { contactId: true },
  });
  
  await db.address.delete({ where: { id } });
  
  if (address) {
    revalidatePath(`/contacts/${address.contactId}`);
  }
  return { success: true };
}
