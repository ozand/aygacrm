"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

interface ContactPreview {
  id: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
}

interface DuplicateCandidate {
  contactA: ContactPreview;
  contactB: ContactPreview;
  score: number;
  matchReasons: string[];
}

interface ProcessedContact extends ContactPreview {
  externalIdentityKeys: Set<string>;
  emailValues: Set<string>;
  phoneValues: Set<string>;
  firstNameNormalized: string;
  lastNameNormalized: string;
  fullNameNormalized: string;
}

// Helper to get current user's vault
async function getUserVault() {
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

  return { userId: session.user.id, vault: userVault.vault };
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length <= 10) {
    return digits;
  }

  return digits.slice(-10);
}

function normalizeNamePart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getPairKey(contactAId: string, contactBId: string): string {
  return contactAId < contactBId
    ? `${contactAId}:${contactBId}`
    : `${contactBId}:${contactAId}`;
}

function setsIntersect(left: Set<string>, right: Set<string>): boolean {
  if (left.size === 0 || right.size === 0) {
    return false;
  }

  const [smallSet, largeSet] = left.size <= right.size ? [left, right] : [right, left];

  for (const value of smallSet) {
    if (largeSet.has(value)) {
      return true;
    }
  }

  return false;
}

function getNameSimilarityScore(
  contactA: ProcessedContact,
  contactB: ProcessedContact
): { score: number; reason?: string } {
  if (
    contactA.fullNameNormalized &&
    contactB.fullNameNormalized &&
    contactA.fullNameNormalized === contactB.fullNameNormalized
  ) {
    return { score: 80, reason: "name_exact" };
  }

  const firstNameMatches =
    contactA.firstNameNormalized.length > 0 &&
    contactA.firstNameNormalized === contactB.firstNameNormalized;

  if (firstNameMatches) {
    const leftLast = contactA.lastNameNormalized;
    const rightLast = contactB.lastNameNormalized;

    if (leftLast.length >= 3 && rightLast.length >= 3) {
      const leftPrefix = leftLast.slice(0, 3);
      const rightPrefix = rightLast.slice(0, 3);
      if (leftPrefix === rightPrefix) {
        return { score: 70, reason: "name_similar_lastname_prefix" };
      }
    }
  }

  if (
    contactA.firstNameNormalized &&
    contactA.lastNameNormalized &&
    contactB.firstNameNormalized &&
    contactB.lastNameNormalized &&
    contactA.firstNameNormalized === contactB.lastNameNormalized &&
    contactA.lastNameNormalized === contactB.firstNameNormalized
  ) {
    return { score: 65, reason: "name_reversed" };
  }

  return { score: 0 };
}

function buildProcessedContact(rawContact: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  externalIdentities: Array<{ source: string; externalId: string }>;
  contactInformation: Array<{ data: string; type: { type: string } }>;
}): ProcessedContact {
  const externalIdentityKeys = new Set<string>();
  const emailValues = new Set<string>();
  const phoneValues = new Set<string>();

  for (const identity of rawContact.externalIdentities) {
    externalIdentityKeys.add(`${identity.source}::${identity.externalId}`);

    if (identity.source.toLowerCase() === "email") {
      const email = normalizeEmail(identity.externalId);
      if (email) {
        emailValues.add(email);
      }
    }

    if (identity.source.toLowerCase() === "phone") {
      const phone = normalizePhone(identity.externalId);
      if (phone) {
        phoneValues.add(phone);
      }
    }
  }

  for (const info of rawContact.contactInformation) {
    const infoType = info.type.type.toLowerCase();
    if (infoType === "email") {
      const email = normalizeEmail(info.data);
      if (email) {
        emailValues.add(email);
      }
    }

    if (infoType === "phone") {
      const phone = normalizePhone(info.data);
      if (phone) {
        phoneValues.add(phone);
      }
    }
  }

  const firstNameNormalized = normalizeNamePart(rawContact.firstName);
  const lastNameNormalized = normalizeNamePart(rawContact.lastName);
  const fullNameNormalized = `${firstNameNormalized} ${lastNameNormalized}`.trim();

  return {
    id: rawContact.id,
    firstName: rawContact.firstName,
    lastName: rawContact.lastName,
    nickname: rawContact.nickname,
    externalIdentityKeys,
    emailValues,
    phoneValues,
    firstNameNormalized,
    lastNameNormalized,
    fullNameNormalized,
  };
}

