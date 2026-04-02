export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";

// Helper to get a gift with access check
async function getGiftWithAccess(giftId: string, userId: string) {
  // Get user's vaults
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });
  const vaultIds = userVaults.map((uv) => uv.vaultId);

  if (vaultIds.length === 0) {
    return null;
  }

  return db.gift.findFirst({
    where: {
      id: giftId,
      contact: {
        vault: { id: { in: vaultIds } },
        deletedAt: null,
      },
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
}

// Transform gift to API format
function transformGift(
  gift: NonNullable<Awaited<ReturnType<typeof getGiftWithAccess>>>
) {
  return {
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
  };
}

// GET /api/v1/gifts/[id] - Get a single gift
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const giftId = params?.id;

    if (!giftId) {
      return apiError("INVALID_PARAMS", 400, "Invalid gift ID");
    }

    const gift = await getGiftWithAccess(giftId, context.userId);

    if (!gift) {
      return apiError("NOT_FOUND", 404, "Gift not found");
    }

    return apiSuccess(transformGift(gift));
  },
  "gifts:read"
);

// PUT /api/v1/gifts/[id] - Update a gift
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const giftId = params?.id;

    if (!giftId) {
      return apiError("INVALID_PARAMS", 400, "Invalid gift ID");
    }

    const gift = await getGiftWithAccess(giftId, context.userId);

    if (!gift) {
      return apiError("NOT_FOUND", 404, "Gift not found");
    }

    try {
      const body = await request.json();
      const { name, description, amount, currency, url, status, date, occasion_id } =
        body;

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (name !== undefined) {
        if (!name) {
          return apiError("INVALID_PARAMS", 400, "name cannot be empty");
        }
        updateData.name = name;
      }

      if (description !== undefined) {
        updateData.description = description || null;
      }

      if (amount !== undefined) {
        updateData.amount = amount ? amount : null;
      }

      if (currency !== undefined) {
        updateData.currency = currency || null;
      }

      if (url !== undefined) {
        updateData.url = url || null;
      }

      if (status !== undefined) {
        const validStatuses = ["idea", "planned", "given", "received"];
        if (!validStatuses.includes(status)) {
          return apiError(
            "INVALID_PARAMS",
            400,
            `status must be one of: ${validStatuses.join(", ")}`
          );
        }
        updateData.status = status;
      }

      if (date !== undefined) {
        updateData.date = date ? new Date(date) : null;
      }

      if (occasion_id !== undefined) {
        updateData.occasionId = occasion_id || null;
      }

      if (Object.keys(updateData).length === 0) {
        return apiError("INVALID_PARAMS", 400, "No fields to update");
      }

      // Update gift
      const updatedGift = await db.gift.update({
        where: { id: giftId },
        data: updateData,
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

      return apiSuccess(transformGift(updatedGift));
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "gifts:write"
);

// DELETE /api/v1/gifts/[id] - Delete a gift
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const giftId = params?.id;

    if (!giftId) {
      return apiError("INVALID_PARAMS", 400, "Invalid gift ID");
    }

    const gift = await getGiftWithAccess(giftId, context.userId);

    if (!gift) {
      return apiError("NOT_FOUND", 404, "Gift not found");
    }

    // Delete gift
    await db.gift.delete({
      where: { id: giftId },
    });

    return apiSuccess({ deleted: true, id: giftId });
  },
  "gifts:write"
);
