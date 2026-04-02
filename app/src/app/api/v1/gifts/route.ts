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

const createGiftSchema = z.object({
  contact_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  url: z.string().optional(),
  status: z.enum(["idea", "planned", "given", "received"]).optional(),
  date: z.string().optional(),
  occasion_id: z.string().optional(),
});

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
    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(createGiftSchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

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
    } = validated.data;

    try {
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
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "gifts:write"
);
