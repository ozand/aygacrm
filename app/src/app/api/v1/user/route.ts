export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";

// GET /api/v1/user - Get current user
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const user = await db.user.findUnique({
      where: { id: context.userId },
      include: {
        account: {
          select: {
            id: true,
            storageLimitMb: true,
          },
        },
      },
    });

    if (!user) {
      return apiError("NOT_FOUND", 404, "User not found");
    }

    return apiSuccess({
      id: user.id,
      object: "user",
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      email_verified_at: user.emailVerifiedAt?.toISOString() || null,
      timezone: user.timezone,
      locale: user.locale,
      date_format: user.dateFormat,
      number_format: user.numberFormat,
      distance_format: user.distanceFormat,
      default_map_site: user.defaultMapSite,
      is_account_administrator: user.isAccountAdministrator,
      account: {
        id: user.account.id,
        storage_limit_mb: user.account.storageLimitMb,
      },
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    });
  }
);