function evaluatePair(contactA: ProcessedContact, contactB: ProcessedContact): DuplicateCandidate | null {
  let score = 0;
  const matchReasons: string[] = [];

  if (setsIntersect(contactA.externalIdentityKeys, contactB.externalIdentityKeys)) {
    score = Math.max(score, 95);
    matchReasons.push("external_identity_exact");
  }

  if (setsIntersect(contactA.emailValues, contactB.emailValues)) {
    score = Math.max(score, 90);
    matchReasons.push("email_match");
  }

  if (setsIntersect(contactA.phoneValues, contactB.phoneValues)) {
    score = Math.max(score, 85);
    matchReasons.push("phone_match");
  }

  const nameSimilarity = getNameSimilarityScore(contactA, contactB);
  if (nameSimilarity.score > 0 && nameSimilarity.reason) {
    score = Math.max(score, nameSimilarity.score);
    matchReasons.push(nameSimilarity.reason);
  }

  if (score < 60) {
    return null;
  }

  return {
    contactA: {
      id: contactA.id,
      firstName: contactA.firstName,
      lastName: contactA.lastName,
      nickname: contactA.nickname,
    },
    contactB: {
      id: contactB.id,
      firstName: contactB.firstName,
      lastName: contactB.lastName,
      nickname: contactB.nickname,
    },
    score,
    matchReasons,
  };
}

async function collectDuplicateCandidates(
  targetContactId?: string,
  limit = 50
): Promise<DuplicateCandidate[]> {
  const { vault } = await getUserVault();

  const contacts = await db.contact.findMany({
    where: { vaultId: vault.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      externalIdentities: {
        select: {
          source: true,
          externalId: true,
        },
      },
      contactInformation: {
        select: {
          data: true,
          type: {
            select: {
              type: true,
            },
          },
        },
      },
    },
  });

  if (targetContactId && !contacts.some((contact) => contact.id === targetContactId)) {
    return [];
  }

  const dismissedPairs = await getDismissedPairs();
  const processedContacts = contacts.map(buildProcessedContact);
  const candidates: DuplicateCandidate[] = [];

  for (let leftIndex = 0; leftIndex < processedContacts.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < processedContacts.length;
      rightIndex += 1
    ) {
      const contactA = processedContacts[leftIndex];
      const contactB = processedContacts[rightIndex];

      if (
        targetContactId &&
        contactA.id !== targetContactId &&
        contactB.id !== targetContactId
      ) {
        continue;
      }

      const pairKey = getPairKey(contactA.id, contactB.id);
      if (dismissedPairs.has(pairKey)) {
        continue;
      }

      const candidate = evaluatePair(contactA, contactB);
      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const leftKey = getPairKey(left.contactA.id, left.contactB.id);
    const rightKey = getPairKey(right.contactA.id, right.contactB.id);
    return leftKey.localeCompare(rightKey);
  });

  return candidates.slice(0, limit);
}

// Get all dismissed duplicate pairs for the current user's vault
export async function getDismissedPairs(): Promise<Set<string>> {
  try {
    const { vault } = await getUserVault();

    const dismissed = await db.contactMergeLog.findMany({
      where: {
        action: "dismissed",
        primaryContact: {
          vaultId: vault.id,
        },
        secondaryContact: {
          vaultId: vault.id,
        },
      },
      select: {
        primaryContactId: true,
        secondaryContactId: true,
      },
    });

    const pairs = new Set<string>();
    for (const item of dismissed) {
      pairs.add(getPairKey(item.primaryContactId, item.secondaryContactId));
    }

    return pairs;
  } catch (error) {
    console.error("Error fetching dismissed duplicate pairs:", error);
    return new Set<string>();
  }
}

// Find duplicate candidates across all contacts in the current user's vault
export async function findDuplicateCandidates(): Promise<DuplicateCandidate[]> {
  try {
    return await collectDuplicateCandidates(undefined, 50);
  } catch (error) {
    console.error("Error finding duplicate candidates:", error);
    return [];
  }
}

// Find duplicate candidates for a specific contact
export async function getDuplicatesForContact(contactId: string): Promise<DuplicateCandidate[]> {
  try {
    if (!contactId) {
      return [];
    }

    return await collectDuplicateCandidates(contactId, 20);
  } catch (error) {
    console.error("Error finding duplicates for contact:", error);
    return [];
  }
}

// Dismiss a duplicate pair so it is excluded from future candidate lists
export async function dismissDuplicate(
  contactAId: string,
  contactBId: string
): Promise<ActionResult> {
  try {
    const { userId, vault } = await getUserVault();

    if (!contactAId || !contactBId) {
      return { success: false, error: "Both contact IDs are required" };
    }

    if (contactAId === contactBId) {
      return { success: false, error: "Cannot dismiss a contact against itself" };
    }

    const contacts = await db.contact.findMany({
      where: {
        id: { in: [contactAId, contactBId] },
        vaultId: vault.id,
      },
      select: { id: true },
    });

    if (contacts.length !== 2) {
      return { success: false, error: "One or both contacts were not found" };
    }

    await db.contactMergeLog.create({
      data: {
        action: "dismissed",
        primaryContactId: contactAId,
        secondaryContactId: contactBId,
        reason: "manual",
        mergedBy: userId,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error dismissing duplicate pair:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to dismiss duplicate",
    };
  }
}
