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
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";

const createCallSchema = z.object({
  contact_id: z.string().min(1),
  called_at: z.string().min(1),
  duration: z.number().int().optional(),
  description: z.string().optional(),
  call_reason_id: z.string().optional(),
});

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
    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(createCallSchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

    const { contact_id, called_at, duration, description, call_reason_id } = validated.data;

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

      // Create call
      const call = await db.call.create({
        data: {
          contactId: contact_id,
          calledAt: new Date(called_at),
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

      await createAuditLogFromApi({
        action: "call_created",
        objects: {
          entityId: call.id,
          entityName: `Call with ${[call.contact.firstName, call.contact.lastName].filter(Boolean).join(" ")}`,
          entityType: "call",
        },
        userId: context.userId,
        accountId: context.accountId,
        contactId: call.contact.id,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
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
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "calls:write"
);
