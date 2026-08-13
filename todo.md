# Monica CRM — Project TODO

> Living tracker. Updated as work progresses.
> See `docs/` for architecture, backlog, and product vision.

---

## Current Priority: Product Polish & Quality

### Next Up
- [ ] (nothing open) — all 21 GitHub issues closed

### Done (platform-hardening, cont.)
- [x] #17 File/photo storage → MinIO (S3): src/lib/storage/s3.ts (AWS SDK v3), upload streams to bucket under vault/{id}/{type}/{uuid}-{name}, File.storageKey column, /api/files/{uuid} resolver 307→presigned (private bucket, S3_PUBLIC_ENDPOINT for browser reach). Verified live against ozubuntu bucket `monica` (canary + app upload→resolver→delete). Opus-reviewed, 4 risks fixed. Local .env holds creds (gitignored)

### Done (platform-hardening batch, docs-gap issues #17-21)
- [x] #21 Next.js middleware — edge-safe NextAuth split config (auth.config.ts), gates dashboard routes with callbackUrl return-to, bounces authed users off /login,/register
- [x] #20 Rate limiting — in-memory per-token fixed window in withApiAuth, 429 + Retry-After/X-RateLimit-* headers, API_RATE_LIMIT_PER_MINUTE (default 120), verified live (5 pass → 429)
- [x] #18 Idempotency keys — Idempotency-Key header on v1 writes, replay stored response, 409 on same-key-different-body, 24h TTL, ApiIdempotencyKey model, verified live (replay=same id, conflict=409)
- [x] #19 OpenAPI 3.1 spec — docs/api/openapi.json (23 endpoints), served at /api/v1/openapi.json, redocly lint 0 warnings, CI gate, schemas spot-checked vs route Zod

### Done
- [x] #16 Reminder notification delivery — email (nodemailer/SMTP) + Telegram (Bot API), CRON_SECRET-protected /api/cron/reminders route, per-day dedup, failed-status + retry-on-next-run, 17 unit tests; verified live against a local SMTP catcher
- [x] GitHub repo created (ozand/monica-crm, private) — 16 issues filed from full surf-CLI E2E diagnostic
- [x] Issues #1-15 fixed and closed across 5 increments (commits caa2983..7155a06):
  - #1 SelectItem value="" crashes (10 spots, 8 files) — "none" sentinel + submit mapping
  - #2/#11 legacy SearchDialog deleted — single Ctrl+K palette, pluralization gone with it
  - #3 Mood Trends infinite Loading — root cause was invalid vaultId filter in getMoodStats + no error handling
  - #4 important dates now typed (form select + server get-or-create + label fallback in reports)
  - #5 Settings duplicate card, #6 invalid hsl(var()) chart colors → var(--chart-N), #7 DialogTitle a11y, #8 debug text
  - #9 OAuth buttons gated by NEXT_PUBLIC_AUTH_* flags, #12 dashboard stat renamed "Events in 30 Days"
  - #13 create-contact redirects to detail page, #14 year hint, #15 Coming Soon card removed
  - #10 aria-labels on icon-only controls (layout, calendar, contact detail) — 0 nameless app elements
