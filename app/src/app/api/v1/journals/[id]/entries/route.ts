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

// GET /api/v1/journals/[id]/entries - List all entries for a journal
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const journalId = params?.id;
    const { page, limit } = getPaginationParams(request);
    const sort = getSortParams(request, ["createdAt", "writtenAt", "updatedAt"]);

    if (!journalId) {
      return apiError("INVALID_PARAMS", 400, "Invalid journal ID");
    }

    const journal = await getJournalWithAccess(journalId, context.userId);

    if (!journal) {
      return apiError("NOT_FOUND", 404, "Journal not found");
    }

    // Get total count
    const total = await db.post.count({
      where: { journalId },
    });

    // Get posts
    const posts = await db.post.findMany({
      where: { journalId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sort
        ? { [sort.field]: sort.direction }
        : { writtenAt: "desc" },
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
      },
    });

    // Transform to API format
    const data = posts.map((post) => ({
      id: post.id,
      object: "journal_entry",
      title: post.title,
      content: post.content,
      written_at: post.writtenAt.toISOString(),
      published_at: post.publishedAt?.toISOString() || null,
      slice_of_life: post.sliceOfLife
        ? {
            id: post.sliceOfLife.id,
            name: post.sliceOfLife.name,
          }
        : null,
      sections: post.sections.map((section) => ({
        id: section.id,
        label: section.label,
        content: section.content,
        position: section.position,
      })),
      created_at: post.createdAt.toISOString(),
      updated_at: post.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "journal:read"
);

// POST /api/v1/journals/[id]/entries - Create an entry
export const POST = withApiAuth(
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
      const { title, content, written_at, slice_of_life_id, sections } = body;

      // Create post
      const post = await db.post.create({
        data: {
          journalId,
          title: title || null,
          content: content || null,
          writtenAt: written_at ? new Date(written_at) : new Date(),
          sliceOfLifeId: slice_of_life_id || null,
          sections: sections
            ? {
                create: sections.map(
                  (
                    section: { label?: string; content?: string },
                    index: number
                  ) => ({
                    label: section.label || null,
                    content: section.content || null,
                    position: index,
                  })
                ),
              }
            : undefined,
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
        },
      });

      return apiSuccess(
        {
          id: post.id,
          object: "journal_entry",
          title: post.title,
          content: post.content,
          written_at: post.writtenAt.toISOString(),
          published_at: post.publishedAt?.toISOString() || null,
          slice_of_life: post.sliceOfLife
            ? {
                id: post.sliceOfLife.id,
                name: post.sliceOfLife.name,
              }
            : null,
          sections: post.sections.map((section) => ({
            id: section.id,
            label: section.label,
            content: section.content,
            position: section.position,
          })),
          created_at: post.createdAt.toISOString(),
          updated_at: post.updatedAt.toISOString(),
        },
        201
      );
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "journal:write"
);
