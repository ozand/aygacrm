import { db } from "@/lib/db";
import { sendToChannel } from "./transport";

export function reminderDaysBefore(
  reminderChoice: string,
  numberOfDaysBefore: number
): number {
  switch (reminderChoice) {
    case "day":
      return 1;
    case "week":
      return 7;
    case "month":
      return 30;
    default:
      return numberOfDaysBefore >= 0 ? numberOfDaysBefore : 0;
  }
}

export function isReminderDue(
  reminder: {
    reminderChoice: string;
    numberOfDaysBefore: number;
    importantDate: { day: number | null; month: number | null };
  },
  now: Date
): boolean {
  const { day, month } = reminder.importantDate;
  if (!day || !month) {
    return false;
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let eventDate = new Date(now.getFullYear(), month - 1, day);
  if (eventDate < todayStart) {
    eventDate = new Date(now.getFullYear() + 1, month - 1, day);
  }

  const daysBefore = reminderDaysBefore(
    reminder.reminderChoice,
    reminder.numberOfDaysBefore
  );
  const triggerDate = new Date(eventDate);
  triggerDate.setDate(triggerDate.getDate() - daysBefore);

  return (
    triggerDate.getFullYear() === now.getFullYear() &&
    triggerDate.getMonth() === now.getMonth() &&
    triggerDate.getDate() === now.getDate()
  );
}

export async function deliverDueReminders(now: Date = new Date()) {
  const counters = { due: 0, sent: 0, failed: 0, skipped: 0 };

  const reminders = await db.contactReminder.findMany({
    include: {
      importantDate: {
        include: {
          contact: {
            include: { vault: true },
          },
        },
      },
    },
  });

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  for (const reminder of reminders) {
    const contact = reminder.importantDate?.contact;
    if (!contact || contact.deletedAt !== null) {
      continue;
    }
    if (!isReminderDue(reminder, now)) {
      continue;
    }
    counters.due++;

    const vault = contact.vault;
    const ownerVault = await db.userVault.findFirst({
      where: { vaultId: vault.id, permission: "OWNER" },
    });
    let userId = ownerVault?.userId;
    if (!userId) {
      const user = await db.user.findFirst({
        where: { accountId: vault.accountId },
      });
      userId = user?.id;
    }
    if (!userId) {
      counters.skipped++;
      continue;
    }

    const channels = await db.userNotificationChannel.findMany({
      where: { userId, active: true },
    });
    if (channels.length === 0) {
      counters.skipped++;
      continue;
    }

    const contactName =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      "a contact";
    const label = reminder.importantDate.label || "Important date";
    const daysBefore = reminderDaysBefore(
      reminder.reminderChoice,
      reminder.numberOfDaysBefore
    );
    const subject = `Reminder: ${label} — ${contactName}`;
    const body = `${label} for ${contactName} is on ${reminder.importantDate.day}/${reminder.importantDate.month}${daysBefore > 0 ? `, in ${daysBefore} day(s)` : ", today"}.`;

    for (const channel of channels) {
      const alreadySent = await db.userNotificationSent.findFirst({
        where: {
          channelId: channel.id,
          reminderId: reminder.id,
          status: "sent",
          sentAt: { gte: dayStart, lt: dayEnd },
        },
      });
      if (alreadySent) {
        counters.skipped++;
        continue;
      }

      const result = await sendToChannel(channel, subject, body);

      await db.userNotificationSent.create({
        data: {
          channelId: channel.id,
          reminderId: reminder.id,
          subject,
          body,
          status: result.ok ? "sent" : "failed",
          error: result.error ?? null,
        },
      });

      if (result.ok) {
        counters.sent++;
      } else {
        counters.failed++;
        await db.userNotificationChannel.update({
          where: { id: channel.id },
          data: { failedAttempts: { increment: 1 } },
        });
      }
    }
  }

  return counters;
}
