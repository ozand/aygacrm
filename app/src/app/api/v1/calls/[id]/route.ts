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
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";

const updateCallSchema = z.object({
  called_at: z.string().optional(),
  duration: z.number().int().nullable().optional(),
  description: z.string().nullable().optional(),
  call_reason_id: z.string().nullable().optional(),
});

// Helper to get a call with access check
async function getCallWithAccess(callId: string, userId: string) {
  // Get user's vaults
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });
  const vaultIds = userVaults.map((uv) => uv.vaultId);

  if (vaultIds.length === 0) {
    return null;
  }

  return db.call.findFirst({
    where: {
      id: callId,
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
      callReason: {
        select: {
          id: true,
          label: true,
        },
      },
    },
  });
}

// Transform call to API format
function transformCall(
  call: NonNullable<Awaited<ReturnType<typeof getCallWithAccess>>>
) {
  return {
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
  };
}

// GET /api/v1/calls/[id] - Get a single call
export const GET = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const callId = params?.id;

    if (!callId) {
      return apiError("INVALID_PARAMS", 400, "Invalid call ID");
    }

    const call = await getCallWithAccess(callId, context.userId);

    if (!call) {
      return apiError("NOT_FOUND", 404, "Call not found");
    }

    return apiSuccess(transformCall(call));
  },
  "calls:read"
);

// PUT /api/v1/calls/[id] - Update a call
export const PUT = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const callId = params?.id;

    if (!callId) {
      return apiError("INVALID_PARAMS", 400, "Invalid call ID");
    }

    const call = await getCallWithAccess(callId, context.userId);

    if (!call) {
      return apiError("NOT_FOUND", 404, "Call not found");
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const validated = validateBody(updateCallSchema, parsed.data);
    if ("error" in validated) {
      return validated.error;
    }

    const { called_at, duration, description, call_reason_id } = validated.data;

    try {

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (called_at !== undefined) {
        updateData.calledAt = new Date(called_at);
      }

      if (duration !== undefined) {
        updateData.duration = duration || null;
      }

      if (description !== undefined) {
        updateData.description = description || null;
      }

      if (call_reason_id !== undefined) {
        updateData.callReasonId = call_reason_id || null;
      }

      if (Object.keys(updateData).length === 0) {
        return apiError("INVALID_PARAMS", 400, "No fields to update");
      }

      // Update call
      const updatedCall = await db.call.update({
        where: { id: callId },
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
          callReason: {
            select: {
              id: true,
              label: true,
            },
          },
        },
      });

      await createAuditLogFromApi({
        action: "call_updated",
        objects: {
          entityId: updatedCall.id,
          entityName: `Call with ${[updatedCall.contact.firstName, updatedCall.contact.lastName].filter(Boolean).join(" ")}`,
          entityType: "call",
        },
        userId: context.userId,
        accountId: context.accountId,
        contactId: updatedCall.contact.id,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });

      return apiSuccess(transformCall(updatedCall));
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "calls:write"
);

// DELETE /api/v1/calls/[id] - Delete a call
export const DELETE = withApiAuth(
  async (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => {
    const callId = params?.id;

    if (!callId) {
      return apiError("INVALID_PARAMS", 400, "Invalid call ID");
    }

    const call = await getCallWithAccess(callId, context.userId);

    if (!call) {
      return apiError("NOT_FOUND", 404, "Call not found");
    }

    // Delete call
    await db.call.delete({
      where: { id: callId },
    });

    await createAuditLogFromApi({
      action: "call_deleted",
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

    return apiSuccess({ deleted: true, id: callId });
  },
  "calls:write"
);
