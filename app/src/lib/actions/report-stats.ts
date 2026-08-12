"use server";

import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getUserVault() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });
  if (!userVault) throw new Error("No vault found");
  return { userId: session.user.id, vault: userVault.vault };
}

function toDaysBetween(startDate: Date, endDate: Date) {
  const dayMs = 1000 * 60 * 60 * 24;
  const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / dayMs);
  return Math.max(diff, 0);
}

function getDaysUntil(month: number, day: number) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dateThisYear = new Date(today.getFullYear(), month - 1, day);
  const targetDate = dateThisYear >= startOfToday
    ? dateThisYear
    : new Date(today.getFullYear() + 1, month - 1, day);

  const dayMs = 1000 * 60 * 60 * 24;
  return Math.ceil((targetDate.getTime() - startOfToday.getTime()) / dayMs);
}

function displayName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || "Unnamed";
}

function classifyDate(item: {
  type: { type: string | null } | null;
  label: string | null;
}): "birthday" | "anniversary" | "other" {
  const rawType = item.type?.type?.toLowerCase();
  if (rawType === "birthday" || rawType === "anniversary") return rawType;
  if (!item.type) {
    const label = item.label?.toLowerCase() ?? "";
    if (label.includes("birthday")) return "birthday";
    if (label.includes("anniversary")) return "anniversary";
  }
  return "other";
}

export async function getImportantDatesStats(options: {
  startDate: Date;
  endDate: Date;
}) {
  const { vault } = await getUserVault();
  const daysAhead = toDaysBetween(options.startDate, options.endDate);

  const dates = await db.contactImportantDate.findMany({
    where: {
      contact: {
        vaultId: vault.id,
        deletedAt: null,
        listed: true,
      },
    },
    include: {
      type: true,
      contact: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const byTypeCount: Record<"birthday" | "anniversary" | "other", number> = {
    birthday: 0,
    anniversary: 0,
    other: 0,
  };

  const upcoming = dates
    .map((item) => {
      if (!item.month || !item.day) return null;

      const type = classifyDate(item);
      byTypeCount[type] += 1;

      const daysUntil = getDaysUntil(item.month, item.day);
      if (daysUntil > daysAhead) return null;

      return {
        contactName: displayName(item.contact.firstName, item.contact.lastName),
        label: item.label || item.type?.name || format(new Date(2020, item.month - 1, item.day), "MMMM d"),
        daysUntil,
        month: item.month,
        day: item.day,
      };
    })
    .filter((item): item is {
      contactName: string;
      label: string;
      daysUntil: number;
      month: number;
      day: number;
    } => item !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  for (const item of dates) {
    const type = classifyDate(item);
    if (!item.month || !item.day) {
      byTypeCount[type] += 1;
    }
  }

  return {
    totalDates: dates.length,
    byType: [
      { label: "Birthday", count: byTypeCount.birthday },
      { label: "Anniversary", count: byTypeCount.anniversary },
      { label: "Other", count: byTypeCount.other },
    ],
    upcoming,
  };
}

export async function getActivityStats(options: {
  startDate: Date;
  endDate: Date;
}) {
  const { vault } = await getUserVault();

  const [activities, notes, calls] = await Promise.all([
    db.activity.findMany({
      where: {
        vaultId: vault.id,
        happenedAt: {
          gte: options.startDate,
          lte: options.endDate,
        },
        contact: {
          deletedAt: null,
          listed: true,
        },
      },
      select: { happenedAt: true },
    }),
    db.note.findMany({
      where: {
        vaultId: vault.id,
        createdAt: {
          gte: options.startDate,
          lte: options.endDate,
        },
        contact: {
          deletedAt: null,
          listed: true,
        },
      },
      select: { createdAt: true },
    }),
    db.call.findMany({
      where: {
        calledAt: {
          gte: options.startDate,
          lte: options.endDate,
        },
        contact: {
          vaultId: vault.id,
          deletedAt: null,
          listed: true,
        },
      },
      select: { calledAt: true },
    }),
  ]);

  const monthMap = new Map<string, { name: string; activities: number; notes: number; calls: number }>();
  const monthCursor = new Date(options.startDate.getFullYear(), options.startDate.getMonth(), 1);
  const monthLimit = new Date(options.endDate.getFullYear(), options.endDate.getMonth(), 1);

  while (monthCursor <= monthLimit) {
    const key = format(monthCursor, "yyyy-MM");
    monthMap.set(key, {
      name: format(monthCursor, "MMM"),
      activities: 0,
      notes: 0,
      calls: 0,
    });
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }

  for (const activity of activities) {
    if (!activity.happenedAt) continue;
    const key = format(activity.happenedAt, "yyyy-MM");
    const month = monthMap.get(key);
    if (month) month.activities += 1;
  }

  for (const note of notes) {
    const key = format(note.createdAt, "yyyy-MM");
    const month = monthMap.get(key);
    if (month) month.notes += 1;
  }

  for (const call of calls) {
    const key = format(call.calledAt, "yyyy-MM");
    const month = monthMap.get(key);
    if (month) month.calls += 1;
  }

  return {
    totalActivities: activities.length,
    totalNotes: notes.length,
    totalCalls: calls.length,
    byMonth: Array.from(monthMap.values()),
  };
}

export async function getGiftsLoansStats() {
  const { vault } = await getUserVault();

  const [giftGroups, loans] = await Promise.all([
    db.gift.groupBy({
      by: ["status"],
      where: {
        contact: {
          vaultId: vault.id,
          deletedAt: null,
          listed: true,
        },
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.loan.findMany({
      where: {
        OR: [
          {
            loaner: {
              vaultId: vault.id,
              deletedAt: null,
              listed: true,
            },
          },
          {
            loanee: {
              vaultId: vault.id,
              deletedAt: null,
              listed: true,
            },
          },
        ],
      },
      select: {
        amount: true,
        settledAt: true,
      },
    }),
  ]);

  const statuses = ["idea", "planned", "given", "received"];
  const byStatus = statuses.map((status) => {
    const group = giftGroups.find((item) => item.status === status);
    return {
      status,
      count: group?._count._all ?? 0,
      totalAmount: Number(group?._sum.amount ?? 0),
    };
  });

  const settled = loans.filter((loan) => loan.settledAt !== null).length;
  const outstanding = loans.length - settled;
  const outstandingAmount = loans
    .filter((loan) => loan.settledAt === null)
    .reduce((sum, loan) => sum + Number(loan.amount), 0);

  return {
    gifts: {
      byStatus,
      total: byStatus.reduce((sum, item) => sum + item.count, 0),
    },
    loans: {
      total: loans.length,
      settled,
      outstanding,
      outstandingAmount,
    },
  };
}
