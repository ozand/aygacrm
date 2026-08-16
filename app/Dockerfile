# syntax=docker/dockerfile:1
#
# AygaCRM web image.
#
# Build context: THIS DIRECTORY (app/), not the repo root.
#   docker build -f app/Dockerfile -t aygacrm ./app
# docker-compose.yml and .github/workflows/docker-publish.yml both build
# with context "./app" and this Dockerfile — keep them in sync if you change
# any COPY path below.

ARG NODE_VERSION=22

# -----------------------------------------------------------------------
# base: shared Node + pnpm setup used by every later stage
# -----------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# -----------------------------------------------------------------------
# deps: full install (incl. devDependencies), used only to build the app
# -----------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate

# -----------------------------------------------------------------------
# prod-deps: production-only install, used for the runtime image.
#
# `prisma` (the CLI) and its query engine (`@prisma/engines`) are declared
# as regular "dependencies" in package.json, not devDependencies — so a
# --prod install still contains everything the entrypoint needs to run
# `prisma db push` at container startup, alongside what the running server
# needs (@prisma/client, pg, @prisma/adapter-pg, bcryptjs).
# -----------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod
RUN pnpm exec prisma generate

# -----------------------------------------------------------------------
# builder: compile the Next.js app (output: "standalone")
# -----------------------------------------------------------------------
FROM base AS builder

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Placeholder env for `next build` only — passed INLINE on this RUN so nothing
# is persisted in an image layer or ARG/ENV metadata (avoids the Docker
# SecretsUsedInArgOrEnv smell; these are throwaway non-secrets anyway).
# src/lib/db.ts wraps PrismaClient in a lazy proxy that only reads DATABASE_URL
# on first DB access — never at build/import time — so these values are just a
# defensive fallback in case a route or the auth config eagerly reads an env
# var during the build. None of them reach the runtime image.
RUN DATABASE_URL="postgresql://user:password@localhost:5432/aygacrm?schema=public" \
    AUTH_SECRET="build-time-placeholder-not-a-real-secret" \
    AUTH_URL="http://localhost:4000" \
    NEXT_PUBLIC_APP_URL="http://localhost:4000" \
    pnpm build

# -----------------------------------------------------------------------
# runner: minimal runtime image
# -----------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# node:*-slim images already ship a non-root "node" user (uid/gid 1000).
RUN chown -R node:node /app

# Next.js standalone server + static assets + public files.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Full production node_modules — deliberately REPLACES the smaller subset
# that Next's standalone output tracing ships. Trade-off: bigger image,
# but reliable, because the entrypoint below shells out to the `prisma`
# CLI (+ its query-engine binaries from @prisma/engines) to run
# `prisma db push`, and nothing in the server bundle imports the CLI
# directly, so Next's dependency tracer never picks it up. Copying the
# real prod-deps node_modules guarantees the CLI, the query engine, and
# the generated client are all present and version-matched.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Prisma schema + config. schema.prisma has no `url` in its datasource
# block (Prisma 7 style) — the DATABASE_URL is wired up by
# prisma.config.ts at runtime, so both files must ship together.
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts

COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER node
EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
