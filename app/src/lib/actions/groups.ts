"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Helper to get user's vault
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

  return { userId: session.user.id, vault: userVault.vault };
}

// ============================================
// GROUP TYPES
// ============================================

export async function getGroupTypes() {
  const { vault } = await getUserVault();
  
  const account = await db.vault.findUnique({
    where: { id: vault.id },
    select: { accountId: true },
  });
  
  if (!account) return [];
  
  return db.groupType.findMany({
    where: { accountId: account.accountId },
    include: {
      roles: {
        orderBy: { position: "asc" },
      },
    },
    orderBy: { position: "asc" },
  });
}

export async function createGroupType(label: string) {
  const { vault } = await getUserVault();
  
  const account = await db.vault.findUnique({
    where: { id: vault.id },
    select: { accountId: true },
  });
  
  if (!account) throw new Error("Account not found");
  
  const groupType = await db.groupType.create({
    data: {
      accountId: account.accountId,
      label,
    },
  });
  
  revalidatePath("/groups");
  return groupType;
}

export async function deleteGroupType(id: string) {
  await db.groupType.delete({ where: { id } });
  revalidatePath("/groups");
  return { success: true };
}

// ============================================
// GROUP TYPE ROLES
// ============================================

export async function createGroupTypeRole(groupTypeId: string, label: string) {
  const role = await db.groupTypeRole.create({
    data: {
      groupTypeId,
      label,
    },
  });
  
  revalidatePath("/groups");
  return role;
}

export async function deleteGroupTypeRole(id: string) {
  await db.groupTypeRole.delete({ where: { id } });
  revalidatePath("/groups");
  return { success: true };
}

// ============================================
// GROUPS
// ============================================

export async function getGroups() {
  const { vault } = await getUserVault();
  
  return db.group.findMany({
    where: { vaultId: vault.id },
    include: {
      groupType: true,
      contacts: {
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          role: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getGroupsForContact(contactId: string) {
  const { vault } = await getUserVault();
  
  // Get all groups in the vault
  const groups = await db.group.findMany({
    where: { vaultId: vault.id },
    include: {
      groupType: {
        include: {
          roles: {
            orderBy: { position: "asc" },
          },
        },
      },
      contacts: {
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          role: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
  
  // Get groups this contact is a member of
  const contactGroups = await db.contactGroup.findMany({
    where: { contactId },
    include: {
      group: {
        include: {
          groupType: true,
        },
      },
      role: true,
    },
  });
  
  return { groups, contactGroups };
}

export async function createGroup(data: {
  name: string;
  groupTypeId?: string;
}) {
  const { vault } = await getUserVault();
  
  const group = await db.group.create({
    data: {
      vaultId: vault.id,
      name: data.name,
      groupTypeId: data.groupTypeId || null,
    },
    include: {
      groupType: true,
      contacts: true,
    },
  });
  
  revalidatePath("/groups");
  return group;
}

export async function updateGroup(id: string, data: {
  name?: string;
  groupTypeId?: string | null;
}) {
  const group = await db.group.update({
    where: { id },
    data: {
      name: data.name,
      groupTypeId: data.groupTypeId,
    },
  });
  
  revalidatePath("/groups");
  return group;
}

export async function deleteGroup(id: string) {
  await db.group.delete({ where: { id } });
  revalidatePath("/groups");
  return { success: true };
}

// ============================================
// CONTACT GROUP MEMBERSHIP
// ============================================

export async function addContactToGroup(
  contactId: string,
  groupId: string,
  roleId?: string
) {
  // Check if already exists
  const existing = await db.contactGroup.findUnique({
    where: {
      contactId_groupId: { contactId, groupId },
    },
  });
  
  if (existing) {
    // Update role if provided
    if (roleId !== undefined) {
      await db.contactGroup.update({
        where: {
          contactId_groupId: { contactId, groupId },
        },
        data: { roleId },
      });
    }
    revalidatePath(`/contacts/${contactId}`);
    return existing;
  }
  
  const membership = await db.contactGroup.create({
    data: {
      contactId,
      groupId,
      roleId: roleId || null,
    },
  });
  
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/groups");
  return membership;
}

export async function removeContactFromGroup(contactId: string, groupId: string) {
  await db.contactGroup.delete({
    where: {
      contactId_groupId: { contactId, groupId },
    },
  });
  
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/groups");
  return { success: true };
}

export async function updateContactGroupRole(
  contactId: string,
  groupId: string,
  roleId: string | null
) {
  await db.contactGroup.update({
    where: {
      contactId_groupId: { contactId, groupId },
    },
    data: { roleId },
  });
  
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/groups");
  return { success: true };
}
