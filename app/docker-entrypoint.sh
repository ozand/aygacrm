#!/bin/sh
# Entrypoint for the AygaCRM web container.
#
# 1. Syncs the Postgres schema with `prisma db push` (idempotent — safe to
#    run on every container start, including against an already-synced DB).
# 2. Starts the standalone Next.js server.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. AygaCRM cannot start without a database connection." >&2
  echo "Example: postgresql://user:password@host:5432/aygacrm?schema=public" >&2
  exit 1
fi

echo "Syncing database schema (prisma db push)..."

# A few retries absorb the common case where the Postgres container's
# healthcheck reports "ready" a moment before it actually accepts
# connections. Kept intentionally simple — no backoff, no config.
attempt=1
max_attempts=10
until ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema=prisma/schema.prisma; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "ERROR: 'prisma db push' failed after ${max_attempts} attempts." >&2
    exit 1
  fi
  echo "Schema push failed (attempt ${attempt}/${max_attempts}), retrying in 3s..."
  attempt=$((attempt + 1))
  sleep 3
done

echo "Starting AygaCRM on port ${PORT:-4000}..."
exec node server.js
