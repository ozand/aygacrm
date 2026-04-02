export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  apiPaginated,
  getPaginationParams,
  getBaseUrl,
  ApiAuthContext,
} from "@/lib/api/auth";

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
  "journal:read"
);

// POST /api/v1/journals - Create a journal
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    try {
      const body = await request.json();

      const { name, description } = body;

      if (!name) {
        return apiError("INVALID_PARAMS", 400, "name is required");
      }

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
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "journal:write"
);
