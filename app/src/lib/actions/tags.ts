"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Helper to slugify tag name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Get user's vault and account
async function getUserVaultAndAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });

  if (!userVault) throw new Error("No vault found");
  return {
    userId: session.user.id,
    vault: userVault.vault,
    accountId: userVault.vault.accountId,
  };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  contactsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all tags for the current account
 */
export async function getTags(): Promise<Tag[]> {
  const { accountId } = await getUserVaultAndAccount();

  const tags = await db.tag.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { contacts: true },
      },
    },
  });

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    contactsCount: tag._count.contacts,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  }));
}

/**
 * Create a new tag
 */
export async function createTag(name: string): Promise<Tag> {
  const { accountId } = await getUserVaultAndAccount();

  const slug = slugify(name);

  // Check if tag with same slug exists
  const existing = await db.tag.findFirst({
    where: { accountId, slug },
  });

  if (existing) {
    throw new Error("A tag with this name already exists");
  }

  const tag = await db.tag.create({
    data: {
      accountId,
      name: name.trim(),
      slug,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/contacts");

  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    contactsCount: 0,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

/**
 * Update a tag
 */
export async function updateTag(id: string, name: string): Promise<Tag> {
  const { accountId } = await getUserVaultAndAccount();

  const tag = await db.tag.findFirst({
    where: { id, accountId },
  });

  if (!tag) {
    throw new Error("Tag not found");
  }

  const newSlug = slugify(name);

  // Check if another tag with same slug exists
  const existing = await db.tag.findFirst({
    where: {
      accountId,
      slug: newSlug,
      NOT: { id },
    },
  });

  if (existing) {
    throw new Error("A tag with this name already exists");
  }

  const updatedTag = await db.tag.update({
    where: { id },
    data: {
      name: name.trim(),
      slug: newSlug,
    },
    include: {
      _count: {
        select: { contacts: true },
      },
    },
  });

  revalidatePath("/settings");
  revalidatePath("/contacts");

  return {
    id: updatedTag.id,
    name: updatedTag.name,
    slug: updatedTag.slug,
    contactsCount: updatedTag._count.contacts,
    createdAt: updatedTag.createdAt,
    updatedAt: updatedTag.updatedAt,
  };
}

/**
 * Delete a tag
 */
export async function deleteTag(id: string): Promise<void> {
  const { accountId } = await getUserVaultAndAccount();

  const tag = await db.tag.findFirst({
    where: { id, accountId },
  });

  if (!tag) {
    throw new Error("Tag not found");
  }

  await db.tag.delete({
    where: { id },
  });

  revalidatePath("/settings");
  revalidatePath("/contacts");
}

/**
 * Assign a tag to a contact
 */
export async function assignTagToContact(tagId: string, contactId: string): Promise<void> {
  const { accountId } = await getUserVaultAndAccount();

  // Verify tag belongs to account
  const tag = await db.tag.findFirst({
    where: { id: tagId, accountId },
  });

  if (!tag) {
    throw new Error("Tag not found");
  }

  // Verify contact exists and user has access
  const contact = await db.contact.findFirst({
    where: {
      id: contactId,
      deletedAt: null,
      vault: {
        accountId,
      },
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  // Create the association if it doesn't exist
  await db.contactTag.upsert({
    where: {
      contactId_tagId: {
        contactId,
        tagId,
      },
    },
    create: {
      contactId,
      tagId,
    },
    update: {},
  });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

/**
 * Remove a tag from a contact
 */
export async function removeTagFromContact(tagId: string, contactId: string): Promise<void> {
  const { accountId } = await getUserVaultAndAccount();

  // Verify tag belongs to account
  const tag = await db.tag.findFirst({
    where: { id: tagId, accountId },
  });

  if (!tag) {
    throw new Error("Tag not found");
  }

  await db.contactTag.deleteMany({
    where: {
      contactId,
      tagId,
    },
  });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

/**
 * Get tags for a specific contact
 */
export async function getContactTags(contactId: string): Promise<Tag[]> {
  const { accountId } = await getUserVaultAndAccount();

  const contactTags = await db.contactTag.findMany({
    where: {
      contactId,
      tag: {
        accountId,
      },
    },
    include: {
      tag: {
        include: {
          _count: {
            select: { contacts: true },
          },
        },
      },
    },
  });

  return contactTags.map((ct) => ({
    id: ct.tag.id,
    name: ct.tag.name,
    slug: ct.tag.slug,
    contactsCount: ct.tag._count.contacts,
    createdAt: ct.tag.createdAt,
    updatedAt: ct.tag.updatedAt,
  }));
}
