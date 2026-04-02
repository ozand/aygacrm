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

// Feed item action types
export type FeedAction =
  | "contact_created"
  | "contact_updated"
  | "note_added"
  | "note_updated"
  | "note_deleted"
  | "activity_logged"
  | "task_created"
  | "task_completed"
  | "reminder_set"
  | "call_logged"
  | "gift_added"
  | "gift_given"
  | "loan_created"
  | "loan_settled"
  | "goal_created"
  | "goal_achieved"
  | "life_event_added"
  | "relationship_added"
  | "relationship_removed"
  | "label_added"
  | "label_removed"
  | "group_joined"
  | "group_left"
  | "mood_logged"
  | "file_uploaded"
  | "address_added"
  | "important_date_added";

// Feedable types (what entities can be in the feed)
export type FeedableType =
  | "Note"
  | "Activity"
  | "ContactTask"
  | "ContactReminder"
  | "Call"
  | "Gift"
  | "Loan"
  | "Goal"
  | "LifeEvent"
  | "Relationship"
  | "ContactLabel"
  | "ContactGroup"
  | "MoodTrackingEvent"
  | "File"
  | "Address"
  | "ContactImportantDate"
  | "Contact";

// ============================================
// CREATE FEED ITEMS
// ============================================

export async function createFeedItem(data: {
  contactId: string;
  action: FeedAction;
  feedableType: FeedableType;
  feedableId: string;
  authorId?: string;
}) {
  const { vault, userId } = await getUserVaultAndAccount();

  // Verify contact belongs to vault
  const contact = await db.contact.findFirst({
    where: { id: data.contactId, vaultId: vault.id },
  });

  if (!contact) throw new Error("Contact not found");

  const feedItem = await db.contactFeedItem.create({
    data: {
      contactId: data.contactId,
      action: data.action,
      feedableType: data.feedableType,
      feedableId: data.feedableId,
      authorId: data.authorId ?? userId,
    },
  });

  return feedItem;
}

// ============================================
// GET FEED ITEMS
// ============================================

export async function getContactFeed(
  contactId: string,
  options?: {
    limit?: number;
    offset?: number;
    actions?: FeedAction[];
  }
) {
  const { vault } = await getUserVaultAndAccount();

  // Verify contact belongs to vault
  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
  });

  if (!contact) throw new Error("Contact not found");

  const where: {
    contactId: string;
    action?: { in: string[] };
  } = { contactId };

  if (options?.actions && options.actions.length > 0) {
    where.action = { in: options.actions };
  }

  const feedItems = await db.contactFeedItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });

  // Enrich feed items with related data
  const enrichedItems = await Promise.all(
    feedItems.map(async (item) => {
      let relatedData: Record<string, unknown> | null = null;

      try {
        switch (item.feedableType) {
          case "Note":
            relatedData = await db.note.findUnique({
              where: { id: parseInt(item.feedableId) },
              select: { id: true, title: true, body: true },
            });
            break;
          case "Activity":
            relatedData = await db.activity.findUnique({
              where: { id: item.feedableId },
              select: { id: true, summary: true, happenedAt: true },
            });
            break;
          case "ContactTask":
            relatedData = await db.contactTask.findUnique({
              where: { id: item.feedableId },
              select: { id: true, name: true, completed: true },
            });
            break;
          case "Call":
            relatedData = await db.call.findUnique({
              where: { id: item.feedableId },
              select: { id: true, calledAt: true, duration: true },
            });
            break;
          case "Gift":
            relatedData = await db.gift.findUnique({
              where: { id: item.feedableId },
              select: { id: true, name: true, status: true },
            });
            break;
          case "Goal":
            relatedData = await db.goal.findUnique({
              where: { id: item.feedableId },
              select: { id: true, name: true, active: true },
            });
            break;
          case "LifeEvent":
            relatedData = await db.lifeEvent.findUnique({
              where: { id: item.feedableId },
              select: { id: true, summary: true, happenedAt: true },
            });
            break;
          case "MoodTrackingEvent":
            relatedData = await db.moodTrackingEvent.findUnique({
              where: { id: item.feedableId },
              include: { parameter: { select: { label: true } } },
            });
            break;
          // Add more cases as needed
        }
      } catch {
        // Related data might have been deleted
        relatedData = null;
      }

      return {
        ...item,
        relatedData,
      };
    })
  );

  return enrichedItems;
}

// ============================================
// GET FEED SUMMARY (for dashboard)
// ============================================

