"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

// ============================================
// MOOD TRACKING PARAMETERS (Settings)
// ============================================

export async function getMoodTrackingParameters() {
  const { accountId } = await getUserVaultAndAccount();

  return db.moodTrackingParameter.findMany({
    where: { accountId },
    orderBy: { position: "asc" },
  });
}

export async function createMoodTrackingParameter(data: {
  label: string;
  position?: number;
}) {
  const { accountId } = await getUserVaultAndAccount();

  // Get max position if not provided
  let position = data.position;
  if (position === undefined) {
    const maxPosition = await db.moodTrackingParameter.aggregate({
      where: { accountId },
      _max: { position: true },
    });
    position = (maxPosition._max.position ?? -1) + 1;
  }

  const parameter = await db.moodTrackingParameter.create({
    data: {
      label: data.label,
      position,
      accountId,
    },
  });

  revalidatePath("/settings");
  return parameter;
}

export async function updateMoodTrackingParameter(
  id: string,
  data: { label?: string; position?: number }
) {
  const { accountId } = await getUserVaultAndAccount();

  const parameter = await db.moodTrackingParameter.findFirst({
    where: { id, accountId },
  });

  if (!parameter) throw new Error("Mood tracking parameter not found");

  const updated = await db.moodTrackingParameter.update({
    where: { id },
    data: {
      label: data.label,
      position: data.position,
    },
  });

  revalidatePath("/settings");
  return updated;
}