- [x] Smoke spec hardened against cold-start hydration race + updated for detail-page redirect
- [x] E2E tests with Playwright complete — smoke spec passes locally against production server (`next start`, port 4000): register → login → create contact → global search → contact detail
- [x] Fixed runtime crash on server-action pages — `API_ABILITIES` / `MODULE_TYPES` const exports moved out of "use server" modules into `src/lib/api-abilities.ts` / `src/lib/module-types.ts` (build passed but module eval failed at runtime)
- [x] Smoke spec fixed — targeted sidebar GlobalSearch palette (placeholder "…records...") instead of legacy header SearchDialog; `exact: true` on Contacts heading; search result click-through to contact detail verifies email
- [x] Fixed tsc error in external-identities.test.ts — PrismaClientKnownRequestError now requires `clientVersion`
- [x] Fix `seed.ts` Next.js `use server` export violation by moving `SeedResult` type out of server module
- [x] Playwright scaffolding added — `playwright.config.ts`, `test:e2e` script, Chromium project
- [x] Minimal smoke spec added — register, login, create contact, verify global search can find it
- [x] CI updated to install Playwright Chromium and run the smoke spec after build
- [x] E2E rollout refined to use production-server path (`next start`) for stable smoke execution instead of dev-mode compilation
- [x] Unit tests for merge.ts — mergeContacts (field transfer, relation transfer, label/group/tag dedup, soft-delete, merge log), unmergeContacts, getMergeHistory
- [x] Unit tests for provenance.ts — recordProvenance (deactivate+create, multi-field, setBy), getProvenanceForContact, getProvenanceHistory
- [x] Unit tests for external-identities.ts — CRUD operations, vault scoping, P2002 duplicate handling, findContactsByExternalId
- [x] 116 tests across 9 suites — all passing
- [x] Vitest config updated: `pool: "forks"` to fix Node v24 hanging issue
- [x] Contact form completeness — maiden name, gender, pronouns, company, religion fields with dropdown selects
- [x] Server actions updated — createContact/updateContact accept genderId, pronounId, companyId, religionId
- [x] Create/edit pages fetch option lists (genders, pronouns, companies, religions) in parallel via Promise.all
- [x] GitHub Actions CI workflow (`.github/workflows/ci.yml`) — PostgreSQL service, tsc check, vitest, next build
- [x] API records validation tests (`api-records-validation.test.ts`) — createExternalRecordSchema, updateExternalRecordSchema, per-source metadata validation
- [x] Dashboard tests (`dashboard.test.ts`) — getDashboardStats shape/zeros, getRecentActivity merge/sort/limit
- [x] Search tests (`search.test.ts`) — globalSearch empty/short queries, type-tagged results, external records search, auth failure
- [x] 69 tests across 6 suites — all passing
- [x] Global search command palette (Ctrl+K) — searches contacts, notes, tasks, activities, groups, labels, external records
- [x] Global search wired into sidebar with trigger button
- [x] External records added to globalSearch() results
- [x] Contacts list pagination (24 per page, page controls, URL-driven)
- [x] Contacts list sorting (by name, updated, created — asc/desc)
- [x] Contacts list filtering by label and group
- [x] getLabels() and getGroups() server actions for filter options
- [x] Vitest 4.1.2 set up with native tsconfig paths, `pnpm test` / `pnpm test:watch` scripts
- [x] 52 unit tests across 3 test suites — all passing
- [x] Tests: ingestion-conventions.ts — source/kind validation, metadata schemas, create/update schemas
- [x] Tests: canonical-fields.ts — selectCanonicalValue priority rules, tie-breaking, manual override
- [x] Tests: duplicates.ts — normalizeEmail/Phone, name similarity scoring, evaluatePair threshold logic
- [x] PUT /api/v1/records/:id — update external records with validation, metadata check, audit logging
- [x] Dashboard activity feed — recent notes, tasks, external records across all contacts
- [x] Unified activity timeline on contact detail — merges feed items + external records, sorted by date
- [x] RECORD_UPDATED audit action added
- [x] Ingestion conventions — standardized source/kind pairs, metadata Zod schemas, validation across all write interfaces
- [x] API v1 `/api/v1/records` route — GET with pagination/filtering, POST with full validation + audit logging
- [x] Source/kind validation added to server actions, MCP, CLI, and UI
- [x] UI upgraded — source/kind dropdowns with dynamic kind filtering based on source
- [x] Docs: `docs/integrations/ingestion-conventions.md` — full reference for sources, kinds, metadata schemas, and example API calls
- [x] EPIC-0004 pivoted from native connectors to agent-driven ingestion contracts and curated external context storage
- [x] `ExternalRecord` model added — generic storage for external references, snippets, tasks, pages, messages, meetings, and transcripts
- [x] External records server actions (`external-records.ts`) — add, update, delete, list with vault ownership checks
- [x] External records UI on contact detail page (`external-records-card.tsx`)
- [x] CLI extended with `records list` and `records add`
- [x] MCP extended with `monica_list_records` and `monica_add_record`
- [x] Docs updated for agent-driven ingestion architecture (vision, data model, integration roadmap, EPIC-0004)
- [x] CLI wrapper (`app/src/cli/monica-cli.ts`) — 7 commands: contacts list/get/search, notes add, tasks list/create, status
- [x] Canonical field selection rules (`canonical-fields.ts`) — deterministic source priority, manual override wins, conflict detection
- [x] Deleted stale root files: vitest.config.ts, tsconfig.json, tests/, monicaApi.ts, storage.sqlite3, scripts/, utils/
- [x] Agent audit trail — 36 audit calls wired across 22 API/MCP route files
- [x] Audit module refactored — constants/helpers split from "use server" for Next.js compatibility
- [x] Root package.json cleaned — stale deps removed, root node_modules deleted
- [x] Build verification — tsc 0 errors, next build passes (fresh session fixed hanging)
- [x] Fixed merge.ts TS error (Prisma.JsonNull for nullable JSON field)
- [x] Duplicate detection algorithm (`duplicates.ts`) — name similarity, email/phone match via ExternalIdentity + ContactInformation
- [x] Merge/unmerge server actions (`merge.ts`) — atomic merge with relation transfer, soft-delete, merge log, simplified unmerge
- [x] Merge queue UI (`merge-queue.tsx`) — candidate list with scores, merge confirmation dialog, dismiss flow
- [x] Contacts page integration (`possible-duplicates-section.tsx`) — collapsible "Check for Duplicates" section
- [x] ExternalIdentity CRUD server actions (`external-identities.ts`) — add, update, delete, list, findByExternalId
- [x] ExternalIdentity UI component on contact detail page (`external-identity-form.tsx`)
- [x] Provenance tracking — `provenance.ts` with recordProvenance, getProvenanceForContact, getProvenanceHistory
- [x] Provenance integrated into contact create/update flows (tracks name, job, prefix/suffix fields)
- [x] Added 3 Golden Record models: ExternalIdentity, ContactMergeLog, ContactFieldProvenance (78 tables total)
- [x] Cleaned tech debt: deleted 10 legacy routes, fixed tasks label→name FormData key, removed dual lockfile
- [x] Harden API v1 — Zod validation on all 20 POST/PUT endpoints, proper error separation (parse/validation/business/internal), INTERNAL_ERROR code added
- [x] MCP route migrated to `app/src/app/api/mcp/route.ts` — proper auth via validateApiToken, 9 tools with Zod validation, no SDK dependency
- [x] Ability naming normalized — `journal:*` → `journals:*` in 4 route files
- [x] User route fixed — returns 404 instead of `apiSuccess(null)`
- [x] Old MCP route deleted (`app/api/mcp/route.ts`)
- [x] Shared validation helper created (`app/src/lib/api/validation.ts`)
- [x] Fix duplicate JournalEntry in Prisma schema
- [x] Generate Prisma client successfully
- [x] Fix avatar/photos — delete 6 wrongly-placed files, fix edit page imports
- [x] Fix 52 TypeScript errors (tasks `label`→`name`, calls `type`/`answered` removal, missing packages, import/export mismatches)
- [x] `tsc --noEmit` passes with 0 errors
- [x] Install missing packages: `recharts`, `@radix-ui/react-icons`
- [x] Fix `export.ts` — add `"use server"`, remove `revalidatePath` import
- [x] Create docs/ skeleton (16 files: vision, principles, scope, architecture, agent-access, glossary, DoR, DoD, templates)
- [x] Create 4 backlog epics (Core CRM, Golden Record, Agent Access, First Integrations)
- [x] Fix `next.config.ts` — serverExternalPackages + turbopack root
- [x] Add `export const dynamic = 'force-dynamic'` to 13 dashboard pages, 25 API routes, and dashboard layout
- [x] Make `db.ts` lazy (proxy) to prevent eager DB connection during build
- [x] Create root `.gitignore` and `.env.example`
- [x] `next build` passes successfully (Turbopack, 0 errors)
- [x] Initial git commit (baseline)
- [x] Database setup — PostgreSQL `monica` DB, 75 tables via `prisma db push`
- [x] Dev server verified — `pnpm dev --hostname 127.0.0.1 --port 4000` starts successfully
- [x] Reports page — 3 new reports (Important Dates, Activity Summary, Gifts & Loans)
- [x] Created `report-stats.ts` server actions for vault-wide report aggregation
- [x] API v1 hardened — Zod validation, error separation, ability normalization
- [x] MCP route migrated — proper auth, 9 tools, typed, no SDK dependency
- [x] Shared `validation.ts` helper created for API routes

