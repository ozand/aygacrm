export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseJsonBody, validateBody } from "@/lib/api/validation";
import {
  withApiAuth,
  apiSuccess,
  apiError,
  ApiAuthContext,
} from "@/lib/api/auth";
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";
import {
  updateExternalRecordSchema,
  validateMetadata,
  isValidSourceKind,
  Source,
  Kind,
} from "@/lib/ingestion-conventions";

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

// PUT /api/v1/records/:id - Update an external record
export const PUT = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext, params?: Record<string, string>) => {
    const id = params?.id;
    if (!id) {
      return apiError("NOT_FOUND", 404);
    }

    const existing = await db.externalRecord.findFirst({
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

    if (!existing) {
      return apiError("NOT_FOUND", 404, "External record not found");
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    // Transform snake_case input to camelCase for our schema
    const raw = parsed.data as Record<string, unknown>;
    const input = {
      ...(raw.source !== undefined ? { source: raw.source } : {}),
      ...(raw.kind !== undefined ? { kind: raw.kind } : {}),
      ...(raw.external_id !== undefined || raw.externalId !== undefined
        ? { externalId: raw.external_id ?? raw.externalId }
        : {}),
      ...(raw.url !== undefined ? { url: raw.url } : {}),
      ...(raw.title !== undefined ? { title: raw.title } : {}),
      ...(raw.content !== undefined ? { content: raw.content } : {}),
      ...(raw.metadata !== undefined ? { metadata: raw.metadata } : {}),
      ...(raw.happened_at !== undefined || raw.happenedAt !== undefined
        ? { happenedAt: raw.happened_at ?? raw.happenedAt }
        : {}),
    };

    const validated = validateBody(updateExternalRecordSchema, input);
    if ("error" in validated) {
      return validated.error;
    }

    const data = validated.data;

    // Resolve final source/kind for cross-validation
    const finalSource = (data.source ?? existing.source) as Source;
    const finalKind = (data.kind ?? existing.kind) as Kind;

    if (!isValidSourceKind(finalSource, finalKind)) {
      return apiError("VALIDATION_ERROR", 422, `Invalid source/kind combination: ${finalSource}/${finalKind}`);
    }

    // Validate metadata against source-specific schema
    const finalMetadata = data.metadata !== undefined ? data.metadata : existing.metadata;
    if (finalMetadata) {
      const metaResult = validateMetadata(finalSource, finalMetadata);
      if (!metaResult.success) {
        return apiError("VALIDATION_ERROR", 422, metaResult.error);
      }
    }

    try {
      const updated = await db.externalRecord.update({
        where: { id },
        data: {
          ...(data.source !== undefined ? { source: data.source } : {}),
          ...(data.kind !== undefined ? { kind: data.kind } : {}),
          ...(data.externalId !== undefined ? { externalId: data.externalId ?? null } : {}),
          ...(data.url !== undefined ? { url: data.url ?? null } : {}),
          ...(data.title !== undefined ? { title: data.title ?? null } : {}),
          ...(data.content !== undefined ? { content: data.content ?? null } : {}),
          ...(data.metadata !== undefined
            ? { metadata: data.metadata ? (data.metadata as Record<string, string | number | boolean | null>) : undefined }
            : {}),
          ...(data.happenedAt !== undefined
            ? { happenedAt: data.happenedAt ? new Date(data.happenedAt) : null }
            : {}),
        },
      });

      const recordContact = await db.contact.findFirst({
        where: { id: existing.contact.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nickname: true,
        },
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.RECORD_UPDATED,
        objects: {
          entityId: updated.id,
          entityName: updated.title || `${updated.source}/${updated.kind}`,
          entityType: "external_record",
        },
        userId: context.userId,
        accountId: context.accountId,
        contactId: existing.contact.id,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });

      return apiSuccess({
        id: updated.id,
        object: "external_record",
        source: updated.source,
        kind: updated.kind,
        external_id: updated.externalId,
        url: updated.url,
        title: updated.title,
        content: updated.content,
        metadata: updated.metadata,
        happened_at: updated.happenedAt?.toISOString() ?? null,
        contact: recordContact
          ? {
              id: recordContact.id,
              object: "contact",
              first_name: recordContact.firstName,
              last_name: recordContact.lastName,
              nickname: recordContact.nickname,
            }
          : null,
        created_at: updated.createdAt.toISOString(),
        updated_at: updated.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "notes:write"
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
