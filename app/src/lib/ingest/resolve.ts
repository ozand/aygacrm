/**
 * Resolve-or-create a contact from a source identity (issue #26).
 *
 * This mirrors the vault-scoped lookup/create patterns already used by
 * `findContactsByExternalId` / `addExternalIdentity`
 * (src/lib/actions/external-identities.ts) and `aygacrm_create_contact`
 * (src/lib/mcp/tools.ts), but is implemented directly against `db` rather
 * than calling those "use server" actions: those gate on a Next-auth session
 * (`auth()`), while this needs to run with an explicit `{ userId }` auth
 * context so both the `/api/v1/ingest` route (Bearer token) and the MCP/stdio
 * tool (API-token auth, no Next session at all) can share one code path.
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface ResolveAuth {
  userId: string;
}

export interface ContactHints {
  firstName?: string;
  lastName?: string;
  /** Nickname/username-style hint — also used as a fallback display name. */
  nickname?: string;
}

export interface ResolveOrCreateContactInput {
  source: string;
  /** The identity value in the external system (handle, email, phone, etc). */
  externalId: string;
  hints?: ContactHints;
}

export interface ResolveOrCreateContactResult {
  contactId: string;
  contactCreated: boolean;
}

/**
 * Thrown when the source identity is already registered but not reachable by
 * the caller. `ExternalIdentity.@@unique([source, externalId])` is GLOBAL (not
 * per-account), so a handle claimed under another account cannot be attached
 * here — and must not be resolved to (that would leak/attach across tenants).
 * The route surfaces this as a generic 409 rather than letting the raw P2002
 * become a 500. Message is intentionally generic (no owner/contact detail).
 *
 * Note: because the unique is global, a caller can still distinguish
 * "registered somewhere" (409) from "free" (2xx) — a mild existence signal
 * inherent to the global-unique design; revisit if per-tenant identity
 * isolation is ever required.
 */
export class IngestConflictError extends Error {
  constructor(message = "This external identity is already registered.") {
    super(message);
    this.name = "IngestConflictError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

async function getAccessibleVaultIds(userId: string): Promise<string[]> {
  const userVaults = await db.userVault.findMany({
    where: { userId },
    select: { vaultId: true },
  });
  return userVaults.map((userVault) => userVault.vaultId);
}

/**
 * Look up a contact by (source, externalId), restricted to the caller's
 * accessible, non-deleted contacts. The underlying
 * `@@unique([source, externalId])` constraint on ExternalIdentity is global
 * (not vault-scoped), so this filter is what keeps the resolver from leaking
 * or attaching to a contact outside the caller's reach.
 */
async function findAccessibleContactForIdentity(
  source: string,
  externalId: string,
  vaultIds: string[]
): Promise<string | null> {
  const identity = await db.externalIdentity.findFirst({
    where: {
      source,
      externalId,
      contact: {
        vaultId: { in: vaultIds },
        deletedAt: null,
      },
    },
    select: { contactId: true },
  });

  return identity?.contactId ?? null;
}

function pickFirstName(hints: ContactHints | undefined, externalId: string): string {
  // firstName is never left empty — the contact-creation convention used
  // elsewhere (see createContactSchema in mcp/tools.ts) requires a non-empty
  // firstName, so we fall back to the nickname/username hint, then the raw
  // handle, then a fixed placeholder.
  const candidate = hints?.firstName?.trim() || hints?.nickname?.trim() || externalId.trim();
  return candidate || "Unknown";
}

export async function resolveOrCreateContactByIdentity(
  auth: ResolveAuth,
  input: ResolveOrCreateContactInput
): Promise<ResolveOrCreateContactResult> {
  const vaultIds = await getAccessibleVaultIds(auth.userId);
  if (vaultIds.length === 0) {
    throw new Error("No accessible vault found for this account");
  }

  const existingContactId = await findAccessibleContactForIdentity(
    input.source,
    input.externalId,
    vaultIds
  );
  if (existingContactId) {
    return { contactId: existingContactId, contactCreated: false };
  }

  // Contact + identity are created in one transaction so a failed identity
  // attach (e.g. the global (source, externalId) unique rejecting a handle
  // already claimed elsewhere) rolls the contact back — no orphan contact is
  // left in the caller's vault.
  try {
    const contactId = await db.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          vaultId: vaultIds[0],
          firstName: pickFirstName(input.hints, input.externalId),
          lastName: input.hints?.lastName?.trim() || null,
          nickname: input.hints?.nickname?.trim() || null,
        },
      });
      await tx.externalIdentity.create({
        data: {
          contactId: contact.id,
          source: input.source,
          externalId: input.externalId,
        },
      });
      return contact.id;
    });
    return { contactId, contactCreated: true };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // The (source, externalId) unique caught a collision (P2002); the
    // transaction rolled our contact back. Re-read scoped to the caller:
    // - an accessible winner => a concurrent call in THIS account attached it
    //   first; defer to it (same-account race — idempotent).
    // - no accessible winner => the handle is claimed under ANOTHER account
    //   (the unique is global). Surface a deliberate conflict, not a raw 500,
    //   and never expose the other tenant's contactId.
    const winnerContactId = await findAccessibleContactForIdentity(
      input.source,
      input.externalId,
      vaultIds
    );
    if (winnerContactId) {
      return { contactId: winnerContactId, contactCreated: false };
    }

    throw new IngestConflictError();
  }
}
