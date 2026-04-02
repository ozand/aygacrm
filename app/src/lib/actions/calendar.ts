"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";

async function getUserVault() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const userVault = await db.userVault.findFirst({
    where: { userId: session.user.id },
    include: { vault: true },
  });

  if (!userVault) {
    throw new Error("No vault found");
  }

  return userVault.vault;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "important_date" | "task" | "activity" | "life_event" | "call";
  contactId?: string;
  contactName?: string;
  color?: string;
  url?: string;
}

export async function getCalendarEvents(
  year: number,
  month: number
): Promise<CalendarEvent[]> {
  const vault = await getUserVault();

  // Calculate date range (include days from prev/next months visible in calendar)
  const targetDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const events: CalendarEvent[] = [];

  // 1. Important Dates (birthdays, anniversaries, etc.) - recurring annually
  const importantDates = await db.contactImportantDate.findMany({
    where: {
      contact: { vaultId: vault.id },
    },
    include: {
      contact: true,
      type: true,
    },
  });

  for (const impDate of importantDates) {
    if (impDate.month && impDate.day) {
      const thisYearDate = new Date(year, impDate.month - 1, impDate.day);
      
      if (thisYearDate >= calendarStart && thisYearDate <= calendarEnd) {
        events.push({
          id: `important-${impDate.id}`,
          title: `${impDate.type?.name || impDate.label || "Important Date"}: ${impDate.contact.firstName} ${impDate.contact.lastName || ""}`.trim(),
          date: thisYearDate,
          type: "important_date",
          contactId: impDate.contactId,
          contactName: `${impDate.contact.firstName} ${impDate.contact.lastName || ""}`.trim(),
          color: "#ec4899", // pink
          url: `/contacts/${impDate.contactId}`,
        });
      }
    }
  }

  // 2. Tasks with due dates
  const tasks = await db.contactTask.findMany({
    where: {
      contact: { vaultId: vault.id },
      dueAt: {
        gte: calendarStart,
        lte: calendarEnd,
      },
    },
    include: {
      contact: true,
    },
  });

  for (const task of tasks) {
    if (task.dueAt) {
      events.push({
        id: `task-${task.id}`,
        title: task.name,
        date: new Date(task.dueAt),
        type: "task",
        contactId: task.contactId,
        contactName: `${task.contact.firstName} ${task.contact.lastName || ""}`.trim(),
        color: task.completedAt ? "#22c55e" : "#3b82f6", // green if done, blue otherwise
        url: `/contacts/${task.contactId}`,
      });
    }
  }

  // 3. Activities
  const activities = await db.activity.findMany({
    where: {
      contact: { vaultId: vault.id },
      happenedAt: {
        gte: calendarStart,
        lte: calendarEnd,
      },
    },
    include: {
      contact: true,
    },
  });

  for (const activity of activities) {
    if (activity.happenedAt) {
      events.push({
        id: `activity-${activity.id}`,
        title: activity.summary || "Activity",
        date: new Date(activity.happenedAt),
        type: "activity",
        contactId: activity.contactId,
        contactName: `${activity.contact.firstName} ${activity.contact.lastName || ""}`.trim(),
        color: "#8b5cf6", // violet
        url: `/contacts/${activity.contactId}`,
      });
    }
  }

  // 4. Life Events
  const lifeEvents = await db.lifeEvent.findMany({
    where: {
      contact: { vaultId: vault.id },
      happenedAt: {
        gte: calendarStart,
        lte: calendarEnd,
      },
    },
    include: {
      contact: true,
      lifeEventType: true,
    },
  });

  for (const event of lifeEvents) {
    events.push({
      id: `life-${event.id}`,
      title: event.summary || event.lifeEventType?.label || "Life Event",
      date: new Date(event.happenedAt),
      type: "life_event",
      contactId: event.contactId,
      contactName: `${event.contact.firstName} ${event.contact.lastName || ""}`.trim(),
      color: "#06b6d4", // cyan
      url: `/contacts/${event.contactId}`,
    });
  }

  // 5. Calls
  const calls = await db.call.findMany({
    where: {
      contact: { vaultId: vault.id },
      calledAt: {
        gte: calendarStart,
        lte: calendarEnd,
      },
    },
    include: {
      contact: true,
    },
  });

  for (const call of calls) {
    events.push({
      id: `call-${call.id}`,
      title: `Call with ${call.contact.firstName}`,
      date: new Date(call.calledAt),
      type: "call",
      contactId: call.contactId,
      contactName: `${call.contact.firstName} ${call.contact.lastName || ""}`.trim(),
      color: "#10b981", // emerald
      url: `/contacts/${call.contactId}`,
    });
  }

  // Sort by date
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  return events;
}

export async function getUpcomingEvents(limit = 10): Promise<CalendarEvent[]> {
  const now = new Date();
  
  const events = await getCalendarEvents(
    now.getFullYear(),
    now.getMonth() + 1
  );

  // Filter to only future events and limit
  return events
    .filter((e) => e.date >= now)
    .slice(0, limit);
}
