# Monica CRM — Project TODO

> Living tracker. Updated as work progresses.
> See `docs/` for architecture, backlog, and product vision.

---

## Current Priority: Build Stabilization (EPIC-0001)

### In Progress
- [ ] Dev environment works end-to-end (needs running PostgreSQL)
- [ ] Reports page — implement remaining "Coming Soon" reports

### Done
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

---

## Backlog (by Epic)

### EPIC-0001: Core CRM Stabilization
- [x] Build passes without DB connection
- [ ] Dev environment works end-to-end
- [ ] Reports page — implement remaining "Coming Soon" reports
- [ ] MCP route — move from `app/api/mcp/` to `app/src/app/api/mcp/` or remove

### EPIC-0002: Golden Record Foundation
- [ ] Design identity resolution model (external IDs, source attribution)
- [ ] Add provenance fields to Contact and related entities
- [ ] Duplicate detection and merge queue
- [ ] Canonical field selection rules

### EPIC-0003: Agent Access Layer
- [ ] Harden API v1 — consistent error responses, pagination, filtering
- [ ] CLI wrapper for common operations
- [ ] MCP server with safe contact/interaction tools
- [ ] Agent audit trail and permission scoping

### EPIC-0004: First Integrations
- [ ] Email connector (import contacts + interaction history)
- [ ] Telegram connector
- [ ] LinkedIn connector
- [ ] Todoist sync (tasks bidirectional)
- [ ] Notion sync (contacts/projects)

---

## Tech Debt
- [ ] `app/api/mcp/route.ts` has `// @ts-nocheck` — needs proper typing or removal
- [ ] `formData.get("label")` in tasks.ts — FormData key should match Prisma field `name`
- [ ] No test coverage for most features
- [ ] No CI/CD pipeline
- [ ] Dual lockfiles: root `package-lock.json` vs `app/pnpm-lock.yaml`

---

## Notes
- App lives at `app/src/...`, alias `@/*` → `./src/*`
- Package manager: pnpm (in `app/`)
- Stack: Next.js 16.1.6, React 19.2.3, Prisma 7.3.0, NextAuth 5 beta
- 75 Prisma models, 2 enums
- Detailed docs: `docs/product/`, `docs/architecture/`, `docs/backlog/`
