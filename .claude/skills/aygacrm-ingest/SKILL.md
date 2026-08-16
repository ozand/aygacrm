---
name: aygacrm-ingest
description: Use when you have data collected from an external source (Telegram, email, LinkedIn, WhatsApp, Zoom, Notion, Todoist, phone, or manual/other) and want it to land in AygaCRM as a contact plus an attached external record with provenance, idempotently, in one call — instead of hand-rolling find-or-create-contact + add-identity + add-record.
---

# AygaCRM ingestion contract

`POST /api/v1/ingest` (REST, ability `contacts:write`) and the `aygacrm_ingest` MCP tool are the recommended way to push third-party data into AygaCRM. AygaCRM is the storage/display layer; **you** (the agent) own source authentication, extraction, and normalization — AygaCRM defines the contract and does resolve-or-create + idempotent write + provenance in one atomic step, replacing what would otherwise be three separate calls.

Source of truth for this contract: `app/src/app/api/v1/ingest/route.ts`, `app/src/lib/ingest/ingest.ts`, `app/src/lib/ingest/resolve.ts`, and the `IngestCreate`/`IngestEnvelope` schemas in `docs/api/openapi.json`. Source/kind/metadata rules: `docs/integrations/ingestion-conventions.md` (canonical list source: `app/src/lib/ingestion-conventions.ts`).

## What it does

1. Looks up an existing contact by `(source, handle)` against `ExternalIdentity.externalId` — restricted to contacts your token can access.
2. If none exists, **creates** a new contact (first name derived from `contact_hints.first_name` → `contact_hints.username` → the raw `handle` → `"Unknown"`, in that order) and attaches the identity.
3. Idempotently upserts an external record for the item (dedup key: contact + source + `external_id`) — re-posting the same item updates it in place rather than duplicating it.
4. Writes provenance for any contact fields supplied in `contact_hints`, attributed to `source`.

Returns `201` if a new record was created, `200` if an existing one was updated in place.

## Request body (REST — snake_case)

```json
{
  "source": "telegram",
  "kind": "message",
  "handle": "johndoe",
  "external_id": "12345:678",
  "content": "Key decisions from the chat...",
  "url": "https://t.me/c/12345/678",
  "title": "Discussion about project timeline",
  "happened_at": "2025-03-15T14:30:00Z",
  "metadata": { "chatId": "12345", "messageId": 678, "username": "johndoe" },
  "contact_hints": { "first_name": "John", "last_name": "Doe", "username": "johndoe" }
}
```

Required: `source`, `kind`, `handle`. Everything else is optional.

| Field | Meaning |
|---|---|
| `source` | one of `email`, `telegram`, `linkedin`, `todoist`, `notion`, `zoom`, `phone`, `whatsapp`, `manual`, `other` |
| `kind` | one of `message`, `thread`, `profile`, `note`, `transcript`, `task`, `page`, `meeting`, `reference`, `snippet` — `source`/`kind` must be a **valid combination** (see table below), or the request is rejected |
| `handle` | the source identity used to **resolve-or-create the contact** (matched against `ExternalIdentity.externalId` for that `source`) — e.g. a Telegram `@username` or numeric id, an email address |
| `external_id` | a separate **record-level** id (e.g. a message id), independent of `handle`, used for record-level dedup on repeat ingestion |
| `url`, `title`, `content` | free-form record fields; at least one of `url`/`title`/`content`/`external_id` should be present so there's something to store |
| `metadata` | object, validated against a source-specific optional schema if provided (see below) |
| `happened_at` | ISO 8601 datetime (with offset) — when the item actually happened, not when you're ingesting it |
| `contact_hints` | `{ "first_name"?, "last_name"?, "username"? }` — canonical fields the source supplied; each present field is written to contact provenance history |

### Valid source → kind combinations

| Source | Valid kinds |
|---|---|
| `email` | message, thread, snippet, reference |
| `telegram` | message, profile, snippet, reference |
| `linkedin` | profile, note, reference |
| `todoist` | task, reference |
| `notion` | page, note, reference |
| `zoom` | meeting, transcript, reference |
| `phone` | transcript, reference |
| `whatsapp` | message, snippet, reference |
| `manual` | any kind |
| `other` | any kind |

