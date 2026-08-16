/**
 * Idempotent write path for ExternalRecord (issue #25).
 *
 * All entry points that create external records — the server action, the
 * public API route, the MCP tool, and the legacy direct-DB CLI — funnel
 * through this single helper so re-pushing the same source record can never
 * create a duplicate row.
 *
 * Dedup key: (contactId, source, externalId), matching the
 * `@@unique([contactId, source, externalId])` constraint on ExternalRecord.
 * Postgres treats NULLs as distinct in a unique index, so records with
 * externalId === null (manual/free-form entries) are never deduped — every
 * call creates a new row.
 */

export interface UpsertExternalRecordInput {
  contactId: string;
  source: string;
  kind: string;
  externalId?: string | null;
  url?: string | null;
  title?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  happenedAt?: Date | null;
}

export interface UpsertExternalRecordResult<TRecord> {
  record: TRecord;
  /** true if a new row was inserted, false if an existing row was updated. */
  created: boolean;
}

// Minimal shape of the Prisma delegate this helper needs. Both the app's
// `db` proxy (@/lib/db) and the legacy CLI's plain `new PrismaClient()`
// satisfy this structurally, as does a vitest mock with just these three
// methods — TRecord is inferred from whichever `db.externalRecord` is passed.
export interface ExternalRecordDelegate<TRecord> {
  findFirst(args: unknown): Promise<TRecord | null>;
  create(args: unknown): Promise<TRecord>;
  update(args: unknown): Promise<TRecord>;
}

export interface ExternalRecordDb<TRecord> {
  externalRecord: ExternalRecordDelegate<TRecord>;
}

/** Prisma unique-constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function upsertExternalRecord<TRecord extends { id: string }>(
  db: ExternalRecordDb<TRecord>,
  input: UpsertExternalRecordInput
): Promise<UpsertExternalRecordResult<TRecord>> {
  const { contactId, source, kind, externalId = null } = input;

  const delegate = db.externalRecord;

  // Only the fields the caller actually supplied are written. Omitted fields
  // stay `undefined` so Prisma skips them: on create they fall back to the
  // column default (null); on update the stored value is preserved rather than
  // wiped. `metadata` uses `?? undefined` so a null never reaches the Json
  // column (Prisma would need Prisma.JsonNull for that; skipping is the intent).
  const mutableData = {
    kind,
    url: input.url,
    title: input.title,
    content: input.content,
    metadata: input.metadata ?? undefined,
    happenedAt: input.happenedAt,
  };

  const createData = { contactId, source, externalId, ...mutableData };

  // externalId absent -> manual/free record, never deduped.
  if (!externalId) {
    const record = await delegate.create({ data: createData });
    return { record, created: true };
  }

  const existing = await delegate.findFirst({
    where: { contactId, source, externalId },
  });

  if (existing) {
    const record = await delegate.update({ where: { id: existing.id }, data: mutableData });
    return { record, created: false };
  }

  // No existing row seen — try to create. findFirst→create is not atomic, so a
  // concurrent writer (webhook double-delivery, adapter retry) may win the race
  // and the create hits the @@unique constraint. Treat that P2002 as "someone
  // else created it" and fall back to updating the now-present row, so the
  // re-push stays idempotent instead of surfacing a 500.
  try {
    const record = await delegate.create({ data: createData });
    return { record, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await delegate.findFirst({ where: { contactId, source, externalId } });
    if (!winner) throw error;
    const record = await delegate.update({ where: { id: winner.id }, data: mutableData });
    return { record, created: false };
  }
}
