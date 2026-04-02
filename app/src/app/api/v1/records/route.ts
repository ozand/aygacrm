export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
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
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";
import {
  createExternalRecordSchema,
  validateMetadata,
  Source,
} from "@/lib/ingestion-conventions";

// GET /api/v1/records - List external records
export const GET = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const { page, limit } = getPaginationParams(request);
    const sort = getSortParams(request, ["createdAt", "updatedAt", "happenedAt"]);
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contact_id");
    const source = url.searchParams.get("source");
    const kind = url.searchParams.get("kind");

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
        vaultId: { in: vaultIds },
        deletedAt: null,
      },
    };

    if (contactId) {
      where.contactId = contactId;
    }
    if (source) {
      where.source = source;
    }
    if (kind) {
      where.kind = kind;
    }

    const total = await db.externalRecord.count({ where });

    const records = await db.externalRecord.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sort
        ? { [sort.field]: sort.direction }
        : [{ happenedAt: "desc" }, { createdAt: "desc" }],
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

    const data = records.map((record) => ({
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
    }));

    return apiPaginated(data, page, limit, total, getBaseUrl(request));
  },
  "notes:read"
);

// POST /api/v1/records - Create an external record
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    // Transform snake_case input to camelCase for our schema
    const raw = parsed.data as Record<string, unknown>;
    const input = {
      contactId: raw.contact_id ?? raw.contactId,
      source: raw.source,
      kind: raw.kind,
      externalId: raw.external_id ?? raw.externalId ?? null,
      url: raw.url ?? null,
      title: raw.title ?? null,
      content: raw.content ?? null,
      metadata: raw.metadata ?? null,
      happenedAt: raw.happened_at ?? raw.happenedAt ?? null,
    };

    const validated = validateBody(createExternalRecordSchema, input);
    if ("error" in validated) {
      return validated.error;
    }

    const { contactId, source, kind, externalId, url: recordUrl, title, content, metadata, happenedAt } = validated.data;

    // Validate metadata against source-specific schema
    if (metadata) {
      const metaResult = validateMetadata(source as Source, metadata);
      if (!metaResult.success) {
        return apiError("VALIDATION_ERROR", 422, metaResult.error);
      }
    }

    try {
      // Verify user has access to the contact
      const contact = await db.contact.findFirst({
        where: {
          id: contactId,
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

      const record = await db.externalRecord.create({
        data: {
          contactId,
          source,
          kind,
          externalId: externalId ?? null,
          url: recordUrl ?? null,
          title: title ?? null,
          content: content ?? null,
          metadata: metadata ? (metadata as Record<string, string | number | boolean | null>) : undefined,
          happenedAt: happenedAt ? new Date(happenedAt) : null,
        },
      });

      // Fetch the contact for the response
      const recordContact = await db.contact.findFirst({
        where: { id: contactId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nickname: true,
        },
      });

      await createAuditLogFromApi({
        action: AUDIT_ACTIONS.RECORD_CREATED,
        objects: {
          entityId: record.id,
          entityName: record.title || `${record.source}/${record.kind}`,
          entityType: "external_record",
        },
        userId: context.userId,
        accountId: context.accountId,
        contactId: contactId,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });

      return apiSuccess(
        {
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
          contact: recordContact
            ? {
                id: recordContact.id,
                object: "contact",
                first_name: recordContact.firstName,
                last_name: recordContact.lastName,
                nickname: recordContact.nickname,
              }
            : null,
          created_at: record.createdAt.toISOString(),
          updated_at: record.updatedAt.toISOString(),
        },
        201
      );
    } catch (error) {
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "notes:write"
);
