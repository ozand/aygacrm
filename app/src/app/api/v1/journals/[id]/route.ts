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

// Helper to verify journal access
async function getJournalWithAccess(journalId: string, userId: string) {
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });
  const vaultIds = userVaults.map((uv) => uv.vaultId);

  if (vaultIds.length === 0) {
    return null;
  }

  return db.journal.findFirst({
    where: {
      id: journalId,
      vaultId: { in: vaultIds },
    },
  });
}

// GET /api/v1/journals/[id] - Get a single journal
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const journalId = params?.id;

    if (!journalId) {
      return apiError("INVALID_PARAMS", 400, "Invalid journal ID");
    }

    const journal = await getJournalWithAccess(journalId, context.userId);

    if (!journal) {
      return apiError("NOT_FOUND", 404, "Journal not found");
    }

    const postsCount = await db.post.count({
      where: { journalId: journal.id },
    });

    return apiSuccess({
      id: journal.id,
      object: "journal",
      name: journal.name,
      description: journal.description,
      posts_count: postsCount,
      created_at: journal.createdAt.toISOString(),
      updated_at: journal.updatedAt.toISOString(),
    });
  },
  "journal:read"
);

// PUT /api/v1/journals/[id] - Update a journal
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const journalId = params?.id;

    if (!journalId) {
      return apiError("INVALID_PARAMS", 400, "Invalid journal ID");
    }

    const journal = await getJournalWithAccess(journalId, context.userId);

    if (!journal) {
      return apiError("NOT_FOUND", 404, "Journal not found");
    }

    try {
      const body = await request.json();
      const { name, description } = body;

      const updateData: Record<string, unknown> = {};

      if (name !== undefined) {
        if (!name) {
          return apiError("INVALID_PARAMS", 400, "name cannot be empty");
        }
        updateData.name = name;
      }

      if (description !== undefined) {
        updateData.description = description || null;
      }

      if (Object.keys(updateData).length === 0) {
        return apiError("INVALID_PARAMS", 400, "No fields to update");
      }

      const updatedJournal = await db.journal.update({
        where: { id: journalId },
        data: updateData,
        include: {
          _count: {
            select: { posts: true },
          },
        },
      });

      return apiSuccess({
        id: updatedJournal.id,
        object: "journal",
        name: updatedJournal.name,
        description: updatedJournal.description,
        posts_count: updatedJournal._count.posts,
        created_at: updatedJournal.createdAt.toISOString(),
        updated_at: updatedJournal.updatedAt.toISOString(),
      });
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "journal:write"
);

// DELETE /api/v1/journals/[id] - Delete a journal
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const journalId = params?.id;

    if (!journalId) {
      return apiError("INVALID_PARAMS", 400, "Invalid journal ID");
    }

    const journal = await getJournalWithAccess(journalId, context.userId);

    if (!journal) {
      return apiError("NOT_FOUND", 404, "Journal not found");
    }

    await db.journal.delete({
      where: { id: journalId },
    });

    return apiSuccess({ deleted: true, id: journalId });
  },
  "journal:write"
);
