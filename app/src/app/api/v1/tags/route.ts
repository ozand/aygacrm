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

const createTagSchema = z.object({
  name: z.string().min(1),
});

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
    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(createTagSchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

    const { name } = validated.data;

    try {
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

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.TAG_CREATED,
        objects: {
          entityId: tag.id,
          entityName: tag.name,
          entityType: "tag",
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
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "tags:write"
);
