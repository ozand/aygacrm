/**
 * One-call ingestion entry point (issue #26).
 *
 * Thin composition over the pieces built for issue #25 and earlier:
 *  - ingestion-conventions.ts for source/kind/metadata validation
 *  - resolveOrCreateContactByIdentity (resolve.ts) for the contact
 *  - upsertExternalRecord for the idempotent record write
 *  - a provenance write for the contact fields the source supplied
 *
 * Shared by both `POST /api/v1/ingest` and the `aygacrm_ingest` MCP tool, so
 * it takes an explicit `{ userId }` auth context rather than reading a
 * Next-auth session.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { sourceSchema, kindSchema, isValidSourceKind, validateMetadata } from "@/lib/ingestion-conventions";
import { upsertExternalRecord } from "@/lib/external-record-upsert";
import { resolveOrCreateContactByIdentity, IngestConflictError, type ContactHints } from "@/lib/ingest/resolve";

// Re-export so callers (route, MCP tool) import both ingest errors from here.
export { IngestConflictError };

export class IngestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestValidationError";
  }
}

export interface IngestAuth {
  userId: string;
}

export interface IngestMeta {
  /** userId/tokenId/agent-id attributed as the provenance setter. */
  setBy?: string;
}

export interface IngestInput {
  source: string;
  kind: string;
  /** The source identity (maps to ExternalIdentity.externalId). */
  handle: string;
  /** Optional record-level external id (e.g. a message id), independent of `handle`. */
  externalId?: string | null;
  url?: string | null;
  title?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  happenedAt?: string | null;
  contactHints?: ContactHints;
}

export interface IngestResult {
  contactId: string;
  recordId: string;
  contactCreated: boolean;
  recordCreated: boolean;
}

const ingestInputSchema = z
  .object({
    source: sourceSchema,
    kind: kindSchema,
    handle: z.string().min(1, "handle is required"),
    externalId: z.string().nullish(),
    url: z.string().url("Invalid URL format").nullish(),
    title: z.string().nullish(),
    content: z.string().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
    happenedAt: z.string().datetime({ offset: true }).nullish(),
    contactHints: z
      .object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        nickname: z.string().min(1).optional(),
      })
      .optional(),
  })
  .refine((value) => isValidSourceKind(value.source, value.kind), {
    message: "Invalid source/kind combination",
    path: ["kind"],
  });

function normalizeZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Invalid ingest input";
  }
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

/**
 * Deactivate-then-insert provenance write, matching `recordProvenance` in
 * src/lib/actions/provenance.ts. Duplicated (rather than imported) because
 * that helper is a "use server" action gated on a Next-auth session; this
 * orchestrator runs with an explicit auth context so the MCP/stdio caller
 * can use it too. The contact was already resolved/scoped by
 * `resolveOrCreateContactByIdentity` above, so no extra vault check is
 * needed here.
 */
async function writeProvenance(
  contactId: string,
  fields: Record<string, string | null>,
  source: string,
  setBy?: string
): Promise<void> {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return;
  }

  await db.$transaction(async (tx) => {
    for (const [field, value] of entries) {
      await tx.contactFieldProvenance.updateMany({
        where: { contactId, field, isActive: true },
        data: { isActive: false },
      });
      await tx.contactFieldProvenance.create({
        data: { contactId, field, value, source, setBy: setBy ?? null, isActive: true },
      });
    }
  });
}

export async function ingestExternalItem(
  auth: IngestAuth,
  input: IngestInput,
  meta: IngestMeta = {}
): Promise<IngestResult> {
  const parsed = ingestInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new IngestValidationError(normalizeZodError(parsed.error));
  }
  const data = parsed.data;

  if (data.metadata) {
    const metaResult = validateMetadata(data.source, data.metadata);
    if (!metaResult.success) {
      throw new IngestValidationError(metaResult.error);
    }
  }

  const { contactId, contactCreated } = await resolveOrCreateContactByIdentity(auth, {
    source: data.source,
    externalId: data.handle,
    hints: data.contactHints,
  });

  const { record, created: recordCreated } = await upsertExternalRecord(db, {
    contactId,
    source: data.source,
    kind: data.kind,
    externalId: data.externalId ?? null,
    url: data.url ?? null,
    title: data.title ?? null,
    content: data.content ?? null,
    metadata: data.metadata ?? null,
    happenedAt: data.happenedAt ? new Date(data.happenedAt) : null,
  });

  const provenanceFields: Record<string, string | null> = {};
  if (data.contactHints?.firstName) {
    provenanceFields.firstName = data.contactHints.firstName;
  }
  if (data.contactHints?.lastName) {
    provenanceFields.lastName = data.contactHints.lastName;
  }
  if (data.contactHints?.nickname) {
    provenanceFields.nickname = data.contactHints.nickname;
  }

  if (Object.keys(provenanceFields).length > 0) {
    await writeProvenance(contactId, provenanceFields, data.source, meta.setBy);
  }

  return { contactId, recordId: record.id, contactCreated, recordCreated };
}
