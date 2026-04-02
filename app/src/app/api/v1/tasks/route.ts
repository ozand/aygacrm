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

// GET /api/v1/tasks - List all tasks
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);
    const sort = getSortParams(request, ["createdAt", "dueAt", "updatedAt"]);
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contact_id");
    const completedStr = url.searchParams.get("completed");

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

    if (completedStr !== null) {
      where.completed = completedStr === "true";
    }

    // Get total count
    const total = await db.contactTask.count({ where });

    // Get tasks
    const tasks = await db.contactTask.findMany({
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
      },
    });

    // Transform to API format
    const data = tasks.map((task) => ({
      id: task.id,
      object: "task",
      name: task.name,
      description: task.description,
      completed: task.completed,
      completed_at: task.completedAt?.toISOString() || null,
      due_at: task.dueAt?.toISOString() || null,
      contact: {
        id: task.contact.id,
        object: "contact",
        first_name: task.contact.firstName,
        last_name: task.contact.lastName,
        nickname: task.contact.nickname,
        complete_name: [task.contact.firstName, task.contact.lastName]
          .filter(Boolean)
          .join(" "),
      },
      created_at: task.createdAt.toISOString(),
      updated_at: task.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "tasks:read"
);

// POST /api/v1/tasks - Create a task
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    try {
      const body = await request.json();

      const { contact_id, name, label, description, due_at } = body;
      const taskName = name ?? label;

      if (!contact_id) {
        return apiError("INVALID_PARAMS", 400, "contact_id is required");
      }

      if (!taskName) {
        return apiError("INVALID_PARAMS", 400, "name is required");
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

      // Create task
      const task = await db.contactTask.create({
        data: {
          contactId: contact_id,
          name: taskName,
          description: description || null,
          dueAt: due_at ? new Date(due_at) : null,
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
        },
      });

      return apiSuccess(
        {
          id: task.id,
          object: "task",
          name: task.name,
          description: task.description,
          completed: task.completed,
          completed_at: task.completedAt?.toISOString() || null,
          due_at: task.dueAt?.toISOString() || null,
          contact: {
            id: task.contact.id,
            object: "contact",
            first_name: task.contact.firstName,
            last_name: task.contact.lastName,
            nickname: task.contact.nickname,
          },
          created_at: task.createdAt.toISOString(),
          updated_at: task.updatedAt.toISOString(),
        },
        201
      );
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "tasks:write"
);
