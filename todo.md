# Monica CRM — Project TODO

> Living tracker. Updated as work progresses.
> See `docs/` for architecture, backlog, and product vision.

---

## Current Priority: Agent Access Layer (EPIC-0003)

### Next Up
- [ ] CLI wrapper for common operations
- [ ] Agent audit trail and permission scoping

### Done
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
- [ ] Design identity resolution model (external IDs, source attribution)
- [ ] Add provenance fields to Contact and related entities
- [ ] Duplicate detection and merge queue
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
- [ ] `formData.get("label")` in tasks.ts — FormData key should match Prisma field `name`
- [ ] No test coverage for most features
- [ ] No CI/CD pipeline
- [ ] Dual lockfiles: root `package-lock.json` vs `app/pnpm-lock.yaml`
- [ ] Legacy routes still exist at `app/api/monica/v1/` and `app/api/upload/` (outside src tree)

---

## Notes
- App lives at `app/src/...`, alias `@/*` -> `./src/*`
- Package manager: pnpm (in `app/`)
- Stack: Next.js 16.1.6, React 19.2.3, Prisma 7.3.0, NextAuth 5 beta
- 75 Prisma models, 2 enums
- Detailed docs: `docs/product/`, `docs/architecture/`, `docs/backlog/`
- Dev server: `pnpm dev --hostname 127.0.0.1 --port 4000` (port 3000 blocked by Windows EACCES)
- Database: PostgreSQL 18.1 local, `monica` DB, 75 tables
- `.env` in `app/` — `DATABASE_URL=postgresql://postgres@localhost:5432/monica`
