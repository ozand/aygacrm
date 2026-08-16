# Telegram Ingestion Adapter

## What this is

`app/src/ingest/telegram/` is a **standalone external agent**, not a
built-in AygaCRM connector. Per the [integration roadmap](roadmap.md) and
[ingestion conventions](ingestion-conventions.md), AygaCRM defines ingestion
*contracts* — it does not reach out to source systems itself. This adapter:

1. authenticates to Telegram itself, using a bot token,
2. long-polls the Telegram Bot API (`getUpdates`) to collect new messages,
3. maps each message to the ingest contract, and
4. pushes it into AygaCRM over plain HTTP via `POST /api/v1/ingest`, using an
   AygaCRM API token.

It never imports AygaCRM's database, Prisma client, or server actions —
**HTTP is the only boundary** between this adapter and AygaCRM. It could just
as well run on a different machine, in a different language, or as a
scheduled job elsewhere; nothing about it is special-cased inside AygaCRM's
server code.

## Prerequisites

1. Create a Telegram bot via [@BotFather](https://t.me/BotFather) and note
   the bot token it gives you (`123456:ABC-DEF...`).
2. Add the bot to whatever chat(s) you want ingested (a DM with the bot, or
   invite it to a group), or message it directly.
3. Create an AygaCRM API token for the account the ingested contacts should
   land in (see the main `README.md`'s API section for how tokens are
   issued).

## Environment variables

Set these in `app/.env` (loaded automatically via `dotenv`, same as the CLI):

| Variable             | Required | Default                 | Description                                   |
|----------------------|----------|--------------------------|------------------------------------------------|
| `TELEGRAM_BOT_TOKEN`  | yes      | —                        | Bot token from @BotFather                       |
| `AYGACRM_API_TOKEN`   | yes      | —                        | AygaCRM API token used to call `POST /ingest`   |
| `AYGACRM_API_URL`     | no       | `http://localhost:4000` | Base URL of the running AygaCRM instance        |

Never commit a real bot or API token — both `.env` and
`.telegram-offset.json` are gitignored.

## Running it

From `app/`:

```bash
pnpm ingest:telegram
```

This starts a long-poll loop against `https://api.telegram.org` that runs
until stopped. Progress is logged to stdout, one line per ingested message,
e.g.:

```
Telegram ingestion adapter starting at offset 12. Posting to http://localhost:4000/api/v1/ingest.
ingested alice msg 42 -> contact 5f2a... (created)
ingested alice msg 43 -> contact 5f2a... (updated)
```

Per-item failures (a validation error, a transient 5xx, etc.) are logged to
stderr and the loop continues with the next update — one bad message never
stops the adapter. A `429` response is retried once after honoring the
`Retry-After` value the API returns; secrets are never logged.

Press `Ctrl+C` to stop. `SIGINT`/`SIGTERM` trigger a graceful shutdown: the
in-flight long-poll is aborted, the current offset is persisted, and the
process exits `0`.

## What lands in AygaCRM

For each text message with a sender, the adapter maps it to the
[`ingest`](ingestion-conventions.md#agent-ingestion-pattern) contract:

- **Contact**: resolved-or-created from the sender's handle (`@username` if
  set, otherwise their numeric Telegram user id) via
  `ExternalIdentity(source="telegram", externalId=<handle>)`. First message
  from a new handle creates a new contact (using the sender's Telegram first
  / last name as a starting point); every later message from the same handle
  resolves to the same contact.
- **External record**: one `source: "telegram", kind: "message"` record per
  Telegram message, with the message text as `content`, the chat/message
  metadata (`chatId`, `chatTitle`, `messageId`, `username`, `direction`), and
  `happenedAt` set from the message's Telegram timestamp.
- **Provenance**: the sender's first name / last name / username are recorded
  as `telegram`-sourced provenance on the contact's fields, alongside
  whatever provenance other sources may have already contributed.

## Idempotency and restarts

Each ingested record's `external_id` is `<chatId>:<messageId>` — Telegram's
`message_id` is only unique *within* a chat, so this composition keeps it
globally unique across chats. `POST /api/v1/ingest` is idempotent per
`(source, external_id)` (issues #25/#26): re-posting the same message is a
no-op update, never a duplicate.

On top of that, the adapter persists the last processed `update_id` to
`app/.telegram-offset.json` after each batch, so a restart resumes from where
it left off instead of re-fetching Telegram's entire backlog. If that file is
ever lost, the worst case is some redundant re-POSTs of already-seen
messages — never duplicate data — because idempotency is enforced by the API
itself, not by the offset file.

## Contract boundary

This adapter talks to AygaCRM **exclusively** over `POST /api/v1/ingest`
(Bearer auth), reusing the CLI's plain `fetch` wrapper
(`app/src/cli/lib/client.ts`). It does not, and must not, import `@/lib/db`,
`@prisma/client`, or any server action — that would break the
external-agent/contract boundary described in the
[integration roadmap](roadmap.md).
