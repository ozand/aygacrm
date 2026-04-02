export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";

// Helper to get a reminder with access check
async function getReminderWithAccess(reminderId: string, userId: string) {
  // Get user's vaults
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });
  const vaultIds = userVaults.map((uv) => uv.vaultId);

  if (vaultIds.length === 0) {
    return null;
  }

  return db.contactReminder.findFirst({
    where: {
      id: reminderId,
      contact: {
        vault: { id: { in: vaultIds } },
        deletedAt: null,
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
      importantDate: {
        select: {
          id: true,
          label: true,
          day: true,
          month: true,
          year: true,
        },
      },
    },
  });
}

// Transform reminder to API format
function transformReminder(
  reminder: NonNullable<Awaited<ReturnType<typeof getReminderWithAccess>>>
) {
  return {
    id: reminder.id,
    object: "reminder",
    reminder_choice: reminder.reminderChoice,
    number_of_days_before: reminder.numberOfDaysBefore,
    important_date: reminder.importantDate
      ? {
          id: reminder.importantDate.id,
          label: reminder.importantDate.label,
          day: reminder.importantDate.day,
          month: reminder.importantDate.month,
          year: reminder.importantDate.year,
        }
      : null,
    contact: reminder.contact
      ? {
          id: reminder.contact.id,
          object: "contact",
          first_name: reminder.contact.firstName,
          last_name: reminder.contact.lastName,
          nickname: reminder.contact.nickname,
          complete_name: [reminder.contact.firstName, reminder.contact.lastName]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    created_at: reminder.createdAt.toISOString(),
    updated_at: reminder.updatedAt.toISOString(),
  };
}

// GET /api/v1/reminders/[id] - Get a single reminder
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const reminderId = params?.id;

    if (!reminderId) {
      return apiError("INVALID_PARAMS", 400, "Invalid reminder ID");
    }

    const reminder = await getReminderWithAccess(reminderId, context.userId);

    if (!reminder) {
      return apiError("NOT_FOUND", 404, "Reminder not found");
    }

    return apiSuccess(transformReminder(reminder));
  },
  "reminders:read"
);

// PUT /api/v1/reminders/[id] - Update a reminder
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const reminderId = params?.id;

    if (!reminderId) {
      return apiError("INVALID_PARAMS", 400, "Invalid reminder ID");
    }

    const reminder = await getReminderWithAccess(reminderId, context.userId);

    if (!reminder) {
      return apiError("NOT_FOUND", 404, "Reminder not found");
    }

    try {
      const body = await request.json();
      const { reminder_choice, number_of_days_before } = body;

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (reminder_choice !== undefined) {
        if (!["day", "week", "month"].includes(reminder_choice)) {
          return apiError(
            "INVALID_PARAMS",
            400,
            "reminder_choice must be day, week, or month"
          );
        }
        updateData.reminderChoice = reminder_choice;
      }

      if (number_of_days_before !== undefined) {
        updateData.numberOfDaysBefore = number_of_days_before;
      }

      if (Object.keys(updateData).length === 0) {
        return apiError("INVALID_PARAMS", 400, "No fields to update");
      }

      // Update reminder
      const updatedReminder = await db.contactReminder.update({
        where: { id: reminderId },
        data: updateData,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              nickname: true,
            },
          },
          importantDate: {
            select: {
              id: true,
              label: true,
              day: true,
              month: true,
              year: true,
            },
          },
        },
      });

      return apiSuccess(transformReminder(updatedReminder));
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "reminders:write"
);

// DELETE /api/v1/reminders/[id] - Delete a reminder
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const reminderId = params?.id;

    if (!reminderId) {
      return apiError("INVALID_PARAMS", 400, "Invalid reminder ID");
    }

    const reminder = await getReminderWithAccess(reminderId, context.userId);

    if (!reminder) {
      return apiError("NOT_FOUND", 404, "Reminder not found");
    }

    // Delete reminder
    await db.contactReminder.delete({
      where: { id: reminderId },
    });

    return apiSuccess({ deleted: true, id: reminderId });
  },
  "reminders:write"
);
