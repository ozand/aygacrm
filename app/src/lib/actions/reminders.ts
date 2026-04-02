"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
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

// Get all reminders for a contact
export async function getRemindersForContact(contactId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify contact belongs to user's vault
    const contact = await db.contact.findFirst({
      where: { id: contactId, vaultId: vault.id },
    });

    if (!contact) {
      return [];
    }

    const reminders = await db.contactReminder.findMany({
      where: { contactId },
      include: {
        importantDate: {
          include: { type: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return reminders;
  } catch (error) {
    console.error("Error fetching reminders:", error);
    return [];
  }
}

// Get all reminders for an important date
export async function getRemindersForImportantDate(importantDateId: string) {
  try {
    const { vault } = await getUserVault();

    // Verify important date belongs to user's vault
    const importantDate = await db.contactImportantDate.findFirst({
      where: { id: importantDateId },
      include: { contact: true },
    });

    if (!importantDate || importantDate.contact.vaultId !== vault.id) {
      return [];
    }

    const reminders = await db.contactReminder.findMany({
      where: { contactImportantDateId: importantDateId },
      orderBy: { createdAt: "desc" },
    });

    return reminders;
  } catch (error) {
    console.error("Error fetching reminders:", error);
    return [];
  }
}

// Create a reminder for an important date
export async function createReminder(formData: FormData): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const importantDateId = formData.get("importantDateId") as string;
    const contactId = formData.get("contactId") as string;
    const reminderChoice = formData.get("reminderChoice") as string;
    const numberOfDaysBefore = parseInt(formData.get("numberOfDaysBefore") as string) || 0;

    if (!importantDateId) {
      return { success: false, error: "Important date is required" };
    }

    if (!reminderChoice) {
      return { success: false, error: "Reminder choice is required" };
    }

    // Verify important date belongs to user's vault
    const importantDate = await db.contactImportantDate.findFirst({
      where: { id: importantDateId },
      include: { contact: true },
    });

    if (!importantDate || importantDate.contact.vaultId !== vault.id) {
      return { success: false, error: "Important date not found" };
    }

    // Create the reminder
    const reminder = await db.contactReminder.create({
      data: {
        contactImportantDateId: importantDateId,
        contactId: contactId || importantDate.contactId,
        reminderChoice,
        numberOfDaysBefore,
      },
    });

    revalidatePath(`/contacts/${importantDate.contactId}`);

    return { success: true, data: reminder };
  } catch (error) {
    console.error("Error creating reminder:", error);
    return { success: false, error: "Failed to create reminder" };
  }
}

// Update a reminder
export async function updateReminder(
  reminderId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    const reminderChoice = formData.get("reminderChoice") as string;
    const numberOfDaysBefore = parseInt(formData.get("numberOfDaysBefore") as string) || 0;

    // Verify reminder belongs to user's vault
    const existingReminder = await db.contactReminder.findFirst({
      where: { id: reminderId },
      include: {
        importantDate: {
          include: { contact: true },
        },
      },
    });

    if (!existingReminder || existingReminder.importantDate.contact.vaultId !== vault.id) {
      return { success: false, error: "Reminder not found" };
    }

    const reminder = await db.contactReminder.update({
      where: { id: reminderId },
      data: {
        reminderChoice,
        numberOfDaysBefore,
      },
    });

    revalidatePath(`/contacts/${existingReminder.importantDate.contactId}`);

    return { success: true, data: reminder };
  } catch (error) {
    console.error("Error updating reminder:", error);
    return { success: false, error: "Failed to update reminder" };
  }
}

// Delete a reminder
export async function deleteReminder(reminderId: string): Promise<ActionResult> {
  try {
    const { vault } = await getUserVault();

    // Verify reminder belongs to user's vault
    const existingReminder = await db.contactReminder.findFirst({
      where: { id: reminderId },
      include: {
        importantDate: {
          include: { contact: true },
        },
      },
    });

    if (!existingReminder || existingReminder.importantDate.contact.vaultId !== vault.id) {
      return { success: false, error: "Reminder not found" };
    }

    await db.contactReminder.delete({
      where: { id: reminderId },
    });

    revalidatePath(`/contacts/${existingReminder.importantDate.contactId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting reminder:", error);
    return { success: false, error: "Failed to delete reminder" };
  }
}

// Get upcoming reminders (for dashboard and notifications)
export async function getUpcomingReminders(daysAhead: number = 30) {
  try {
    const { vault } = await getUserVault();

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // Get all important dates with reminders in this vault
    const importantDatesWithReminders = await db.contactImportantDate.findMany({
      where: {
        contact: {
          vaultId: vault.id,
          deletedAt: null,
        },
        reminders: {
          some: {},
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
        type: true,
        reminders: true,
      },
    });

    // Filter to upcoming dates within the specified range
    const upcomingReminders = importantDatesWithReminders
      .map((date) => {
        // Calculate the next occurrence of this date
        const eventMonth = date.month || 1;
        const eventDay = date.day || 1;

        let eventDate = new Date(today.getFullYear(), eventMonth - 1, eventDay);

        // If the date has passed this year, use next year
        if (eventDate < today) {
          eventDate = new Date(today.getFullYear() + 1, eventMonth - 1, eventDay);
        }

        const daysUntil = Math.ceil(
          (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          ...date,
          nextOccurrence: eventDate,
          daysUntil,
        };
      })
      .filter((date) => date.daysUntil <= daysAhead)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return upcomingReminders;
  } catch (error) {
    console.error("Error fetching upcoming reminders:", error);
    return [];
  }
}

// Get reminders that need to be sent today
export async function getRemindersDueToday() {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    // Get all active reminders
    const allReminders = await db.contactReminder.findMany({
      include: {
        importantDate: {
          include: {
            contact: {
              include: {
                vault: {
                  include: {
                    users: {
                      include: {
                        user: {
                          include: {
                            notificationChannels: {
                              where: { active: true, verified: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            type: true,
          },
        },
      },
    });

    const remindersDue: Array<{
      reminder: typeof allReminders[0];
      eventDate: Date;
      contactName: string;
      eventLabel: string;
      users: Array<{
        userId: string;
        email: string;
        channels: Array<{ id: string; type: string; content: string }>;
      }>;
    }> = [];

    for (const reminder of allReminders) {
      const date = reminder.importantDate;
      const eventMonth = date.month || 1;
      const eventDay = date.day || 1;

      // Calculate when this reminder should fire
      let eventDate = new Date(currentYear, eventMonth - 1, eventDay);

      // If the date has passed this year, use next year
      if (eventDate < today) {
        eventDate = new Date(currentYear + 1, eventMonth - 1, eventDay);
      }

      // Calculate the reminder date based on settings
      let daysBeforeEvent = 0;
      switch (reminder.reminderChoice) {
        case "day":
          daysBeforeEvent = 1;
          break;
        case "week":
          daysBeforeEvent = 7;
          break;
        case "month":
          daysBeforeEvent = 30;
          break;
        default:
          daysBeforeEvent = reminder.numberOfDaysBefore;
      }

      const reminderDate = new Date(eventDate);
      reminderDate.setDate(reminderDate.getDate() - daysBeforeEvent);

      // Check if reminder is due today
      if (
        reminderDate.getFullYear() === currentYear &&
        reminderDate.getMonth() + 1 === currentMonth &&
        reminderDate.getDate() === currentDay
      ) {
        const contact = date.contact;
        const contactName = [contact.firstName, contact.lastName]
          .filter(Boolean)
          .join(" ") || contact.nickname || "Unknown";

        const eventLabel = date.label || date.type?.name || "Important Date";

        // Get all users with notification channels for this vault
        const users = contact.vault.users.map((access) => ({
          userId: access.user.id,
          email: access.user.email,
          channels: access.user.notificationChannels.map((ch) => ({
            id: ch.id,
            type: ch.type,
            content: ch.content,
          })),
        }));

        remindersDue.push({
          reminder,
          eventDate,
          contactName,
          eventLabel,
          users,
        });
      }
    }

    return remindersDue;
  } catch (error) {
    console.error("Error fetching due reminders:", error);
    return [];
  }
}
