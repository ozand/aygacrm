# EPIC-0001: Core CRM Stabilization

## Summary

Stabilize the existing AygaCRM CRM codebase so it compiles, builds, and runs reliably in local development and CI. This epic establishes the technical baseline required before new product work can safely continue.

## Problem

The current codebase has accumulated schema/code drift, missing package and configuration assumptions, and server/client boundary issues that make the application fragile. The production build currently fails at runtime because database-dependent routes attempt to pre-render without `DATABASE_URL`. There is also no basic CI/CD gate to prevent regressions. Before adding new capabilities, AygaCRM needs a stable foundation that developers can run locally and that can be validated automatically.

## Outcome

A clean, repeatable development baseline:

- TypeScript compiles without errors
- Next.js builds successfully without runtime failures
- The dev server starts cleanly and core pages render end-to-end
- CI validates typecheck and lint on every change

## Scope

### In scope

- Fix build-time failures caused by database-dependent routes being statically rendered
- Mark DB-dependent routes as dynamically rendered where required so they do not require `DATABASE_URL` during build-time pre-rendering
- Update `next.config.ts` to match the current deployment/runtime requirements, including:
  - turbopack root configuration
  - `serverExternalPackages` for `pg`
- Add `.env.example` with the required environment variables for local development and CI
- Verify that `next dev` starts successfully with the documented environment setup
- Verify that the main dashboard and core CRM pages render in local development
- Add a basic CI workflow that runs `tsc --noEmit` and `lint`

### Out of scope

- New CRM features or UX enhancements
- Test coverage expansion beyond basic CI checks
- Performance tuning or load testing
- Deployment pipeline changes or production infrastructure work

## Related docs

- [Product Vision](../../product/vision.md)
- [Product Scope](../../product/scope.md)
- [Epic Template](../../templates/epic-template.md)

## Success criteria

- `tsc --noEmit` completes with 0 errors
- `next build` completes successfully without runtime errors or missing environment failures
- `next dev` starts cleanly and the dashboard loads in a browser
- Core pages that depend on the database do not fail the build by attempting to pre-render statically
- CI runs typecheck and lint on each pull request or push to the main branch

## Dependencies

- None. This is the foundation epic and should be completed before feature work begins.

## Risks / open questions

- Which specific routes should be explicitly dynamic versus refactored to avoid build-time database access entirely?
- Are there additional missing environment variables beyond `DATABASE_URL` that should be documented in `.env.example`?
- Does the current Next.js configuration require any additional server-only package exemptions beyond `pg`?
