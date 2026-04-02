export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseJsonBody, validateBody } from "@/lib/api/validation";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";

const updateEntrySchema = z.object({
  title: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  sections: z
    .array(
      z.object({
        label: z.string().optional(),
        content: z.string().optional(),
        position: z.number().int().optional(),
      })
    )
    .optional(),
});

// Helper to verify journal access and get entry
async function getEntryWithAccess(
  journalId: string,
  entryId: number,
  userId: string
) {
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });
  const vaultIds = userVaults.map((uv) => uv.vaultId);

  if (vaultIds.length === 0) {
    return null;
  }

  // Verify journal access
  const journal = await db.journal.findFirst({
    where: {
      id: journalId,
      vaultId: { in: vaultIds },
    },
  });

  if (!journal) {
    return null;
  }

  // Get the entry
  return db.post.findFirst({
    where: {
      id: entryId,
      journalId,
    },
    include: {
      sections: {
        orderBy: { position: "asc" },
      },
      sliceOfLife: {
        select: {
          id: true,
          name: true,
        },
      },
      metrics: {
        include: {
          journalMetric: {
            select: {
              id: true,
              label: true,
              unit: true,
            },
          },
        },
      },
    },
  });
}

// Transform entry to API format
function transformEntry(
  entry: NonNullable<Awaited<ReturnType<typeof getEntryWithAccess>>>
) {
  return {
    id: entry.id,
    object: "journal_entry",
    title: entry.title,
    content: entry.content,
    written_at: entry.writtenAt.toISOString(),
    published_at: entry.publishedAt?.toISOString() || null,
    slice_of_life: entry.sliceOfLife
      ? {
          id: entry.sliceOfLife.id,
          name: entry.sliceOfLife.name,
        }
      : null,
    sections: entry.sections.map((section) => ({
      id: section.id,
      label: section.label,
      content: section.content,
      position: section.position,
    })),
    metrics: entry.metrics.map((metric) => ({
      id: metric.id,
      value: parseFloat(metric.value.toString()),
      metric: {
        id: metric.journalMetric.id,
        label: metric.journalMetric.label,
        unit: metric.journalMetric.unit,
      },
    })),
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString(),
  };
}

// GET /api/v1/journals/[id]/entries/[entryId] - Get a single entry
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const journalId = params?.id;
    const entryId = parseInt(params?.entryId || "", 10);

    if (!journalId) {
      return apiError("INVALID_PARAMS", 400, "Invalid journal ID");
    }

    if (isNaN(entryId)) {
      return apiError("INVALID_PARAMS", 400, "Invalid entry ID");
    }

    const entry = await getEntryWithAccess(journalId, entryId, context.userId);

    if (!entry) {
      return apiError("NOT_FOUND", 404, "Journal entry not found");
    }

    return apiSuccess(transformEntry(entry));
  },
  "journals:read"
);

// PUT /api/v1/journals/[id]/entries/[entryId] - Update an entry
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const journalId = params?.id;
    const entryId = parseInt(params?.entryId || "", 10);

    if (!journalId) {
      return apiError("INVALID_PARAMS", 400, "Invalid journal ID");
    }

    if (isNaN(entryId)) {
      return apiError("INVALID_PARAMS", 400, "Invalid entry ID");
    }

    const entry = await getEntryWithAccess(journalId, entryId, context.userId);

    if (!entry) {
      return apiError("NOT_FOUND", 404, "Journal entry not found");
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(updateEntrySchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

    const { title, content, sections } = validated.data;

    try {

      const updateData: Record<string, unknown> = {};

      if (title !== undefined) {
        updateData.title = title || null;
      }

      if (content !== undefined) {
        updateData.content = content || null;
      }

      // Update entry
      const updatedEntry = await db.post.update({
        where: { id: entryId },
        data: updateData,
        include: {
          sections: {
            orderBy: { position: "asc" },
          },
          sliceOfLife: {
            select: {
              id: true,
              name: true,
            },
          },
          metrics: {
            include: {
              journalMetric: {
                select: {
                  id: true,
                  label: true,
                  unit: true,
                },
              },
            },
          },
        },
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.JOURNAL_ENTRY_UPDATED,
        objects: {
          entityId: updatedEntry.id,
          entityName: updatedEntry.title || updatedEntry.content || `Journal ${journalId} entry`,
          entityType: "journal_entry",
        },
        userId: context.userId,
        accountId: context.accountId,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });

      // Handle sections update if provided
      if (sections !== undefined) {
        // Delete existing sections
        await db.postSection.deleteMany({
          where: { postId: entryId },
        });

        // Create new sections
        if (Array.isArray(sections) && sections.length > 0) {
          await db.postSection.createMany({
            data: sections.map(
              (
                section: { label?: string; content?: string },
                index: number
              ) => ({
                postId: entryId,
                label: section.label || null,
                content: section.content || null,
                position: index,
              })
            ),
          });
        }

        // Re-fetch with updated sections
        const refreshedEntry = await db.post.findUnique({
          where: { id: entryId },
          include: {
            sections: {
              orderBy: { position: "asc" },
            },
            sliceOfLife: {
              select: {
                id: true,
                name: true,
              },
            },
            metrics: {
              include: {
                journalMetric: {
                  select: {
                    id: true,
                    label: true,
                    unit: true,
                  },
                },
              },
            },
          },
        });

        if (refreshedEntry) {
          return apiSuccess(transformEntry(refreshedEntry));
        }
      }

      return apiSuccess(transformEntry(updatedEntry));
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "journals:write"
);

// DELETE /api/v1/journals/[id]/entries/[entryId] - Delete an entry
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const journalId = params?.id;
    const entryId = parseInt(params?.entryId || "", 10);

    if (!journalId) {
      return apiError("INVALID_PARAMS", 400, "Invalid journal ID");
    }

    if (isNaN(entryId)) {
      return apiError("INVALID_PARAMS", 400, "Invalid entry ID");
    }

    const entry = await getEntryWithAccess(journalId, entryId, context.userId);

    if (!entry) {
      return apiError("NOT_FOUND", 404, "Journal entry not found");
    }

    await db.post.delete({
      where: { id: entryId },
    });

    await createAuditLogFromApi({
      action: AUDIT_ACTIONS.JOURNAL_ENTRY_DELETED,
      objects: {
        entityId: entry.id,
        entityName: entry.title || entry.content || `Journal ${journalId} entry`,
        entityType: "journal_entry",
      },
      userId: context.userId,
      accountId: context.accountId,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return apiSuccess({ deleted: true, id: entryId });
  },
  "journals:write"
);
