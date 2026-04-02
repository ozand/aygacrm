export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";

// Helper to get a task with access check
async function getTaskWithAccess(taskId: string, userId: string) {
  // Get user's vaults
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });
  const vaultIds = userVaults.map((uv) => uv.vaultId);

  if (vaultIds.length === 0) {
    return null;
  }

  return db.contactTask.findFirst({
    where: {
      id: taskId,
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
    },
  });
}

// Transform task to API format
function transformTask(
  task: NonNullable<Awaited<ReturnType<typeof getTaskWithAccess>>>
) {
  return {
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
  };
}

// GET /api/v1/tasks/[id] - Get a single task
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const taskId = params?.id;

    if (!taskId) {
      return apiError("INVALID_PARAMS", 400, "Invalid task ID");
    }

    const task = await getTaskWithAccess(taskId, context.userId);

    if (!task) {
      return apiError("NOT_FOUND", 404, "Task not found");
    }

    return apiSuccess(transformTask(task));
  },
  "tasks:read"
);

// PUT /api/v1/tasks/[id] - Update a task
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const taskId = params?.id;

    if (!taskId) {
      return apiError("INVALID_PARAMS", 400, "Invalid task ID");
    }

    const task = await getTaskWithAccess(taskId, context.userId);

    if (!task) {
      return apiError("NOT_FOUND", 404, "Task not found");
    }

    try {
      const body = await request.json();
      const { name, label, description, completed, due_at } = body;
      const taskName = name ?? label;

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (taskName !== undefined) {
        if (!taskName) {
          return apiError("INVALID_PARAMS", 400, "name cannot be empty");
        }
        updateData.name = taskName;
      }

      if (description !== undefined) {
        updateData.description = description || null;
      }

      if (completed !== undefined) {
        updateData.completed = completed;
        if (completed && !task.completed) {
          // Mark as completed now
          updateData.completedAt = new Date();
        } else if (!completed) {
          // Mark as not completed
          updateData.completedAt = null;
        }
      }

      if (due_at !== undefined) {
        updateData.dueAt = due_at ? new Date(due_at) : null;
      }

      if (Object.keys(updateData).length === 0) {
        return apiError("INVALID_PARAMS", 400, "No fields to update");
      }

      // Update task
      const updatedTask = await db.contactTask.update({
        where: { id: taskId },
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
        },
      });

      return apiSuccess(transformTask(updatedTask));
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "tasks:write"
);

// DELETE /api/v1/tasks/[id] - Delete a task
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const taskId = params?.id;

    if (!taskId) {
      return apiError("INVALID_PARAMS", 400, "Invalid task ID");
    }

    const task = await getTaskWithAccess(taskId, context.userId);

    if (!task) {
      return apiError("NOT_FOUND", 404, "Task not found");
    }

    // Delete task
    await db.contactTask.delete({
      where: { id: taskId },
    });

    return apiSuccess({ deleted: true, id: taskId });
  },
  "tasks:write"
);