---

## Backlog (by Epic)

### EPIC-0001: Core CRM Stabilization
- [x] Build passes without DB connection
- [x] Dev environment works end-to-end
- [x] Reports page — 3 reports implemented (Geographical Distribution deferred)
- [x] MCP route — moved to `app/src/app/api/mcp/route.ts` (done in EPIC-0003)

### EPIC-0002: Golden Record Foundation
- [x] Add ExternalIdentity, ContactMergeLog, ContactFieldProvenance models to schema
- [x] Prisma db push — 78 tables
- [x] Server actions for ExternalIdentity CRUD
- [x] Provenance tracking in contact create/update flows
- [x] UI for external identities on contact detail page
- [x] Duplicate detection algorithm (name/email/phone matching with scoring)
- [x] Merge/unmerge server actions (atomic merge, relation transfer, merge log)
- [x] Merge queue UI on contacts page (collapsible, with confirmation dialog)
- [x] Build verification — tsc 0 errors, next build passes
- [x] Canonical field selection rules

### EPIC-0003: Agent Access Layer
- [x] Harden API v1 — Zod schemas, proper error handling, ability normalization
- [x] MCP server — 9 tools with proper auth, Zod validation, vault scoping
- [x] Agent audit trail — 36 audit calls in API v1 + MCP write operations
- [x] CLI wrapper for common operations

