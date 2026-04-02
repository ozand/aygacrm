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

  return {
    userId: session.user.id,
    vault: userVault.vault,
    accountId: userVault.vault.accountId,
  };
}

// Get pets for a contact
export async function getPetsForContact(contactId: string) {
  try {
    const { vault } = await getUserVaultAndAccount();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const pets = await db.pet.findMany({
      where: { contactId },
      include: { petCategory: true },
      orderBy: { createdAt: "desc" },
    });

    return pets;
  } catch (error) {
    console.error("Error fetching pets:", error);
    return [];
  }
}

// Get pet categories
export async function getPetCategories() {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const categories = await db.petCategory.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    });

    return categories;
  } catch (error) {
    console.error("Error fetching pet categories:", error);
    return [];
  }
}

// Create a pet
export async function createPet(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVaultAndAccount();

    const contactId = formData.get("contactId") as string;
    const name = formData.get("name") as string;
    const petCategoryId = formData.get("petCategoryId") as string | null;

    if (!contactId) {
      return { success: false, error: "Contact is required" };
    }

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    const pet = await db.pet.create({
      data: {
        contactId,
        name: name?.trim() || null,
        petCategoryId: petCategoryId || null,
      },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true, data: pet };
  } catch (error) {
    console.error("Error creating pet:", error);
    return { success: false, error: "Failed to create pet" };
  }
}

// Update a pet
export async function updatePet(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVaultAndAccount();

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const petCategoryId = formData.get("petCategoryId") as string | null;

    if (!id) {
      return { success: false, error: "Pet ID is required" };
    }

    // Verify pet belongs to user's vault
    const pet = await db.pet.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!pet || pet.contact.vaultId !== vault.id) {
      return { success: false, error: "Pet not found" };
    }

    await db.pet.update({
      where: { id },
      data: {
        name: name?.trim() || null,
        petCategoryId: petCategoryId || null,
      },
    });

    revalidatePath(`/contacts/${pet.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating pet:", error);
    return { success: false, error: "Failed to update pet" };
  }
}

// Delete a pet
export async function deletePet(id: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVaultAndAccount();

    // Verify pet belongs to user's vault
    const pet = await db.pet.findFirst({
      where: { id },
      include: { contact: true },
    });

    if (!pet || pet.contact.vaultId !== vault.id) {
      return { success: false, error: "Pet not found" };
    }

    const contactId = pet.contactId;

    await db.pet.delete({
      where: { id },
    });

    revalidatePath(`/contacts/${contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting pet:", error);
    return { success: false, error: "Failed to delete pet" };
  }
}

// Create a pet category
export async function createPetCategory(name: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const category = await db.petCategory.create({
      data: {
        accountId,
        name: name.trim(),
      },
    });

    return { success: true, data: category };
  } catch (error) {
    console.error("Error creating pet category:", error);
    return { success: false, error: "Failed to create pet category" };
  }
}

// Update a pet category
export async function updatePetCategory(
  id: string,
  name: string
): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const existing = await db.petCategory.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      return { success: false, error: "Pet category not found" };
    }

    const category = await db.petCategory.update({
      where: { id },
      data: { name: name.trim() },
    });

    return { success: true, data: category };
  } catch (error) {
    console.error("Error updating pet category:", error);
    return { success: false, error: "Failed to update pet category" };
  }
}

// Delete a pet category
export async function deletePetCategory(id: string): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    const existing = await db.petCategory.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      return { success: false, error: "Pet category not found" };
    }

    await db.petCategory.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting pet category:", error);
    return { success: false, error: "Failed to delete pet category" };
  }
}

// Seed default pet categories
export async function seedPetCategories(): Promise<ActionResult> {
  try {
    const { accountId } = await getUserVaultAndAccount();

    // Check if categories already exist
    const existing = await db.petCategory.findFirst({
      where: { accountId },
    });

    if (existing) {
      return { success: true, data: { message: "Pet categories already exist" } };
    }

    // Create default categories
    await db.petCategory.createMany({
      data: [
        { accountId, name: "Dog" },
        { accountId, name: "Cat" },
        { accountId, name: "Bird" },
        { accountId, name: "Fish" },
        { accountId, name: "Hamster" },
        { accountId, name: "Rabbit" },
        { accountId, name: "Turtle" },
        { accountId, name: "Snake" },
        { accountId, name: "Other" },
      ],
    });

    return { success: true, data: { message: "Pet categories seeded" } };
  } catch (error) {
    console.error("Error seeding pet categories:", error);
    return { success: false, error: "Failed to seed pet categories" };
  }
}
