---
name: aygacrm-cli
description: Use when you need to read or write AygaCRM data — contacts, notes, tasks, reminders, activities, calls, gifts, tags, journals, external records — from the command line via the `aygacrm` REST CLI. Covers auth, schema discovery, CRUD, pagination, dry-run, idempotency, and exit codes.
---

# AygaCRM CLI

`aygacrm` is a noun-verb REST client: `aygacrm <resource> <verb> [args] [flags]`. It talks to `${AYGACRM_API_URL}/api/v1` over Bearer auth — it never touches the database directly, so every call goes through the same ability scoping, rate limiting, idempotency, and audit logging as the REST API.

Resources: `contacts`, `activities`, `calls`, `gifts`, `notes`, `reminders`, `tags`, `tasks`, `records`, `journals` (all support `list`/`get`/`create`/`update`/`delete`), and `user` (`get` only — the current token's owner).

Invocation: the built binary is `aygacrm`. In this repo's dev environment it's `pnpm cli <args>` (tsx, run from `app/`). **Never insert a `--` separator with `pnpm cli`** — under pnpm 10 the literal `--` gets forwarded to tsx and commander misparses every following flag. All examples below use `aygacrm`; substitute `pnpm cli` if running from source.

## Environment

```bash
export AYGACRM_API_TOKEN="<your-token>"
export AYGACRM_API_URL="http://localhost:4000"   # default if unset
```

Or pass `--token <t>` / `--url <u>` per-invocation — these override the env vars. Global flags (valid on every command): `--token`, `--url`, `--format json|table` (default `json`).

## Auth check

```bash
aygacrm auth whoami
```

`GET /user` with your token — the fastest way to confirm the token is valid before doing anything else.

## Schema discovery (no network call)

Read the real request/response shape before writing a `--data` payload — don't guess field names:

```bash
aygacrm schema contacts              # every verb's request/response schema
aygacrm schema notes create          # just the create verb
aygacrm schema reminders             # etc.
```

This reads the bundled `docs/api/openapi.json` and resolves one level of `$ref`.

## List, with pagination/sort

```bash
aygacrm contacts list
aygacrm contacts list --page 2 --limit 25
aygacrm contacts list --sort -created_at        # prefix with - for descending

# Follow every page automatically (NDJSON, one JSON object per line):
aygacrm contacts list --page-all > all-contacts.ndjson
```

`--page-all` follows `links.next` until exhausted; it guards against pagination loops (caps at 10,000 pages, bails on a repeated next-link).

## Get

```bash
aygacrm contacts get <id>
aygacrm user get                     # singleton — no id
```

## Create

`--data` takes a JSON string; the CLI validates it's parseable JSON but the server validates the schema.

```bash
# Contact (only first_name is required)
aygacrm contacts create --data '{"first_name":"Ada","last_name":"Lovelace"}'

# Note (contact_id + body required)
aygacrm notes create --data '{"contact_id":"<contactId>","body":"Met at the conference, discussed the new role.","title":"Conference catch-up"}'

# Reminder (contact_id + contact_important_date_id + reminder_choice required)
aygacrm reminders create --data '{"contact_id":"<contactId>","contact_important_date_id":"<dateId>","reminder_choice":"week","number_of_days_before":3}'

# Task (contact_id required; name or label required)
aygacrm tasks create --data '{"contact_id":"<contactId>","name":"Send follow-up email"}'

# Tag
aygacrm tags create --data '{"name":"conference-2026"}'
```

Run `aygacrm schema <resource> create` first if unsure which fields are required — required fields differ per resource (e.g. `ContactCreate` only requires `first_name`; `NoteCreate` requires `contact_id` and `body`).

## Update

```bash
aygacrm contacts update <id> --data '{"job_position":"Staff Engineer"}'
```

Same `--data` mechanics as create; only the fields you pass are changed.

## Delete

```bash
aygacrm contacts delete <id>              # prompts "Delete contact <id>? [y/N]" on stderr
aygacrm contacts delete <id> --yes        # skip the prompt (use in scripts/non-interactive contexts)
```

## `--dry-run`

Available on `create`, `update`, and `delete`. Prints the method, URL, and body to **stderr** without sending the request, then exits 0 — use it to sanity-check a payload before committing to it:

```bash
aygacrm notes create --data '{"contact_id":"abc","body":"test"}' --dry-run
```

## `--idempotency-key`

Available on `create`, `update`, and `delete`. Set it to a stable key (e.g. a UUID you generate once per logical operation) when a call might be retried — a repeat with the same key **and** the same body replays the original response; the same key with a **different** body returns a `409`:

```bash
aygacrm contacts create --data '{"first_name":"Ada"}' --idempotency-key "create-ada-$(uuidgen)"
```

## Output format

```bash
aygacrm contacts list --format json     # default: pretty-printed JSON
aygacrm contacts list --format table    # aligned columns, one row per item; nested objects shown as compact JSON
```

stdout carries only the JSON/table payload — prompts, dry-run output, and errors always go to stderr, so `aygacrm ... --format json | jq '...'` pipes cleanly.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | success |
| `2` | auth error — missing `--token`/`AYGACRM_API_TOKEN`, or the server returned `401`/`403` |
| `3` | bad flag, invalid `--data` JSON, or the server returned `400`/`422` |
| `4` | not found (`404`) |
| `5` | anything else — `429` rate limit (reported with retry-after seconds), `5xx`, network failure |

Check `$?` in scripts; on `429` the CLI prints the retry-after duration to stderr — back off before retrying.

## Full example flow

```bash
export AYGACRM_API_TOKEN="..."
aygacrm auth whoami
aygacrm schema contacts create
aygacrm contacts create --data '{"first_name":"Grace","last_name":"Hopper"}' --idempotency-key "seed-grace-hopper"
aygacrm contacts list --sort -created_at --limit 5 --format table
```
