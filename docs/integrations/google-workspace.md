# Google Workspace (Contacts + Gmail) — external collector

**Status:** planned. This documents the intended architecture; no reference
collector ships yet.

## Shape

Google Workspace is **not** integrated inside AygaCRM. Per
[ADR 0001](../architecture/adr/0001-local-first-golden-record-external-collectors.md),
it is reached by an **external collector agent** that runs outside the product,
authenticates to Google itself, and pushes normalized data into AygaCRM. Data
flows **one way only, into AygaCRM** — nothing is ever written back to Google.

```
Google Workspace                external collector                 AygaCRM
(Contacts / Gmail)   ──auth──▶   (googleworkspace/cli    ──HTTP──▶  POST /api/v1/ingest
                                  or People/Gmail API)              (resolve+merge+store)
```

The collector is the direct analogue of the shipped Telegram adapter
(`app/src/ingest/telegram/run.ts`): collect → map to the ingest contract → POST.

## Collector responsibilities (outside the product)

- Authenticate to Google (OAuth / service account) using
  [`googleworkspace/cli`](https://github.com/googleworkspace/cli) or the Google
  People / Gmail APIs. **All Google credentials live here, never in AygaCRM.**
- Read Google Contacts and/or Gmail message metadata.
- Map each item to AygaCRM's ingestion contract:
  - a **contact** identity (name, email(s), phone(s)) → resolve-or-create;
  - Gmail threads/messages → **external records** (`source: "email"`, kind per
    [ingestion conventions](ingestion-conventions.md)) attached to that contact,
    with provenance.
- Hold an AygaCRM API token with the `contacts:write` ability and call
  `POST /api/v1/ingest` (idempotent; safe to re-run).

## AygaCRM responsibilities (the product)

- Validate and store the pushed data.
- Resolve the external identity to an existing golden record or create one.
- Deduplicate / merge across sources (by signal or manual), tracking provenance.
- **Never** expose or export golden records back to Google or any source.

## Why not a plugin

Putting Google auth + SDK inside the product would store Google refresh tokens
in AygaCRM, couple the core to a vendor, and open an export path — all rejected
in [ADR 0001](../architecture/adr/0001-local-first-golden-record-external-collectors.md).
Keeping Google in an external collector keeps the product small and the golden
record local-first by construction.

## See also

- [Ingestion conventions](ingestion-conventions.md) — source/kind + validation
- [Telegram adapter](telegram.md) — the reference collector to mirror
- [Agent access](../architecture/agent-access.md) — the API/MCP/CLI write surfaces
