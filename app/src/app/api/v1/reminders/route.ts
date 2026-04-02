export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  apiPaginated,
  getPaginationParams,
  getSortParams,
  getBaseUrl,
  ApiAuthContext,
} from "@/lib/api/auth";

// GET /api/v1/reminders - List all reminders
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);
    const sort = getSortParams(request, ["createdAt", "updatedAt"]);
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contact_id");

    // Get user's vaults
    const userVaults = await db.userVault.findMany({
      where: { userId: context.userId },
      select: { vaultId: true },
    });
    const vaultIds = userVaults.map((uv) => uv.vaultId);

    if (vaultIds.length === 0) {
      return apiPaginated([], page, limit, 0, getBaseUrl(request));
    }

    // Build where clause
    const where: Record<string, unknown> = {
      contact: {
        vault: { id: { in: vaultIds } },
        deletedAt: null,
      },
    };

    if (contactId) {
      where.contactId = contactId;
    }

    // Get total count
    const total = await db.contactReminder.count({ where });

    // Get reminders
    const reminders = await db.contactReminder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sort
        ? { [sort.field]: sort.direction }
        : { createdAt: "desc" },
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

    // Transform to API format
    const data = reminders.map((reminder) => ({
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
            complete_name: [
              reminder.contact.firstName,
              reminder.contact.lastName,
            ]
              .filter(Boolean)
              .join(" "),
          }
        : null,
      created_at: reminder.createdAt.toISOString(),
      updated_at: reminder.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "reminders:read"
);

// POST /api/v1/reminders - Create a reminder
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    try {
      const body = await request.json();

      const {
        contact_id,
        important_date_id,
        reminder_choice,
        number_of_days_before,
      } = body;

      if (!contact_id) {
        return apiError("INVALID_PARAMS", 400, "contact_id is required");
      }

      if (!important_date_id) {
        return apiError("INVALID_PARAMS", 400, "important_date_id is required");
      }

      if (!reminder_choice) {
        return apiError("INVALID_PARAMS", 400, "reminder_choice is required");
      }

      // Validate reminder_choice
      if (!["day", "week", "month"].includes(reminder_choice)) {
        return apiError(
          "INVALID_PARAMS",
          400,
          "reminder_choice must be day, week, or month"
        );
      }

      // Verify user has access to the contact
      const contact = await db.contact.findFirst({
        where: {
          id: contact_id,
          deletedAt: null,
          vault: {
            users: {
              some: { userId: context.userId },
            },
          },
        },
      });

      if (!contact) {
        return apiError("NOT_FOUND", 404, "Contact not found");
      }

      // Verify the important date exists and belongs to the contact
      const importantDate = await db.contactImportantDate.findFirst({
        where: {
          id: important_date_id,
          contactId: contact_id,
        },
      });

      if (!importantDate) {
        return apiError("NOT_FOUND", 404, "Important date not found");
      }

      // Create reminder
      const reminder = await db.contactReminder.create({
        data: {
          contactId: contact_id,
          contactImportantDateId: important_date_id,
          reminderChoice: reminder_choice,
          numberOfDaysBefore: number_of_days_before || 0,
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

      return apiSuccess(
        {
          id: reminder.id,
          object: "reminder",
          reminder_choice: reminder.reminderChoice,
          number_of_days_before: reminder.numberOfDaysBefore,
          important_date: {
            id: reminder.importantDate.id,
            label: reminder.importantDate.label,
            day: reminder.importantDate.day,
            month: reminder.importantDate.month,
            year: reminder.importantDate.year,
          },
          contact: reminder.contact
            ? {
                id: reminder.contact.id,
                object: "contact",
                first_name: reminder.contact.firstName,
                last_name: reminder.contact.lastName,
                nickname: reminder.contact.nickname,
              }
            : null,
          created_at: reminder.createdAt.toISOString(),
          updated_at: reminder.updatedAt.toISOString(),
        },
        201
      );
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "reminders:write"
);
