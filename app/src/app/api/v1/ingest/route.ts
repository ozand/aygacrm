export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { parseJsonBody } from "@/lib/api/validation";
import { withApiAuth, apiSuccess, apiError, ApiAuthContext } from "@/lib/api/auth";
import { AUDIT_ACTIONS } from "@/lib/api/audit-constants";
import { createAuditLogFromApi } from "@/lib/api/audit-helpers";
import { ingestExternalItem, IngestValidationError, IngestConflictError } from "@/lib/ingest/ingest";

// POST /api/v1/ingest - Resolve-or-create a contact from a source handle,
// idempotently write the external record, and record provenance for the
// contact fields the source supplied. One call replacing the
// find-or-create-contact -> add-identity -> add-record dance.
export const POST = withApiAuth(
  async (request: NextRequest, context: ApiAuthContext) => {
    const parsed = await parseJsonBody(request);
    if ("error" in parsed) {
      return parsed.error;
    }

    const raw = parsed.data as Record<string, unknown>;
    const rawHints = (raw.contact_hints ?? raw.contactHints) as Record<string, unknown> | undefined;

    try {
      const result = await ingestExternalItem(
        { userId: context.userId },
        {
          source: raw.source as string,
          kind: raw.kind as string,
          handle: raw.handle as string,
          externalId: (raw.external_id as string | undefined) ?? null,
          url: (raw.url as string | undefined) ?? null,
          title: (raw.title as string | undefined) ?? null,
          content: (raw.content as string | undefined) ?? null,
          metadata: (raw.metadata as Record<string, unknown> | undefined) ?? null,
          happenedAt: (raw.happened_at as string | undefined) ?? null,
          contactHints: rawHints
            ? {
                firstName: rawHints.first_name as string | undefined,
                lastName: rawHints.last_name as string | undefined,
                nickname: rawHints.username as string | undefined,
              }
            : undefined,
        },
        { setBy: context.tokenId }
      );

      await createAuditLogFromApi({
        action: result.recordCreated ? AUDIT_ACTIONS.RECORD_CREATED : AUDIT_ACTIONS.RECORD_UPDATED,
        objects: {
          entityId: result.recordId,
          entityName: `${raw.source}/${raw.kind}`,
          entityType: "external_record",
          relatedEntities: [{ id: result.contactId, type: "contact" }],
        },
        userId: context.userId,
        accountId: context.accountId,
        contactId: result.contactId,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });

      return apiSuccess(
        {
          contact_id: result.contactId,
          record_id: result.recordId,
          contact_created: result.contactCreated,
          record_created: result.recordCreated,
        },
        result.recordCreated ? 201 : 200
      );
    } catch (error) {
      if (error instanceof IngestValidationError) {
        return apiError("VALIDATION_ERROR", 422, error.message);
      }
      if (error instanceof IngestConflictError) {
        return apiError("IDENTITY_CONFLICT", 409, error.message);
      }
      console.error("Error:", error);
      return apiError("INTERNAL_ERROR", 500);
    }
  },
  "contacts:write"
);
