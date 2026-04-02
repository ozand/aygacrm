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

// GET /api/v1/gifts - List all gifts
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);
    const sort = getSortParams(request, ["createdAt", "date", "updatedAt", "name"]);
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contact_id");
    const status = url.searchParams.get("status");

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
      contact: {
        vault: { id: { in: vaultIds } },
        deletedAt: null,
      },
    };

    if (contactId) {
      where.contactId = contactId;
    }

    if (status) {
      where.status = status;
    }

    // Get total count
    const total = await db.gift.count({ where });

    // Get gifts
    const gifts = await db.gift.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sort
        ? { [sort.field]: sort.direction }
        : { createdAt: "desc" },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
        occasion: {
          select: {
            id: true,
            label: true,
          },
        },
      },
    });

    // Transform to API format
    const data = gifts.map((gift) => ({
      id: gift.id,
      object: "gift",
      name: gift.name,
      description: gift.description,
      amount: gift.amount ? parseFloat(gift.amount.toString()) : null,
      currency: gift.currency,
      url: gift.url,
      status: gift.status,
      date: gift.date?.toISOString() || null,
      occasion: gift.occasion
        ? {
            id: gift.occasion.id,
            label: gift.occasion.label,
          }
        : null,
      contact: {
        id: gift.contact.id,
        object: "contact",
        first_name: gift.contact.firstName,
        last_name: gift.contact.lastName,
        nickname: gift.contact.nickname,
        complete_name: [gift.contact.firstName, gift.contact.lastName]
          .filter(Boolean)
          .join(" "),
      },
      created_at: gift.createdAt.toISOString(),
      updated_at: gift.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "gifts:read"
);

// POST /api/v1/gifts - Create a gift
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    try {
      const body = await request.json();

      const {
        contact_id,
        name,
        description,
        amount,
        currency,
        url,
        status,
        date,
        occasion_id,
      } = body;

      if (!contact_id) {
        return apiError("INVALID_PARAMS", 400, "contact_id is required");
      }

      if (!name) {
        return apiError("INVALID_PARAMS", 400, "name is required");
      }

      // Validate status if provided
      const validStatuses = ["idea", "planned", "given", "received"];
      if (status && !validStatuses.includes(status)) {
        return apiError(
          "INVALID_PARAMS",
          400,
          `status must be one of: ${validStatuses.join(", ")}`
        );
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
      });

      if (!contact) {
        return apiError("NOT_FOUND", 404, "Contact not found");
      }

      // Create gift
      const gift = await db.gift.create({
        data: {
          contactId: contact_id,
          name,
          description: description || null,
          amount: amount ? amount : null,
          currency: currency || null,
          url: url || null,
          status: status || "idea",
          date: date ? new Date(date) : null,
          occasionId: occasion_id || null,
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
          occasion: {
            select: {
              id: true,
              label: true,
            },
          },
        },
      });

      return apiSuccess(
        {
          id: gift.id,
          object: "gift",
          name: gift.name,
          description: gift.description,
          amount: gift.amount ? parseFloat(gift.amount.toString()) : null,
          currency: gift.currency,
          url: gift.url,
          status: gift.status,
          date: gift.date?.toISOString() || null,
          occasion: gift.occasion
            ? {
                id: gift.occasion.id,
                label: gift.occasion.label,
              }
            : null,
          contact: {
            id: gift.contact.id,
            object: "contact",
            first_name: gift.contact.firstName,
            last_name: gift.contact.lastName,
            nickname: gift.contact.nickname,
          },
          created_at: gift.createdAt.toISOString(),
          updated_at: gift.updatedAt.toISOString(),
        },
        201
      );
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "gifts:write"
);
