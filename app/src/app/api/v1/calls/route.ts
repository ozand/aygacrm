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

// GET /api/v1/calls - List all calls
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);
    const sort = getSortParams(request, ["createdAt", "calledAt", "updatedAt"]);
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
      contact: {
        vault: { id: { in: vaultIds } },
        deletedAt: null,
      },
    };

    if (contactId) {
      where.contactId = contactId;
    }

    // Get total count
    const total = await db.call.count({ where });

    // Get calls
    const calls = await db.call.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sort
        ? { [sort.field]: sort.direction }
        : { calledAt: "desc" },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
          },
        },
        callReason: {
          select: {
            id: true,
            label: true,
          },
        },
      },
    });

    // Transform to API format
    const data = calls.map((call) => ({
      id: call.id,
      object: "call",
      called_at: call.calledAt.toISOString(),
      duration: call.duration,
      description: call.description,
      call_reason: call.callReason
        ? {
            id: call.callReason.id,
            label: call.callReason.label,
          }
        : null,
      contact: {
        id: call.contact.id,
        object: "contact",
        first_name: call.contact.firstName,
        last_name: call.contact.lastName,
        nickname: call.contact.nickname,
        complete_name: [call.contact.firstName, call.contact.lastName]
          .filter(Boolean)
          .join(" "),
      },
      created_at: call.createdAt.toISOString(),
      updated_at: call.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "calls:read"
);

// POST /api/v1/calls - Create a call
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    try {
      const body = await request.json();

      const {
        contact_id,
        called_at,
        duration,
        description,
        call_reason_id,
      } = body;

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
      });

      if (!contact) {
        return apiError("NOT_FOUND", 404, "Contact not found");
      }

      // Create call
      const call = await db.call.create({
        data: {
          contactId: contact_id,
          calledAt: called_at ? new Date(called_at) : new Date(),
          duration: duration || null,
          description: description || null,
          callReasonId: call_reason_id || null,
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
          callReason: {
            select: {
              id: true,
              label: true,
            },
          },
        },
      });

      return apiSuccess(
        {
          id: call.id,
          object: "call",
          called_at: call.calledAt.toISOString(),
          duration: call.duration,
          description: call.description,
          call_reason: call.callReason
            ? {
                id: call.callReason.id,
                label: call.callReason.label,
              }
            : null,
          contact: {
            id: call.contact.id,
            object: "contact",
            first_name: call.contact.firstName,
            last_name: call.contact.lastName,
            nickname: call.contact.nickname,
          },
          created_at: call.createdAt.toISOString(),
          updated_at: call.updatedAt.toISOString(),
        },
        201
      );
    } catch {
      return apiError("JSON_PARSE_ERROR", 400);
    }
  },
  "calls:write"
);
