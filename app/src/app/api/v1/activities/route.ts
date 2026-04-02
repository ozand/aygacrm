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

// GET /api/v1/activities - List all activities
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);
    const sort = getSortParams(request, ["createdAt", "happenedAt", "updatedAt"]);
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contact_id");

    // Get user's vaults
    const userVaults = await db.userVault.findMany({
      where: { userId: context.userId },
      select: { vaultId: true },
    });
    const vaultIds = userVaults.map((uv) => uv.vaultId);

    if (vaultIds.length === 0) {
      return apiPaginated([], page, limit, 0, getBaseUrl(request));
    }

    // Build where clause
    const where: Record<string, unknown> = {
      vaultId: { in: vaultIds },
    };

    if (contactId) {
      where.contactId = contactId;
    }

    // Get total count
    const total = await db.activity.count({ where });

    // Get activities
    const activities = await db.activity.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sort
        ? { [sort.field]: sort.direction }
        : { happenedAt: "desc" },
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

    // Transform to API format
    const data = activities.map((activity) => ({
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
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "activities:read"
);

// POST /api/v1/activities - Create an activity
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    try {
      const body = await request.json();

      const { contact_id, summary, description, happened_at } = body;

      if (!contact_id) {
        return apiError("INVALID_PARAMS", 400, "contact_id is required");
      }

      // Verify user has access to the contact
      const contact = await db.contact.findFirst({
        where: {
          id: contact_id,
          deletedAt: null,
          vault: {
            users: {
              some: { userId: context.userId },
            },
          },
        },
        include: {
          vault: { select: { id: true } },
        },
      });

      if (!contact) {
        return apiError("NOT_FOUND", 404, "Contact not found");
      }

      // Create activity
      const activity = await db.activity.create({
        data: {
          contactId: contact_id,
          vaultId: contact.vault.id,
          authorId: context.userId,
          summary: summary || null,
          description: description || null,
          happenedAt: happened_at ? new Date(happened_at) : new Date(),
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
        },
      });

      return apiSuccess(
        {
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
          },
          created_at: activity.createdAt.toISOString(),
          updated_at: activity.updatedAt.toISOString(),
        },
        201
      );
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "activities:write"
);