## Response

```json
{
  "data": {
    "contact_id": "clx...",
    "record_id": "clx...",
    "contact_created": true,
    "record_created": true
  }
}
```

`contact_created: false` means the handle matched an existing contact. `record_created: false` means this exact `(contact, source, external_id)` already existed and was updated in place — safe to re-post the same item repeatedly.

## Errors

| Status | Error code | Cause |
|---|---|---|
| `401` | — | missing/invalid token |
| `403` | — | token lacks `contacts:write` |
| `409` | `IDENTITY_CONFLICT` | this `(source, handle)` is already registered under a **different** account — `ExternalIdentity` uniqueness is global, not per-tenant, so a handle claimed elsewhere can't be attached here |
| `409` | `IDEMPOTENCY_CONFLICT` | you reused an `Idempotency-Key` header with a different request body |
| `422` | `VALIDATION_ERROR` | bad source/kind, invalid source/kind combination, malformed `metadata`, invalid `happened_at`, missing `handle`, etc. |
| `429` | `RATE_LIMITED` | back off; response carries `Retry-After` |

An `Idempotency-Key` header on the request is honored the same way as every other write endpoint (repeat with same key + same body replays the original response).

## MCP tool — `aygacrm_ingest`

Same contract, **camelCase** field names instead of snake_case (this is the one place the two surfaces differ):

```json
{
  "tool": "aygacrm_ingest",
  "arguments": {
    "source": "email",
    "kind": "thread",
    "handle": "alice@example.com",
    "externalId": "thread-abc-123",
    "title": "Re: Q4 Planning",
    "content": "Thread summary...",
    "happenedAt": "2025-03-10T09:00:00Z",
    "metadata": { "subject": "Q4 Planning", "from": "alice@example.com", "threadId": "thread-abc-123" },
    "contactHints": { "firstName": "Alice", "username": "alice" }
  }
}
```

Required: `source`, `kind`, `handle`. `contactHints` keys are `firstName`/`lastName`/`username` (note: `username`, not `nickname` — it's mapped to the contact's nickname field server-side).

## Worked example: Telegram

This mirrors the reference adapter at `app/src/ingest/telegram/` (`map.ts` is the pure mapping function; `run.ts` is the long-poll runner — read both if building a similar adapter for another source). For an incoming Telegram message from `@johndoe` (Telegram user id `111`) in chat `12345` titled "Project Team":

```bash
curl -X POST "$AYGACRM_API_URL/api/v1/ingest" \
  -H "Authorization: Bearer $AYGACRM_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "telegram",
    "kind": "message",
    "handle": "johndoe",
    "external_id": "12345:678",
    "content": "Let'\''s ship the new onboarding flow next sprint.",
    "metadata": { "chatId": "12345", "chatTitle": "Project Team", "messageId": 678, "username": "johndoe", "direction": "inbound" },
    "happened_at": "2025-03-15T14:30:00Z",
    "contact_hints": { "first_name": "John", "username": "johndoe" }
  }'
```

Notes on the mapping (per `map.ts`):
- `handle` = the Telegram `@username` if present, else the numeric user id as a string — this is what resolves the contact across repeat messages from the same person.
- `external_id` = `"<chatId>:<messageId>"` — scoped by chat so the same per-chat `message_id` in two different chats never collides.
- Only text messages with a `from` sender are mappable; photos/stickers/service messages and anonymous channel posts are skipped (nothing to ingest, no stable identity to resolve against).

## Agent ingestion pattern (general, any source)

1. Authenticate to the source yourself (bot token, OAuth, IMAP, whatever it needs) — AygaCRM has no opinion on this.
2. Extract and normalize the item you want remembered.
3. Call `POST /api/v1/ingest` (or `aygacrm_ingest`) once per item — do not pre-resolve the contact yourself; that's what `handle` + `contact_hints` are for.
4. Treat a `false` result (network error, non-2xx) as "not delivered" — don't advance any local offset/cursor past it. Treat any successful response (including a `record_created: false` idempotent replay) as delivered. Re-posting an already-ingested item is always safe.
