export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";

// GET /api/v1/records/:id - Get a single external record
export const GET = withApiAuth(
  async (_request: NextRequest, context: ApiAuthContext, params?: Record<string, string>) => {
    const id = params?.id;
    if (!id) {
      return apiError("NOT_FOUND", 404);
    }

    const record = await db.externalRecord.findFirst({
      where: {
        id,
        contact: {
          deletedAt: null,
          vault: {
            users: {
              some: { userId: context.userId },
            },
          },
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
      },
    });

    if (!record) {
      return apiError("NOT_FOUND", 404, "External record not found");
    }

    return apiSuccess({
      id: record.id,
      object: "external_record",
      source: record.source,
      kind: record.kind,
      external_id: record.externalId,
      url: record.url,
      title: record.title,
      content: record.content,
      metadata: record.metadata,
      happened_at: record.happenedAt?.toISOString() ?? null,
      contact: {
        id: record.contact.id,
        object: "contact",
        first_name: record.contact.firstName,
        last_name: record.contact.lastName,
        nickname: record.contact.nickname,
        complete_name: [record.contact.firstName, record.contact.lastName]
          .filter(Boolean)
          .join(" "),
      },
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
    });
  },
  "notes:read"
);

// DELETE /api/v1/records/:id - Delete an external record
export const DELETE = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext, params?: Record<string, string>) => {
    const id = params?.id;
    if (!id) {
      return apiError("NOT_FOUND", 404);
    }

    const record = await db.externalRecord.findFirst({
      where: {
        id,
        contact: {
          deletedAt: null,
          vault: {
            users: {
              some: { userId: context.userId },
            },
          },
        },
      },
      include: {
        contact: {
          select: { id: true },
        },
      },
    });

    if (!record) {
      return apiError("NOT_FOUND", 404, "External record not found");
    }

    await db.externalRecord.delete({ where: { id } });

    await createAuditLogFromApi({
      action: AUDIT_ACTIONS.RECORD_DELETED,
      objects: {
        entityId: record.id,
        entityName: record.title || `${record.source}/${record.kind}`,
        entityType: "external_record",
      },
      userId: context.userId,
      accountId: context.accountId,
      contactId: record.contact.id,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return apiSuccess({ deleted: true, id });
  },
  "notes:write"
);
