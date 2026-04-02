export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";

// Helper to get an activity with access check
async function getActivityWithAccess(activityId: string, userId: string) {
  // Get user's vaults
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });
  const vaultIds = userVaults.map((uv) => uv.vaultId);

  if (vaultIds.length === 0) {
    return null;
  }

  return db.activity.findFirst({
    where: {
      id: activityId,
      vaultId: { in: vaultIds },
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
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

// Transform activity to API format
function transformActivity(activity: NonNullable<Awaited<ReturnType<typeof getActivityWithAccess>>>) {
  return {
    id: activity.id,
    object: "activity",
    summary: activity.summary,
    description: activity.description,
    happened_at: activity.happenedAt?.toISOString() || null,
    contact: {
      id: activity.contact.id,
      object: "contact",
      first_name: activity.contact.firstName,
      last_name: activity.contact.lastName,
      nickname: activity.contact.nickname,
      complete_name: [activity.contact.firstName, activity.contact.lastName]
        .filter(Boolean)
        .join(" "),
    },
    author: activity.author
      ? {
          id: activity.author.id,
          name: [activity.author.firstName, activity.author.lastName]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    created_at: activity.createdAt.toISOString(),
    updated_at: activity.updatedAt.toISOString(),
  };
}

// GET /api/v1/activities/[id] - Get a single activity
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const activityId = params?.id;

    if (!activityId) {
      return apiError("INVALID_PARAMS", 400, "Invalid activity ID");
    }

    const activity = await getActivityWithAccess(activityId, context.userId);

    if (!activity) {
      return apiError("NOT_FOUND", 404, "Activity not found");
    }

    return apiSuccess(transformActivity(activity));
  },
  "activities:read"
);

// PUT /api/v1/activities/[id] - Update an activity
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const activityId = params?.id;

    if (!activityId) {
      return apiError("INVALID_PARAMS", 400, "Invalid activity ID");
    }

    const activity = await getActivityWithAccess(activityId, context.userId);

    if (!activity) {
      return apiError("NOT_FOUND", 404, "Activity not found");
    }

    try {
      const body = await request.json();
      const { summary, description, happened_at } = body;

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (summary !== undefined) {
        updateData.summary = summary || null;
      }

      if (description !== undefined) {
        updateData.description = description || null;
      }

      if (happened_at !== undefined) {
        updateData.happenedAt = happened_at ? new Date(happened_at) : null;
      }

      if (Object.keys(updateData).length === 0) {
        return apiError("INVALID_PARAMS", 400, "No fields to update");
      }

      // Update activity
      const updatedActivity = await db.activity.update({
        where: { id: activityId },
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
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return apiSuccess(transformActivity(updatedActivity));
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "activities:write"
);

// DELETE /api/v1/activities/[id] - Delete an activity
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const activityId = params?.id;

    if (!activityId) {
      return apiError("INVALID_PARAMS", 400, "Invalid activity ID");
    }

    const activity = await getActivityWithAccess(activityId, context.userId);

    if (!activity) {
      return apiError("NOT_FOUND", 404, "Activity not found");
    }

    // Delete activity
    await db.activity.delete({
      where: { id: activityId },
    });

    return apiSuccess({ deleted: true, id: activityId });
  },
  "activities:write"
);
