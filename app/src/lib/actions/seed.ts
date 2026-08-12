"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SeedResult } from "@/lib/seed-types";
import { seedPetCategories } from "./pets";
import { seedLifeEventCategories } from "./life-events";
import { seedGiftOccasions } from "./gifts";
import { seedCallReasons } from "./calls";
import { seedRelationshipTypes } from "./relationships";
import { ensureDefaultEmotions } from "./emotions";
import { ensureDefaultGenders, ensureDefaultPronouns } from "./gender-pronoun";
import { ensureDefaultReligions } from "./religion";
import { ensureDefaultAddressTypes } from "./addresses";
import { seedCurrencies } from "./currencies";
import { seedJournalMetrics } from "./journal";
import { seedDefaultTemplate } from "./templates";

// Helper to get current user's account
async function getUserVaultAndAccount() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
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

// Seed default contact information types
async function seedContactInformationTypes(): Promise<boolean> {
  try {
    const { accountId } = await getUserVaultAndAccount();
    
    const existing = await db.contactInformationType.count({
      where: { accountId },
    });

    if (existing > 0) {
      return false; // Already seeded
    }

    const defaultTypes = [
      { name: "Email", type: "email", protocol: "mailto:" },
      { name: "Phone", type: "phone", protocol: "tel:" },
      { name: "Mobile", type: "phone", protocol: "tel:" },
      { name: "Work Phone", type: "phone", protocol: "tel:" },
      { name: "Facebook", type: "social", protocol: "https://facebook.com/" },
      { name: "Twitter", type: "social", protocol: "https://twitter.com/" },
      { name: "Instagram", type: "social", protocol: "https://instagram.com/" },
      { name: "LinkedIn", type: "social", protocol: "https://linkedin.com/in/" },
      { name: "WhatsApp", type: "social", protocol: "https://wa.me/" },
      { name: "Telegram", type: "social", protocol: "https://t.me/" },
      { name: "Website", type: "other", protocol: "" },
    ];

    await db.contactInformationType.createMany({
      data: defaultTypes.map((t) => ({
        accountId,
        name: t.name,
        type: t.type,
        protocol: t.protocol || null,
      })),
    });

    return true;
  } catch (error) {
    console.error("Error seeding contact info types:", error);
    return false;
  }
}

// Main seed function that runs all seeders
export async function seedAllDefaultData(): Promise<SeedResult> {
  const seeded: string[] = [];
  const errors: string[] = [];

  try {
    // Check if user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, seeded: [], errors: ["Not authenticated"] };
    }

    // Run all seed functions in parallel where possible
    const results = await Promise.allSettled([
      // Account-level seeds (require account context)
      seedPetCategories().then((r) => ({ name: "Pet Categories", result: r })),
      seedLifeEventCategories().then((r) => ({ name: "Life Event Categories", result: r })),
      seedGiftOccasions().then((r) => ({ name: "Gift Occasions", result: r })),
      seedCallReasons().then((r) => ({ name: "Call Reasons", result: r })),
      seedRelationshipTypes().then((r) => ({ name: "Relationship Types", result: r })),
      ensureDefaultGenders().then((created) => ({ name: "Genders", result: { success: true, data: { created } } })),
      ensureDefaultPronouns().then((created) => ({ name: "Pronouns", result: { success: true, data: { created } } })),
      ensureDefaultReligions().then((created) => ({ name: "Religions", result: { success: true, data: { created } } })),
      ensureDefaultAddressTypes().then((created) => ({ name: "Address Types", result: { success: true, data: { created } } })),
      ensureDefaultEmotions().then((emotions) => ({ name: "Emotions", result: { success: true, data: emotions } })),
      seedContactInformationTypes().then((created) => ({ name: "Contact Info Types", result: { success: true, data: { created } } })),
      seedJournalMetrics().then((r) => ({ name: "Journal Metrics", result: r })),
      seedCurrencies().then((r) => ({ name: "Currencies", result: r })),
      seedDefaultTemplate().then((r) => ({ name: "Templates", result: r })),
    ]);

    // Process results
    for (const result of results) {
      if (result.status === "fulfilled") {
        const { name, result: actionResult } = result.value;
        if (actionResult.success !== false) {
          seeded.push(name);
        }
      } else {
        errors.push(result.reason?.message || "Unknown error");
      }
    }

    return {
      success: errors.length === 0,
      seeded,
      errors,
    };
  } catch (error) {
    console.error("Error in seedAllDefaultData:", error);
    return {
      success: false,
      seeded,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

// Check if seeding is needed (quick check without actually seeding)
export async function checkSeedingStatus(): Promise<{
  needsSeeding: boolean;
  missingData: string[];
}> {
  try {
    const { accountId, vault } = await getUserVaultAndAccount();

    const missingData: string[] = [];

    // Check each data type
    const [
      petCategories,
      lifeEventCategories,
      giftOccasions,
      callReasonTypes,
      relationshipGroups,
      genders,
      pronouns,
      religions,
      addressTypes,
      emotions,
      contactInfoTypes,
      journalMetrics,
      currencies,
      templates,
    ] = await Promise.all([
      db.petCategory.count({ where: { accountId } }),
      db.lifeEventCategory.count({ where: { accountId } }),
      db.giftOccasion.count({ where: { accountId } }),
      db.callReasonType.count({ where: { accountId } }),
      db.relationshipGroupType.count({ where: { accountId } }),
      db.gender.count({ where: { accountId } }),
      db.pronoun.count({ where: { accountId } }),
      db.religion.count({ where: { accountId } }),
      db.addressType.count({ where: { accountId } }),
      db.emotion.count({ where: { accountId } }),
      db.contactInformationType.count({ where: { accountId } }),
      db.journalMetric.count({ where: { accountId } }),
      db.currency.count(),
      db.template.count({ where: { accountId } }),
    ]);

    if (petCategories === 0) missingData.push("Pet Categories");
    if (lifeEventCategories === 0) missingData.push("Life Event Categories");
    if (giftOccasions === 0) missingData.push("Gift Occasions");
    if (callReasonTypes === 0) missingData.push("Call Reasons");
    if (relationshipGroups === 0) missingData.push("Relationship Types");
    if (genders === 0) missingData.push("Genders");
    if (pronouns === 0) missingData.push("Pronouns");
    if (religions === 0) missingData.push("Religions");
    if (addressTypes === 0) missingData.push("Address Types");
    if (emotions === 0) missingData.push("Emotions");
    if (contactInfoTypes === 0) missingData.push("Contact Info Types");
    if (journalMetrics === 0) missingData.push("Journal Metrics");
    if (currencies === 0) missingData.push("Currencies");
    if (templates === 0) missingData.push("Templates");

    return {
      needsSeeding: missingData.length > 0,
      missingData,
    };
  } catch (error) {
    console.error("Error checking seeding status:", error);
    return { needsSeeding: false, missingData: [] };
  }
}
