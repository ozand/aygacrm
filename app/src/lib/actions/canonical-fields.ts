"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const SOURCE_PRIORITY: Record<string, number> = {
  manual: 1.0,
  linkedin: 0.8,
  email: 0.7,
  telegram: 0.6,
  whatsapp: 0.6,
  phone: 0.5,
  vk: 0.5,
  facebook: 0.5,
  import: 0.4,
  other: 0.3,
};

const TRACKED_FIELDS = [
  "firstName",
  "lastName",
  "middleName",
  "nickname",
  "maidenName",
  "prefix",
  "suffix",
  "jobPosition",
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

type ProvenanceRecord = {
  field: string;
  value: string | null;
  source: string;
  confidence: number;
  createdAt: Date;
  isActive: boolean;
};

type CanonicalFieldValue = {
  value: string | null;
  source: string;
  confidence: number;
  reason: string;
};

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

function getEffectiveConfidence(record: Pick<ProvenanceRecord, "source" | "confidence">) {
  if (Number.isFinite(record.confidence)) {
    return record.confidence;
  }

  return SOURCE_PRIORITY[record.source] ?? SOURCE_PRIORITY.other;
}

function pickByConfidenceThenRecency(records: ProvenanceRecord[]) {
  if (records.length === 0) {
    return null;
  }

  return records.reduce((best, current) => {
    const bestConfidence = getEffectiveConfidence(best);
    const currentConfidence = getEffectiveConfidence(current);

    if (currentConfidence > bestConfidence) {
      return current;
    }

    if (currentConfidence === bestConfidence && current.createdAt > best.createdAt) {
      return current;
    }

    return best;
  });
}

function pickMostRecent(records: ProvenanceRecord[]) {
  if (records.length === 0) {
    return null;
  }

  return records.reduce((latest, current) => {
    if (current.createdAt > latest.createdAt) {
      return current;
    }

    return latest;
  });
}

export async function getSourcePriority() {
  return SOURCE_PRIORITY;
}

export async function selectCanonicalValue(records: ProvenanceRecord[]) {
  if (records.length === 0) {
    return null;
  }

  const manualRecords = records.filter((record) => record.source === "manual");
  if (manualRecords.length > 0) {
    const selected = pickByConfidenceThenRecency(manualRecords);
    if (!selected) {
      return null;
    }

    return {
      value: selected.value,
      source: selected.source,
      confidence: getEffectiveConfidence(selected),
      reason: "Manual edit by user",
    } satisfies CanonicalFieldValue;
  }

  const bestByScore = pickByConfidenceThenRecency(records);
  if (!bestByScore) {
    return null;
  }

  const bestConfidence = getEffectiveConfidence(bestByScore);
  const topConfidenceRecords = records.filter(
    (record) => getEffectiveConfidence(record) === bestConfidence
  );

  if (topConfidenceRecords.length > 1) {
    const mostRecent = pickMostRecent(topConfidenceRecords);
    if (!mostRecent) {
      return null;
    }

    return {
      value: mostRecent.value,
      source: mostRecent.source,
      confidence: getEffectiveConfidence(mostRecent),
      reason: `Most recent from ${mostRecent.source}`,
    } satisfies CanonicalFieldValue;
  }

  const selected = topConfidenceRecords[0];

  return {
    value: selected.value,
    source: selected.source,
    confidence: getEffectiveConfidence(selected),
    reason: `Highest confidence from ${selected.source}`,
  } satisfies CanonicalFieldValue;
}

export async function getCanonicalFields(contactId: string) {
  const { vault } = await getUserVault();

  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
    select: { id: true },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const records = await db.contactFieldProvenance.findMany({
    where: {
      contactId,
      isActive: true,
      field: {
        in: [...TRACKED_FIELDS],
      },
    },
    orderBy: [{ field: "asc" }, { createdAt: "desc" }],
    select: {
      field: true,
      value: true,
      source: true,
      confidence: true,
      createdAt: true,
      isActive: true,
    },
  });

  const byField = new Map<TrackedField, ProvenanceRecord[]>();

  for (const record of records) {
    const field = record.field as TrackedField;
    const existing = byField.get(field) ?? [];
    existing.push(record);
    byField.set(field, existing);
  }

  const canonical: Partial<Record<TrackedField, CanonicalFieldValue>> = {};

  for (const field of TRACKED_FIELDS) {
    const fieldRecords = byField.get(field);
    if (!fieldRecords || fieldRecords.length === 0) {
      continue;
    }

    const selected = await selectCanonicalValue(fieldRecords);
    if (!selected) {
      continue;
    }

    canonical[field] = selected;
  }

  return canonical;
}

export async function applyCanonicalFields(contactId: string) {
  const { vault } = await getUserVault();

  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      nickname: true,
      maidenName: true,
      prefix: true,
      suffix: true,
      jobPosition: true,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const canonical = await getCanonicalFields(contactId);
  const updated: string[] = [];
  const unchanged: string[] = [];
  const updateData: Partial<Record<TrackedField, string | null>> = {};

  for (const field of TRACKED_FIELDS) {
    const canonicalValue = canonical[field];
    if (!canonicalValue) {
      continue;
    }

    if (contact[field] !== canonicalValue.value) {
      updateData[field] = canonicalValue.value;
      updated.push(field);
    } else {
      unchanged.push(field);
    }
  }

  if (updated.length > 0) {
    await db.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
  }

  return { updated, unchanged };
}

export async function getFieldConflicts(contactId: string) {
  const { vault } = await getUserVault();

  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
    select: { id: true },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const records = await db.contactFieldProvenance.findMany({
    where: { contactId },
    orderBy: [{ field: "asc" }, { createdAt: "desc" }],
    select: {
      field: true,
      value: true,
      source: true,
      confidence: true,
      isActive: true,
    },
  });

  const byField = new Map<string, typeof records>();

  for (const record of records) {
    const existing = byField.get(record.field) ?? [];
    existing.push(record);
    byField.set(record.field, existing);
  }

  const conflicts: Array<{
    field: string;
    values: Array<{
      value: string | null;
      source: string;
      confidence: number;
      isActive: boolean;
    }>;
  }> = [];

  for (const [field, fieldRecords] of byField.entries()) {
    const distinctValues = new Set(fieldRecords.map((record) => record.value ?? "__NULL__"));
    if (distinctValues.size <= 1) {
      continue;
    }

    conflicts.push({
      field,
      values: fieldRecords.map((record) => ({
        value: record.value,
        source: record.source,
        confidence: getEffectiveConfidence(record),
        isActive: record.isActive,
      })),
    });
  }

  return conflicts;
}
