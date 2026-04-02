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
  getBaseUrl,
  ApiAuthContext,
} from "@/lib/api/auth";
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";

const createJournalSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// GET /api/v1/journals - List all journals
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);

    // Get user's vaults
    const userVaults = await db.userVault.findMany({
      where: { userId: context.userId },
      select: { vaultId: true },
    });
    const vaultIds = userVaults.map((uv) => uv.vaultId);

    if (vaultIds.length === 0) {
      return apiPaginated([], page, limit, 0, getBaseUrl(request));
    }

    // Get total count
    const total = await db.journal.count({
      where: { vaultId: { in: vaultIds } },
    });

    // Get journals
    const journals = await db.journal.findMany({
      where: { vaultId: { in: vaultIds } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });

    // Transform to API format
    const data = journals.map((journal) => ({
      id: journal.id,
      object: "journal",
      name: journal.name,
      description: journal.description,
      posts_count: journal._count.posts,
      created_at: journal.createdAt.toISOString(),
      updated_at: journal.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "journals:read"
);

// POST /api/v1/journals - Create a journal
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(createJournalSchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

    const { name, description } = validated.data;

    try {
      // Get user's first vault
      const userVault = await db.userVault.findFirst({
        where: { userId: context.userId },
        include: { vault: true },
      });

      if (!userVault) {
        return apiError("NOT_FOUND", 404, "Vault not found");
      }

      // Create journal
      const journal = await db.journal.create({
        data: {
          vaultId: userVault.vaultId,
          name,
          description: description || null,
        },
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.JOURNAL_ENTRY_CREATED,
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

      return apiSuccess(
        {
          id: journal.id,
          object: "journal",
          name: journal.name,
          description: journal.description,
          posts_count: 0,
          created_at: journal.createdAt.toISOString(),
          updated_at: journal.updatedAt.toISOString(),
        },
        201
      );
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "journals:write"
);
