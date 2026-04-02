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

// Helper to slugify tag name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// GET /api/v1/tags - List all tags
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);

    // Get total count
    const total = await db.tag.count({
      where: { accountId: context.accountId },
    });

    // Get tags
    const tags = await db.tag.findMany({
      where: { accountId: context.accountId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
    });

    // Transform to API format
    const data = tags.map((tag) => ({
      id: tag.id,
      object: "tag",
      name: tag.name,
      name_slug: tag.slug,
      contacts_count: tag._count.contacts,
      account: {
        id: context.accountId,
      },
      created_at: tag.createdAt.toISOString(),
      updated_at: tag.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "tags:read"
);

// POST /api/v1/tags - Create a tag
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    try {
      const body = await request.json();

      const { name } = body;

      if (!name) {
        return apiError("INVALID_PARAMS", 400, "name is required");
      }

      const slug = slugify(name);

      // Check if tag with same slug exists
      const existing = await db.tag.findFirst({
        where: {
          accountId: context.accountId,
          slug,
        },
      });

      if (existing) {
        return apiError(
          "VALIDATION_ERROR",
          400,
          "A tag with this name already exists"
        );
      }

      // Create tag
      const tag = await db.tag.create({
        data: {
          accountId: context.accountId,
          name: name.trim(),
          slug,
        },
      });

      return apiSuccess(
        {
          id: tag.id,
          object: "tag",
          name: tag.name,
          name_slug: tag.slug,
          account: {
            id: context.accountId,
          },
          created_at: tag.createdAt.toISOString(),
          updated_at: tag.updatedAt.toISOString(),
        },
        201
      );
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "tags:write"
);