### EPIC-0004: First Integrations
- [x] Reframe EPIC-0004 around agent-driven ingestion instead of Monica-owned native connectors
- [x] Add `ExternalRecord` model for curated external references, snippets, and transcripts
- [x] Server actions for external records CRUD
- [x] UI for external records on contact detail page
- [x] CLI support for external records (`records list`, `records add`)
- [x] MCP support for external records (`monica_list_records`, `monica_add_record`)
- [x] Build verification — prisma generate/db push, tsc 0 errors, next build passes
- [x] Ingestion conventions — standardized source/kind pairs, metadata schemas, validation rules
- [x] API v1 `/api/v1/records` — full CRUD: GET (list + detail), POST, PUT, DELETE with validation + audit
- [x] Source/kind validation enforced across all write interfaces (API, MCP, CLI, server actions, UI)
- [x] UI dropdowns for source/kind with dynamic filtering
- [x] Docs: `docs/integrations/ingestion-conventions.md`
- [x] Adapters complete — conventions + validated write interfaces ARE the adapters; agents use API/MCP/CLI directly

---

## Tech Debt
- [x] `app/api/mcp/route.ts` had `// @ts-nocheck` — replaced with properly typed route at `app/src/app/api/mcp/route.ts`
- [x] `formData.get("label")` in tasks.ts — fixed to `formData.get("name")` to match Prisma field
- [x] Legacy routes deleted: `app/api/monica/` (10 files)
- [x] Dual lockfiles resolved: root `package-lock.json` removed
- [x] Root `package.json` cleaned — stale deps removed, node_modules deleted
- [x] Root vitest.config.ts, tsconfig.json, tests/, monicaApi.ts, scripts/, utils/, storage.sqlite3 — all deleted
- [x] Test infrastructure added — Vitest 4.1.2, 116 tests, 9 suites (ingestion-conventions, canonical-fields, duplicates, api-records-validation, dashboard, search, merge, provenance, external-identities)
- [x] CI/CD pipeline — GitHub Actions workflow with PostgreSQL, tsc, tests, build

---

## Notes
- App lives at `app/src/...`, alias `@/*` -> `./src/*`
- Package manager: pnpm (in `app/`)
- Stack: Next.js 16.1.6, React 19.2.3, Prisma 7.3.0, NextAuth 5 beta
- 79 Prisma models (75 core + 4 golden record), 2 enums
- Detailed docs: `docs/product/`, `docs/architecture/`, `docs/backlog/`
- CLI: `pnpm exec tsx src/cli/monica-cli.ts <command>` from `app/` (direct DB, no auth)
- Dev server: `pnpm dev --hostname 127.0.0.1 --port 4000` (port 3000 blocked by Windows EACCES)
- Database: PostgreSQL 18.1 local, `monica` DB, 79 tables
- `.env` in `app/` — `DATABASE_URL=postgresql://postgres@localhost:5432/monica`
