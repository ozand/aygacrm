# NOTICE — Attribution & Derivative-Work Statement

**AygaCRM** is a modern rewrite (PHP/Laravel → TypeScript/Next.js/Prisma) and is a
**derivative work of Monica**.

- **Upstream project:** Monica — https://github.com/monicahq/monica
- **Upstream copyright:** Copyright © Monica contributors
- **Upstream license:** GNU Affero General Public License v3.0 (AGPL-3.0)

Because AygaCRM derives from Monica, it is distributed under the **same license,
AGPL-3.0-only** (see [`LICENSE.md`](./LICENSE.md)). This is a legal requirement of
the AGPL's copyleft, not an optional choice. SPDX: `AGPL-3.0-or-later`
(matching upstream Monica).

## Modifications made in AygaCRM (AGPL-3.0 §5(a))

AygaCRM is not a copy of Monica. Significant modifications, beginning **2026**,
include:

- Complete reimplementation of the application layer from PHP 8 / Laravel to
  **TypeScript on Next.js 16 (App Router) + React 19**.
- Data layer migrated from Eloquent/MySQL to **Prisma 7 + PostgreSQL**.
- Authentication reimplemented with **NextAuth (Auth.js v5)**.
- New agent-oriented surfaces: a REST API v1, an **MCP server**, a CLI, and an
  external-agent ingestion contract (`POST /api/v1/ingest`).
- Project renamed from *Monica* to *AygaCRM*; the original vendored Laravel source
  was removed after the rewrite.

Copyright © 2026 AygaCRM contributors, for all modifications and newly authored
code. Original portions remain Copyright © Monica contributors.

## AGPL-3.0 §13 — network use

AygaCRM is network-accessible software. When you run a modified version and let
users interact with it over a network, you must offer those users access to the
corresponding source code. The running application links to its source repository
for this purpose.
