"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Helper to get current user's vault
async function getUserVault() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });

  return userVault ? { userId: session.user.id, vault: userVault.vault } : null;
}

// Types for recent activity
export interface RecentActivityItem {
  id: string;
  type: "note" | "external_record" | "task" | "call";
  title: string;
  subtitle: string | null;
  contactId: string;
  contactName: string;
  timestamp: Date;
  source?: string;
  kind?: string;
}

// Get recent activity across all contacts in the vault
export async function getRecentActivity(limit: number = 10): Promise<RecentActivityItem[]> {
  try {
    const userVault = await getUserVault();
    if (!userVault) return [];

    const { vault } = userVault;

    // Fetch recent items in parallel
    const [recentRecords, recentNotes, recentTasks] = await Promise.all([
      // Recent external records
      db.externalRecord.findMany({
        where: {
          contact: {
            vaultId: vault.id,
            deletedAt: null,
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, nickname: true },
          },
        },
      }),

      // Recent notes
      db.note.findMany({
        where: {
          vaultId: vault.id,
          contact: { deletedAt: null },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, nickname: true },
          },
        },
      }),

      // Recent tasks
      db.contactTask.findMany({
        where: {
          contact: {
            vaultId: vault.id,
            deletedAt: null,
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, nickname: true },
          },
        },
      }),
    ]);

    function contactName(c: { firstName: string | null; lastName: string | null; nickname: string | null }): string {
      return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.nickname || "Unknown";
    }

    const items: RecentActivityItem[] = [
      ...recentRecords.map((r) => ({
        id: r.id,
        type: "external_record" as const,
        title: r.title || `${r.source}/${r.kind}`,
        subtitle: r.content?.substring(0, 80) || null,
        contactId: r.contact.id,
        contactName: contactName(r.contact),
        timestamp: r.happenedAt ?? r.createdAt,
        source: r.source,
        kind: r.kind,
      })),
      ...recentNotes.map((n) => ({
        id: n.id.toString(),
        type: "note" as const,
        title: n.title || "Untitled note",
        subtitle: n.body?.substring(0, 80) || null,
        contactId: n.contactId || "",
        contactName: n.contact ? contactName(n.contact) : "Unknown",
        timestamp: n.createdAt,
      })),
      ...recentTasks.map((t) => ({
        id: t.id,
        type: "task" as const,
        title: t.name,
        subtitle: t.completed ? "Completed" : "In progress",
        contactId: t.contactId,
        contactName: contactName(t.contact),
        timestamp: t.createdAt,
      })),
    ];

    // Sort by timestamp desc, take limit
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items.slice(0, limit);
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return [];
  }
}

// Get dashboard statistics
export async function getDashboardStats() {
  try {
    const userVault = await getUserVault();
    if (!userVault) {
      return {
        totalContacts: 0,
        totalNotes: 0,
        upcomingEvents: 0,
        activeReminders: 0,
        recentContacts: [],
      };
    }

    const { vault } = userVault;

    // Count contacts (excluding self contact)
    const totalContacts = await db.contact.count({
      where: {
        vaultId: vault.id,
        deletedAt: null,
        listed: true,
        canBeDeleted: true,
      },
    });

    // Count notes
    const totalNotes = await db.note.count({
      where: { vaultId: vault.id },
    });

    // Get upcoming events (next 30 days)
    const today = new Date();
    const allDates = await db.contactImportantDate.findMany({
      where: {
        contact: {
          vaultId: vault.id,
          deletedAt: null,
          listed: true,
        },
      },
    });

    let upcomingEvents = 0;
    allDates.forEach((date) => {
      if (!date.month || !date.day) return;

      const dateThisYear = new Date(today.getFullYear(), date.month - 1, date.day);
      const dateNextYear = new Date(today.getFullYear() + 1, date.month - 1, date.day);

      let daysUntil: number;
      if (dateThisYear >= today) {
        daysUntil = Math.ceil(
          (dateThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
      } else {
        daysUntil = Math.ceil(
          (dateNextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      if (daysUntil <= 30) upcomingEvents++;
    });

    // Get recent contacts
    const recentContacts = await db.contact.findMany({
      where: {
        vaultId: vault.id,
        deletedAt: null,
        listed: true,
        canBeDeleted: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
        updatedAt: true,
      },
    });

    // Count active reminders (reminders attached to upcoming important dates)
    const activeReminders = await db.contactReminder.count({
      where: {
        importantDate: {
          contact: {
            vaultId: vault.id,
            deletedAt: null,
          },
        },
      },
    });

    return {
      totalContacts,
      totalNotes,
      upcomingEvents,
      activeReminders,
      recentContacts,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      totalContacts: 0,
      totalNotes: 0,
      upcomingEvents: 0,
      activeReminders: 0,
      recentContacts: [],
    };
  }
}
