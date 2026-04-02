"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// Helper to get current user's vault and account
async function getUserVaultAndAccount() {
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

  return { userId: session.user.id, vault: userVault.vault, accountId: userVault.vault.accountId };
}

// Get all relationship types grouped by category
export async function getRelationshipTypes() {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const groupTypes = await db.relationshipGroupType.findMany({
      where: { accountId },
      include: {
        relationshipTypes: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return groupTypes;
  } catch (error) {
    console.error("Error fetching relationship types:", error);
    return [];
  }
}

// Get relationships for a contact
export async function getRelationshipsForContact(contactId: string) {
  try {
    const { vault } = await getUserVaultAndAccount();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    // Get relationships where this contact is the primary
    const relationshipsFrom = await db.relationship.findMany({
      where: { contactId },
      include: {
        relatedContact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
        relationshipType: {
          include: {
            groupType: true,
          },
        },
      },
    });

    // Get relationships where this contact is the related contact
    const relationshipsTo = await db.relationship.findMany({
      where: { relatedContactId: contactId },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
        relationshipType: {
          include: {
            groupType: true,
          },
        },
      },
    });

    // Transform to a unified format
    const relationships = [
      ...relationshipsFrom.map((r) => ({
        id: r.id,
        direction: "from" as const,
        relatedContact: r.relatedContact,
        type: r.relationshipType.name,
        reverseType: r.relationshipType.nameReverseRelationship,
        groupType: r.relationshipType.groupType.name,
      })),
      ...relationshipsTo.map((r) => ({
        id: r.id,
        direction: "to" as const,
        relatedContact: r.contact,
        type: r.relationshipType.nameReverseRelationship || r.relationshipType.name,
        reverseType: r.relationshipType.name,
        groupType: r.relationshipType.groupType.name,
      })),
    ];

    return relationships;
  } catch (error) {
    console.error("Error fetching relationships:", error);
    return [];
  }
}

// Create a relationship between two contacts
export async function createRelationship(formData: FormData): Promise<ActionResult> {
  try {
    const { vault, accountId } = await getUserVaultAndAccount();

    const contactId = formData.get("contactId") as string;
    const relatedContactId = formData.get("relatedContactId") as string;
    const relationshipTypeId = formData.get("relationshipTypeId") as string;

    if (!contactId || !relatedContactId) {
      return { success: false, error: "Both contacts are required" };
    }

    if (contactId === relatedContactId) {
      return { success: false, error: "Cannot create a relationship with the same contact" };
    }

    if (!relationshipTypeId) {
      return { success: false, error: "Relationship type is required" };
    }

    // Verify both contacts belong to user's vault
    const [contact1, contact2] = await Promise.all([
      db.contact.findFirst({ where: { id: contactId, vaultId: vault.id } }),
      db.contact.findFirst({ where: { id: relatedContactId, vaultId: vault.id } }),
    ]);

    if (!contact1 || !contact2) {
      return { success: false, error: "One or both contacts not found" };
    }

    // Check if relationship already exists
    const existing = await db.relationship.findFirst({
      where: {
        OR: [
          { contactId, relatedContactId, relationshipTypeId },
          { contactId: relatedContactId, relatedContactId: contactId, relationshipTypeId },
        ],
      },
    });

    if (existing) {
      return { success: false, error: "This relationship already exists" };
    }

    const relationship = await db.relationship.create({
      data: {
        contactId,
        relatedContactId,
        relationshipTypeId,
      },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath(`/contacts/${relatedContactId}`);

    return { success: true, data: relationship };
  } catch (error) {
    console.error("Error creating relationship:", error);
    return { success: false, error: "Failed to create relationship" };
  }
}

// Delete a relationship
export async function deleteRelationship(relationshipId: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVaultAndAccount();

    // Verify relationship belongs to user's vault
    const relationship = await db.relationship.findFirst({
      where: { id: relationshipId },
      include: { contact: true },
    });

    if (!relationship || relationship.contact.vaultId !== vault.id) {
      return { success: false, error: "Relationship not found" };
    }

    await db.relationship.delete({
      where: { id: relationshipId },
    });

    revalidatePath(`/contacts/${relationship.contactId}`);
    revalidatePath(`/contacts/${relationship.relatedContactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting relationship:", error);
    return { success: false, error: "Failed to delete relationship" };
  }
}

// Get contacts for relationship picker (exclude current contact)
export async function getContactsForRelationshipPicker(excludeContactId: string) {
  try {
    const { vault } = await getUserVaultAndAccount();

    const contacts = await db.contact.findMany({
      where: {
        vaultId: vault.id,
        deletedAt: null,
        listed: true,
        id: { not: excludeContactId },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return contacts;
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return [];
  }
}

// Seed default relationship types if none exist
export async function seedRelationshipTypes(): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    // Check if types already exist
    const existingGroups = await db.relationshipGroupType.findFirst({
      where: { accountId },
    });

    if (existingGroups) {
      return { success: true, data: { message: "Relationship types already exist" } };
    }

    // Create default relationship group types and types
    const familyGroup = await db.relationshipGroupType.create({
      data: {
        accountId,
        name: "Family",
        type: "family",
      },
    });

    const friendsGroup = await db.relationshipGroupType.create({
      data: {
        accountId,
        name: "Friends",
        type: "friend",
      },
    });

    const workGroup = await db.relationshipGroupType.create({
      data: {
        accountId,
        name: "Work",
        type: "work",
      },
    });

    // Family relationships
    await db.relationshipType.createMany({
      data: [
        { name: "Spouse", nameReverseRelationship: "Spouse", groupTypeId: familyGroup.id },
        { name: "Partner", nameReverseRelationship: "Partner", groupTypeId: familyGroup.id },
        { name: "Parent", nameReverseRelationship: "Child", groupTypeId: familyGroup.id },
        { name: "Sibling", nameReverseRelationship: "Sibling", groupTypeId: familyGroup.id },
        { name: "Grandparent", nameReverseRelationship: "Grandchild", groupTypeId: familyGroup.id },
        { name: "Uncle/Aunt", nameReverseRelationship: "Nephew/Niece", groupTypeId: familyGroup.id },
        { name: "Cousin", nameReverseRelationship: "Cousin", groupTypeId: familyGroup.id },
      ],
    });

    // Friend relationships
    await db.relationshipType.createMany({
      data: [
        { name: "Friend", nameReverseRelationship: "Friend", groupTypeId: friendsGroup.id },
        { name: "Best Friend", nameReverseRelationship: "Best Friend", groupTypeId: friendsGroup.id },
        { name: "Acquaintance", nameReverseRelationship: "Acquaintance", groupTypeId: friendsGroup.id },
      ],
    });

    // Work relationships
    await db.relationshipType.createMany({
      data: [
        { name: "Colleague", nameReverseRelationship: "Colleague", groupTypeId: workGroup.id },
        { name: "Manager", nameReverseRelationship: "Report", groupTypeId: workGroup.id },
        { name: "Mentor", nameReverseRelationship: "Mentee", groupTypeId: workGroup.id },
        { name: "Client", nameReverseRelationship: "Service Provider", groupTypeId: workGroup.id },
      ],
    });

    return { success: true, data: { message: "Relationship types seeded successfully" } };
  } catch (error) {
    console.error("Error seeding relationship types:", error);
    return { success: false, error: "Failed to seed relationship types" };
  }
}
