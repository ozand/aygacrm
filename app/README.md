# AygaCRM - Personal Relationship Manager

AygaCRM — a modern rewrite, originally based on [Monica CRM](https://github.com/monicahq/monica), using Next.js 15, TypeScript, Prisma, and PostgreSQL.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** NextAuth.js (Auth.js v5)
- **Styling:** Tailwind CSS v4
- **UI Components:** Shadcn/ui
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your database connection:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/aygacrm"
   AUTH_SECRET="your-secret-key-minimum-32-characters"
   ```

3. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

4. **Run database migrations:**
   ```bash
   npx prisma db push
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages (login, register)
│   ├── (dashboard)/       # Protected dashboard pages
│   │   ├── contacts/      # Contact management
│   │   ├── dashboard/     # Main dashboard
│   │   ├── journal/       # Journal entries
│   │   └── settings/      # User settings
│   └── api/               # API routes
├── components/
│   ├── features/          # Feature-specific components
│   └── ui/                # Shadcn/ui components
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── db.ts              # Prisma client
│   └── utils.ts           # Utility functions
├── server/
│   ├── actions/           # Server actions
│   └── services/          # Business logic
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript type definitions
```

## Features

### Implemented
- [x] Project setup with Next.js 15
- [x] PostgreSQL database with Prisma ORM
- [x] Complete database schema (50+ models)
- [x] Authentication (Email/Password, Google, GitHub)
- [x] Dashboard layout with sidebar
- [x] Basic pages structure

### Roadmap
- [ ] Contact CRUD operations
- [ ] Contact relationships
- [ ] Birthday reminders
- [ ] Notes and activities
- [ ] Journal with mood tracking
- [ ] File uploads
- [ ] Search functionality
- [ ] Settings and preferences
- [ ] Data export/import
- [ ] CalDAV/CardDAV sync

## Database Schema

The Prisma schema includes all entities from the original Monica CRM:

- **Core:** Account, User, Vault
- **Contacts:** Contact, Gender, Pronoun, Religion
- **Information:** Address, ContactInformation, ImportantDate
- **Relationships:** RelationshipType, Relationship, Group
- **Activities:** Note, Activity, Call, LifeEvent
- **Journal:** Journal, Post, SliceOfLife, MoodTracking
- **And more:** Tasks, Goals, Gifts, Loans, Files, Templates

## Development

```bash
# Run development server
npm run dev

# Run Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to database
npx prisma db push

# Create a migration
npx prisma migrate dev --name migration_name

# Type checking
npm run lint
```

## License

AGPL-3.0-or-later (same as original Monica CRM)

## API

The app exposes a REST API under `/api/v1` (routes in `src/app/api/v1/*`),
covering contacts, activities, calls, gifts, notes, reminders, tags, tasks,
records, journals (with nested journal entries), and the current user.

### Authentication

Requests require a Bearer API token:

`Authorization: Bearer YOUR_API_TOKEN`

Tokens are created in the app (Settings → API Tokens). They're stored hashed
(the `ApiToken` model) and looked up on each request — see
`src/lib/api/auth.ts`. Each token carries **ability scopes** (e.g. `read`,
`write`, `delete`, or `*`); requests are rejected with `403` if the token
lacks the ability a route requires.

### Rate limiting

Each token is rate-limited per minute (configurable via
`API_RATE_LIMIT_PER_MINUTE`, default 120/min). Exceeding it returns `429` with
`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`X-RateLimit-Reset` headers.

### Idempotency

Write requests (`POST`/`PUT`/`PATCH`/`DELETE`) may include an
`Idempotency-Key` header. A repeated request with the same key and the same
body replays the original response with an `Idempotent-Replay: true` header;
the same key with a *different* body returns `409`.

### Example

```
GET /api/v1/contacts
Authorization: Bearer YOUR_API_TOKEN
```

### Full reference

The full endpoint and schema reference is an OpenAPI 3.1 spec, kept in sync
with the implementation:

- Served live at `GET /api/v1/openapi.json`
- Source file: `docs/api/openapi.json`

## Model Context Protocol (MCP)

Two ways to reach AygaCRM as an AI agent — details, config snippets, and
comparison with the CLI are in
[`docs/architecture/agent-access.md`](../docs/architecture/agent-access.md).

- **MCP server (stdio)** — a spec-compliant MCP server built on
  `@modelcontextprotocol/sdk`. Run it with `pnpm mcp` (or the `aygacrm-mcp`
  bin); auth is via a `AYGACRM_API_TOKEN` env var, scoping every tool call to
  that token's abilities. See `src/mcp/aygacrm-mcp.ts` and
  `src/lib/mcp/server.ts`.
- **Legacy HTTP endpoint** — `POST /api/mcp`, Bearer-authenticated, with a
  custom (non-JSON-RPC) body shape:

  ```json
  { "tool": "aygacrm_create_contact", "arguments": { "first_name": "John" } }
  ```

  returning `{ "result": ... }` on success. `GET /api/mcp` returns a tool
  manifest. New integrations should prefer the stdio MCP server.

## CLI

Two CLIs live under `src/cli/`: `aygacrm` (a REST API v1 client, `pnpm cli`)
and the legacy direct-DB `aygacrm-cli`. See
[`docs/architecture/agent-access.md`](../docs/architecture/agent-access.md)
for usage, auth, and verbs.
