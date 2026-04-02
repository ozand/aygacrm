# Monica CRM — Project TODO

> Living tracker. Updated as work progresses.
> See `docs/` for architecture, backlog, and product vision.

---

## Current Priority: Agent Access Layer (EPIC-0003)

### In Progress
- [ ] Agent audit trail — wire audit logging into API v1 and MCP write operations
- [ ] Root package.json cleanup — remove stale deps (sharp, vitest, etc.)

### Next Up
- [ ] CLI wrapper for common operations (EPIC-0003)
- [ ] Canonical field selection rules (EPIC-0002)

### Done
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
- [ ] Canonical field selection rules

### EPIC-0003: Agent Access Layer
- [x] Harden API v1 — Zod schemas, proper error handling, ability normalization
- [x] MCP server — 9 tools with proper auth, Zod validation, vault scoping
- [ ] CLI wrapper for common operations
- [ ] Agent audit trail and permission scoping

### EPIC-0004: First Integrations
- [ ] Email connector (import contacts + interaction history)
- [ ] Telegram connector
- [ ] LinkedIn connector
- [ ] Todoist sync (tasks bidirectional)
- [ ] Notion sync (contacts/projects)

---

## Tech Debt
- [x] `app/api/mcp/route.ts` had `// @ts-nocheck` — replaced with properly typed route at `app/src/app/api/mcp/route.ts`
- [x] `formData.get("label")` in tasks.ts — fixed to `formData.get("name")` to match Prisma field
- [x] Legacy routes deleted: `app/api/monica/` (10 files)
- [x] Dual lockfiles resolved: root `package-lock.json` removed
- [ ] No test coverage for most features
- [ ] No CI/CD pipeline
- [ ] Root `package.json` still has stale deps (sharp, vitest) — cleanup in progress

---

## Notes
- App lives at `app/src/...`, alias `@/*` -> `./src/*`
- Package manager: pnpm (in `app/`)
- Stack: Next.js 16.1.6, React 19.2.3, Prisma 7.3.0, NextAuth 5 beta
- 78 Prisma models (75 core + 3 golden record), 2 enums
- Detailed docs: `docs/product/`, `docs/architecture/`, `docs/backlog/`
- Dev server: `pnpm dev --hostname 127.0.0.1 --port 4000` (port 3000 blocked by Windows EACCES)
- Database: PostgreSQL 18.1 local, `monica` DB, 75 tables
- `.env` in `app/` — `DATABASE_URL=postgresql://postgres@localhost:5432/monica`
