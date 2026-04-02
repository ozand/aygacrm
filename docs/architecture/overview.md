# Architecture Overview

## Stack

Monica runs on Next.js 16, React 19, Prisma 7, PostgreSQL, and NextAuth 5 beta. The current implementation uses `@prisma/adapter-pg` for database access.

## Subsystems

- **Auth** — user sign-in, session handling, and provider integration
- **Core CRM** — contacts, relationships, interactions, notes, reminders, and related records
- **API Layer** — REST API v1 routes for core entities
- **Agent Access** — controlled machine access through API, and later CLI and MCP
- **Integration Fabric** — connectors that pull in and normalize external data

## App structure

- `app/src/app/` — routes and route-level UI
- `app/src/components/` — reusable UI components
- `app/src/lib/` — business logic, server actions, helpers, and domain services
- `app/prisma/` — Prisma schema and database-related assets

## Data flow

### Browser flow

Browser → Next.js Server Components / Server Actions → Prisma → PostgreSQL

The default path is server-rendered. Client components are used only when interactivity requires them.

### API flow

External client → API token auth → REST v1 routes → Prisma → PostgreSQL

## Key constraints

- Server Components are the default rendering model.
- Client Components are used only when necessary.
- Server Actions handle mutations whenever they fit the route.

## Current limitations

- No middleware layer yet
- `next.config` is currently empty
- No CI/CD pipeline is defined yet
