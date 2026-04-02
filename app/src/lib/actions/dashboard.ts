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