export async function getRecentFeedActivity(options?: {
  limit?: number;
  contactIds?: string[];
}) {
  const { vault } = await getUserVaultAndAccount();

  // Get contacts in this vault
  const contacts = await db.contact.findMany({
    where: {
      vaultId: vault.id,
      ...(options?.contactIds ? { id: { in: options.contactIds } } : {}),
    },
    select: { id: true, firstName: true, lastName: true },
  });

  const contactMap = new Map(
    contacts.map((c) => [c.id, `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Unknown"])
  );

  const feedItems = await db.contactFeedItem.findMany({
    where: {
      contactId: { in: contacts.map((c) => c.id) },
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 20,
  });

  return feedItems.map((item) => ({
    ...item,
    contactName: contactMap.get(item.contactId) || "Unknown",
  }));
}

// ============================================
// HELPER: Record feed item when actions happen
// ============================================

// These helper functions can be called from other action files
// to automatically record feed items

export async function recordNoteAdded(contactId: string, noteId: number, authorId?: string) {
  return createFeedItem({
    contactId,
    action: "note_added",
    feedableType: "Note",
    feedableId: noteId.toString(),
    authorId,
  });
}

export async function recordActivityLogged(contactId: string, activityId: string, authorId?: string) {
  return createFeedItem({
    contactId,
    action: "activity_logged",
    feedableType: "Activity",
    feedableId: activityId,
    authorId,
  });
}

export async function recordTaskCreated(contactId: string, taskId: string, authorId?: string) {
  return createFeedItem({
    contactId,
    action: "task_created",
    feedableType: "ContactTask",
    feedableId: taskId,
    authorId,
  });
}

export async function recordTaskCompleted(contactId: string, taskId: string, authorId?: string) {
  return createFeedItem({
    contactId,
    action: "task_completed",
    feedableType: "ContactTask",
    feedableId: taskId,
    authorId,
  });
}

export async function recordCallLogged(contactId: string, callId: string, authorId?: string) {
  return createFeedItem({
    contactId,
    action: "call_logged",
    feedableType: "Call",
    feedableId: callId,
    authorId,
  });
}

export async function recordGiftAdded(contactId: string, giftId: string, authorId?: string) {
  return createFeedItem({
    contactId,
    action: "gift_added",
    feedableType: "Gift",
    feedableId: giftId,
    authorId,
  });
}

export async function recordGoalCreated(contactId: string, goalId: string, authorId?: string) {
  return createFeedItem({
    contactId,
    action: "goal_created",
    feedableType: "Goal",
    feedableId: goalId,
    authorId,
  });
}

export async function recordLifeEventAdded(contactId: string, eventId: string, authorId?: string) {
  return createFeedItem({
    contactId,
    action: "life_event_added",
    feedableType: "LifeEvent",
    feedableId: eventId,
    authorId,
  });
}

export async function recordMoodLogged(contactId: string, eventId: string, authorId?: string) {
  return createFeedItem({
    contactId,
    action: "mood_logged",
    feedableType: "MoodTrackingEvent",
    feedableId: eventId,
    authorId,
  });
}

// ============================================
// DELETE OLD FEED ITEMS (cleanup)
// ============================================

export async function cleanupOldFeedItems(daysToKeep: number = 365) {
  const { vault } = await getUserVaultAndAccount();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  // Get contacts in this vault
  const contacts = await db.contact.findMany({
    where: { vaultId: vault.id },
    select: { id: true },
  });

  const result = await db.contactFeedItem.deleteMany({
    where: {
      contactId: { in: contacts.map((c) => c.id) },
      createdAt: { lt: cutoffDate },
    },
  });

  return { deleted: result.count };
}

// ============================================
// GET FEED STATISTICS
// ============================================

export async function getFeedStats(contactId: string) {
  const { vault } = await getUserVaultAndAccount();

  // Verify contact belongs to vault
  const contact = await db.contact.findFirst({
    where: { id: contactId, vaultId: vault.id },
  });

  if (!contact) throw new Error("Contact not found");

  const totalItems = await db.contactFeedItem.count({
    where: { contactId },
  });

  // Get breakdown by action type
  const byAction = await db.contactFeedItem.groupBy({
    by: ["action"],
    where: { contactId },
    _count: true,
  });

  // Get recent activity (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentCount = await db.contactFeedItem.count({
    where: {
      contactId,
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  return {
    totalItems,
    recentCount,
    byAction: byAction.map((item) => ({
      action: item.action,
      count: item._count,
    })),
  };
}
