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

const updateTagSchema = z.object({
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

// GET /api/v1/tags/[id] - Get a single tag
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const tagId = params?.id;

    if (!tagId) {
      return apiError("INVALID_PARAMS", 400, "Invalid tag ID");
    }

    const tag = await db.tag.findFirst({
      where: {
        id: tagId,
        accountId: context.accountId,
      },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
    });

    if (!tag) {
      return apiError("NOT_FOUND", 404, "Tag not found");
    }

    return apiSuccess({
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
    });
  },
  "tags:read"
);

// PUT /api/v1/tags/[id] - Update a tag
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const tagId = params?.id;

    if (!tagId) {
      return apiError("INVALID_PARAMS", 400, "Invalid tag ID");
    }

    const tag = await db.tag.findFirst({
      where: {
        id: tagId,
        accountId: context.accountId,
      },
    });

    if (!tag) {
      return apiError("NOT_FOUND", 404, "Tag not found");
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(updateTagSchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

    const { name } = validated.data;

    try {

      const newSlug = slugify(name);

      // Check if another tag with same slug exists
      const existing = await db.tag.findFirst({
        where: {
          accountId: context.accountId,
          slug: newSlug,
          NOT: { id: tagId },
        },
      });

      if (existing) {
        return apiError(
          "VALIDATION_ERROR",
          400,
          "A tag with this name already exists"
        );
      }

      // Update tag
      const updatedTag = await db.tag.update({
        where: { id: tagId },
        data: {
          name: name.trim(),
          slug: newSlug,
        },
        include: {
          _count: {
            select: { contacts: true },
          },
        },
      });

      return apiSuccess({
        id: updatedTag.id,
        object: "tag",
        name: updatedTag.name,
        name_slug: updatedTag.slug,
        contacts_count: updatedTag._count.contacts,
        account: {
          id: context.accountId,
        },
        created_at: updatedTag.createdAt.toISOString(),
        updated_at: updatedTag.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "tags:write"
);

// DELETE /api/v1/tags/[id] - Delete a tag
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const tagId = params?.id;

    if (!tagId) {
      return apiError("INVALID_PARAMS", 400, "Invalid tag ID");
    }

    const tag = await db.tag.findFirst({
      where: {
        id: tagId,
        accountId: context.accountId,
      },
    });

    if (!tag) {
      return apiError("NOT_FOUND", 404, "Tag not found");
    }

    // Delete tag (will cascade delete ContactTag junction records)
    await db.tag.delete({
      where: { id: tagId },
    });

    return apiSuccess({ deleted: true, id: tagId });
  },
  "tags:write"
);