export async function deleteMoodTrackingParameter(id: string) {
  const { accountId } = await getUserVaultAndAccount();

  const parameter = await db.moodTrackingParameter.findFirst({
    where: { id, accountId },
  });

  if (!parameter) throw new Error("Mood tracking parameter not found");

  await db.moodTrackingParameter.delete({
    where: { id },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function reorderMoodTrackingParameters(
  orderedIds: string[]
) {
  const { accountId } = await getUserVaultAndAccount();

  // Verify all parameters belong to this account
  const parameters = await db.moodTrackingParameter.findMany({
    where: { accountId, id: { in: orderedIds } },
  });

  if (parameters.length !== orderedIds.length) {
    throw new Error("Invalid parameter IDs");
  }

  // Update positions
  await Promise.all(
    orderedIds.map((id, index) =>
      db.moodTrackingParameter.update({
        where: { id },
        data: { position: index },
      })
    )
  );

  revalidatePath("/settings");
  return { success: true };
}

// ============================================
// MOOD TRACKING EVENTS (Contact-specific)
// ============================================

export async function getMoodEvents(contactId: string, options?: {
  limit?: number;
  offset?: number;
}) {
  const { vault } = await getUserVaultAndAccount();

  // Verify contact belongs to vault
  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
  });

  if (!contact) throw new Error("Contact not found");

  const events = await db.moodTrackingEvent.findMany({
    where: { contactId },
    include: {
      parameter: true,
    },
    orderBy: { ratedAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });

  return events;
}

export async function getMoodEventById(id: string) {
  const { vault } = await getUserVaultAndAccount();

  const event = await db.moodTrackingEvent.findFirst({
    where: { id },
    include: {
      parameter: true,
      contact: true,
    },
  });

  if (!event || event.contact.vaultId !== vault.id) {
    throw new Error("Mood event not found");
  }

  return event;
}

export async function createMoodEvent(data: {
  contactId: string;
  parameterId?: string;
  ratedAt?: Date;
  note?: string;
  numberOfHoursSlept?: number;
}) {
  const { vault, accountId } = await getUserVaultAndAccount();

  // Verify contact belongs to vault
  const contact = await db.contact.findFirst({
    where: { id: data.contactId, vaultId: vault.id },
  });

  if (!contact) throw new Error("Contact not found");

  // Verify parameter belongs to account if provided
  if (data.parameterId) {
    const parameter = await db.moodTrackingParameter.findFirst({
      where: { id: data.parameterId, accountId },
    });

    if (!parameter) throw new Error("Mood tracking parameter not found");
  }

  const event = await db.moodTrackingEvent.create({
    data: {
      contactId: data.contactId,
      parameterId: data.parameterId,
      ratedAt: data.ratedAt ?? new Date(),
      note: data.note,
      numberOfHoursSlept: data.numberOfHoursSlept,
    },
    include: {
      parameter: true,
    },
  });

  revalidatePath(`/contacts/${data.contactId}`);
  return event;
}

export async function updateMoodEvent(
  id: string,
  data: {
    parameterId?: string | null;
    ratedAt?: Date;
    note?: string | null;
    numberOfHoursSlept?: number | null;
  }
) {
  const { vault, accountId } = await getUserVaultAndAccount();

  const event = await db.moodTrackingEvent.findFirst({
    where: { id },
    include: { contact: true },
  });

  if (!event || event.contact.vaultId !== vault.id) {
    throw new Error("Mood event not found");
  }

  // Verify parameter belongs to account if provided
  if (data.parameterId) {
    const parameter = await db.moodTrackingParameter.findFirst({
      where: { id: data.parameterId, accountId },
    });

    if (!parameter) throw new Error("Mood tracking parameter not found");
  }

  const updated = await db.moodTrackingEvent.update({
    where: { id },
    data: {
      parameterId: data.parameterId,
      ratedAt: data.ratedAt,
      note: data.note,
      numberOfHoursSlept: data.numberOfHoursSlept,
    },
    include: {
      parameter: true,
    },
  });

  revalidatePath(`/contacts/${event.contactId}`);
  return updated;
}

export async function deleteMoodEvent(id: string) {
  const { vault } = await getUserVaultAndAccount();

  const event = await db.moodTrackingEvent.findFirst({
    where: { id },
    include: { contact: true },
  });

  if (!event || event.contact.vaultId !== vault.id) {
    throw new Error("Mood event not found");
  }

  await db.moodTrackingEvent.delete({
    where: { id },
  });

  revalidatePath(`/contacts/${event.contactId}`);
  return { success: true };
}

// ============================================
// MOOD STATISTICS
// ============================================

export async function getMoodStats(contactId?: string, options?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const { vault } = await getUserVaultAndAccount();

  const where: {
    contact: { vaultId: string };
    contactId?: string;
    ratedAt?: { gte?: Date; lte?: Date };
  } = { contact: { vaultId: vault.id } };

  if (contactId && contactId !== "all") {
    // Verify contact belongs to vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) throw new Error("Contact not found");
    where.contactId = contactId;
  }

  if (options?.startDate || options?.endDate) {
    where.ratedAt = {};
    if (options.startDate) where.ratedAt.gte = options.startDate;
    if (options.endDate) where.ratedAt.lte = options.endDate;
  }

  // Get mood breakdown by parameter
  const events = await db.moodTrackingEvent.findMany({
    where,
    include: { parameter: true },
  });

  // Group by parameter
  const byParameter: Record<string, { label: string; count: number }> = {};
  let totalSleepHours = 0;
  let sleepCount = 0;

  for (const event of events) {
    if (event.parameter) {
      const key = event.parameter.id;
      if (!byParameter[key]) {
        byParameter[key] = { label: event.parameter.label, count: 0 };
      }
      byParameter[key].count++;
    }

    if (event.numberOfHoursSlept) {
      totalSleepHours += event.numberOfHoursSlept;
      sleepCount++;
    }
  }

  return {
    totalEvents: events.length,
    byParameter: Object.values(byParameter),
    averageSleep: sleepCount > 0 ? totalSleepHours / sleepCount : null,
  };
}

// ============================================
// SEED DEFAULT PARAMETERS
// ============================================

export async function seedDefaultMoodParameters() {
  const { accountId } = await getUserVaultAndAccount();

  const existingCount = await db.moodTrackingParameter.count({
    where: { accountId },
  });

  if (existingCount > 0) {
    return { message: "Mood parameters already exist" };
  }

  const defaultParameters = [
    { label: "Awful", position: 0 },
    { label: "Bad", position: 1 },
    { label: "Okay", position: 2 },
    { label: "Good", position: 3 },
    { label: "Amazing", position: 4 },
  ];

  await db.moodTrackingParameter.createMany({
    data: defaultParameters.map((p) => ({
      ...p,
      accountId,
    })),
  });

  revalidatePath("/settings");
  return { success: true, created: defaultParameters.length };
}
