export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseJsonBody, validateBody } from "@/lib/api/validation";
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
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";

const updateJournalSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

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
  "journals:read"
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

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(updateJournalSchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

    const { name, description } = validated.data;

    try {

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

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.JOURNAL_ENTRY_UPDATED,
        objects: {
          entityId: updatedJournal.id,
          entityName: updatedJournal.name,
          entityType: "journal",
        },
        userId: context.userId,
        accountId: context.accountId,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
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
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "journals:write"
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

    await createAuditLogFromApi({
      action: AUDIT_ACTIONS.JOURNAL_ENTRY_DELETED,
      objects: {
        entityId: journal.id,
        entityName: journal.name,
        entityType: "journal",
      },
      userId: context.userId,
      accountId: context.accountId,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return apiSuccess({ deleted: true, id: journalId });
  },
  "journals:write"
);
