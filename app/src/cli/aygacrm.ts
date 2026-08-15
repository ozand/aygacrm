#!/usr/bin/env node
// AygaCRM CLI — REST API v1 client (issue #22).
//
// Noun-verb interface over the API described in docs/api/openapi.json:
//   aygacrm <resource> <verb> [args] [flags]
//
// This is a *separate* entry point from src/cli/aygacrm-cli.ts, which remains
// the legacy direct-DB local-mode CLI and is not touched here. This CLI only
// ever talks to the API over HTTP (Bearer token auth), never to the database
// directly.
//
// Run via `pnpm cli <args>` (tsx) or `pnpm exec tsx src/cli/aygacrm.ts <args>`.
// NOTE: do NOT insert a `--` separator (`pnpm cli -- <args>`). On pnpm 10 the
// literal `--` is forwarded to tsx as an argv element, and commander then reads
// it as its own end-of-options marker, so every following flag is misparsed
// (e.g. `pnpm cli -- --help` fails with "unknown command '--help'").

import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "commander";
import {
  ApiClientError,
  apiRequest,
  statusToExitCode,
  stripApiPrefix,
  type ApiRequestOptions,
} from "./lib/client";
import { formatNdjsonLine, formatOutput, type OutputFormat } from "./lib/format";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standalone process (not the Next.js app): load .env explicitly so
// AYGACRM_API_TOKEN / AYGACRM_API_URL can live there like the legacy CLI.
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const OPENAPI_PATH = path.resolve(__dirname, "../../docs/api/openapi.json");

// ---------------------------------------------------------------------------
// Resource table
// ---------------------------------------------------------------------------

export type Verb = "list" | "get" | "create" | "update" | "delete";

export interface ResourceSchemaNames {
  /** Request body schema for POST. */
  create?: string;
  /** Request body schema for PUT. */
  update?: string;
  /** Single-item response envelope schema (GET by id, POST, PUT). */
  envelope: string;
  /** Paginated list response schema (GET list). */
  paginated?: string;
}

export interface ResourceDef {
  /** CLI noun and REST path segment, e.g. "contacts" -> /contacts. */
  name: string;
  /** Verbs this resource supports. */
  verbs: Verb[];
  /** Schema names in docs/api/openapi.json#/components/schemas. */
  schemas: ResourceSchemaNames;
  /** Short help text for `aygacrm <name> --help`. */
  description: string;
  /**
   * True only for the singleton "user" resource: its "get" verb has no <id>
   * argument and maps straight to GET /user.
   */
  singleton?: boolean;
}

// One entry per top-level resource in docs/api/openapi.json (11 total,
// matching the OpenAPI `tags`). Covered by src/lib/__tests__/cli-coverage.test.ts.
export const RESOURCES: ResourceDef[] = [
  {
    name: "contacts",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "ContactCreate",
      update: "ContactUpdate",
      envelope: "ContactEnvelope",
      paginated: "ContactPaginated",
    },
    description: "Contacts",
  },
  {
    name: "activities",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "ActivityCreate",
      update: "ActivityUpdate",
      envelope: "ActivityEnvelope",
      paginated: "ActivityPaginated",
    },
    description: "Activities",
  },
  {
    name: "calls",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "CallCreate",
      update: "CallUpdate",
      envelope: "CallEnvelope",
      paginated: "CallPaginated",
    },
    description: "Calls",
  },
  {
    name: "gifts",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "GiftCreate",
      update: "GiftUpdate",
      envelope: "GiftEnvelope",
      paginated: "GiftPaginated",
    },
    description: "Gifts",
  },
  {
    name: "notes",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "NoteCreate",
      update: "NoteUpdate",
      envelope: "NoteEnvelope",
      paginated: "NotePaginated",
    },
    description: "Notes",
  },
  {
    name: "reminders",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "ReminderCreate",
      update: "ReminderUpdate",
      envelope: "ReminderEnvelope",
      paginated: "ReminderPaginated",
    },
    description: "Reminders",
  },
  {
    name: "tags",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "TagCreate",
      update: "TagUpdate",
      envelope: "TagEnvelope",
      paginated: "TagPaginated",
    },
    description: "Tags",
  },
  {
    name: "tasks",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "TaskCreate",
      update: "TaskUpdate",
      envelope: "TaskEnvelope",
      paginated: "TaskPaginated",
    },
    description: "Tasks",
  },
  {
    name: "records",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "ExternalRecordCreate",
      update: "ExternalRecordUpdate",
      envelope: "ExternalRecordEnvelope",
      paginated: "ExternalRecordPaginated",
    },
    description: "External records (email, telegram, linkedin, etc. — synced items attached to a contact)",
  },
  {
    name: "journals",
    verbs: ["list", "get", "create", "update", "delete"],
    schemas: {
      create: "JournalCreate",
      update: "JournalUpdate",
      envelope: "JournalEnvelope",
      paginated: "JournalPaginated",
    },
    description:
      "Journals. Note: nested /journals/:id/entries endpoints are omitted from this CLI in v1 — use the REST API directly for journal entries.",
  },
  {
    name: "user",
    verbs: ["get"],
    schemas: {
      envelope: "UserEnvelope",
    },
    description: "The user that owns the API token (read-only; no create/update/delete)",
    singleton: true,
  },
];

// ---------------------------------------------------------------------------
// Global option resolution
// ---------------------------------------------------------------------------

interface Globals {
  token?: string;
  url: string;
  format: OutputFormat;
}

function resolveGlobals(cmd: Command): Globals {
  const opts = cmd.optsWithGlobals<{ token?: string; url?: string; format?: string }>();

  const token = opts.token ?? process.env.AYGACRM_API_TOKEN;
  const url = opts.url ?? process.env.AYGACRM_API_URL ?? "http://localhost:4000";
  const format = opts.format ?? "json";

  if (format !== "json" && format !== "table") {
    console.error(`Invalid --format value: "${format}". Expected "json" or "table".`);
    process.exit(3);
  }

  return { token, url, format };
}

function requestOptions(globals: Globals, extra: Partial<ApiRequestOptions> = {}): ApiRequestOptions {
  return { token: globals.token, url: globals.url, ...extra };
}

function requireToken(globals: Globals): asserts globals is Globals & { token: string } {
  if (!globals.token) {
    console.error(
      "Missing API token. Provide --token <token> or set the AYGACRM_API_TOKEN environment variable."
    );
    process.exit(2);
  }
}

function buildFullUrl(globals: Globals, apiPath: string): string {
  return `${globals.url.replace(/\/+$/, "")}/api/v1${apiPath}`;
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function handleError(error: unknown): never {
  if (error instanceof ApiClientError) {
    if (error.status === 429) {
      console.error(
        `Rate limited (429): ${error.message}. Retry after ${error.retryAfter ?? "unknown"} seconds.`
      );
    } else {
      console.error(error.message);
    }
    process.exit(statusToExitCode(error.status));
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(5);
}

function withErrorHandling<Args extends unknown[]>(
  fn: (...args: Args) => Promise<void>
): (...args: Args) => Promise<void> {
  return async (...args: Args) => {
    try {
      await fn(...args);
    } catch (error) {
      handleError(error);
    }
  };
}

// ---------------------------------------------------------------------------
// --data parsing
// ---------------------------------------------------------------------------

function parseDataFlag(raw: string | undefined): unknown {
  if (raw === undefined) {
    console.error("Missing required --data '<json>' flag.");
    process.exit(3);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Invalid JSON in --data: ${message}`);
    process.exit(3);
  }
}

// ---------------------------------------------------------------------------
// Confirmation prompt (delete)
// ---------------------------------------------------------------------------

async function confirm(promptText: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(promptText);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// schema command
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonObject = Record<string, any>;

function loadOpenApiDocument(): JsonObject {
  const raw = readFileSync(OPENAPI_PATH, "utf-8");
  return JSON.parse(raw);
}

/** Resolves a single #/components/schemas/<Name> reference, one level deep. */
function resolveSchemaByName(doc: JsonObject, name: string | undefined): unknown {
  if (!name) return null;
  return doc.components?.schemas?.[name] ?? null;
}

function schemaForVerb(
  doc: JsonObject,
  resource: ResourceDef,
  verb: Verb
): { request: unknown; response: unknown } | null {
  switch (verb) {
    case "list":
      return { request: null, response: resolveSchemaByName(doc, resource.schemas.paginated) };
    case "get":
      return { request: null, response: resolveSchemaByName(doc, resource.schemas.envelope) };
    case "create":
      return {
        request: resolveSchemaByName(doc, resource.schemas.create),
        response: resolveSchemaByName(doc, resource.schemas.envelope),
      };
    case "update":
      return {
        request: resolveSchemaByName(doc, resource.schemas.update),
        response: resolveSchemaByName(doc, resource.schemas.envelope),
      };
    case "delete":
      return { request: null, response: resolveSchemaByName(doc, "DeleteResult") };
    default:
      return null;
  }
}

function runSchemaCommand(resourceName: string, verbArg: string | undefined): void {
  const resource = RESOURCES.find((r) => r.name === resourceName);
  if (!resource) {
    console.error(
      `Unknown resource: "${resourceName}". Valid resources: ${RESOURCES.map((r) => r.name).join(", ")}`
    );
    process.exit(3);
  }

  const doc = loadOpenApiDocument();

  if (verbArg) {
    const verb = verbArg as Verb;
    if (!resource.verbs.includes(verb)) {
      console.error(
        `Verb "${verbArg}" is not supported for resource "${resourceName}". Supported verbs: ${resource.verbs.join(", ")}`
      );
      process.exit(3);
    }
    console.log(JSON.stringify({ resource: resource.name, verb, ...schemaForVerb(doc, resource, verb) }, null, 2));
    return;
  }

  const verbs: Record<string, unknown> = {};
  for (const verb of resource.verbs) {
    verbs[verb] = schemaForVerb(doc, resource, verb);
  }
  console.log(JSON.stringify({ resource: resource.name, verbs }, null, 2));
}

// ---------------------------------------------------------------------------
// Program construction
// ---------------------------------------------------------------------------

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("aygacrm")
    .description(
      "AygaCRM REST API v1 CLI client. Talks to AYGACRM_API_URL/api/v1 over Bearer auth.\n" +
        "See `aygacrm <resource> --help` for verbs, and `aygacrm schema <resource>` for request/response shapes."
    )
    .option("--token <token>", "API bearer token (else env AYGACRM_API_TOKEN)")
    .option("--url <url>", "API base URL (else env AYGACRM_API_URL, default http://localhost:4000)")
    .option("--format <format>", "output format: json|table", "json");

  for (const resource of RESOURCES) {
    registerResourceCommands(program, resource);
  }

  registerSchemaCommand(program);
  registerAuthCommand(program);

  return program;
}

function registerResourceCommands(program: Command, resource: ResourceDef): void {
  const resourceCmd = program.command(resource.name).description(resource.description);

  if (resource.verbs.includes("list")) {
    resourceCmd
      .command("list")
      .description(`List ${resource.name} (GET /${resource.name})`)
      .option("--page <n>", "page number")
      .option("--limit <n>", "items per page")
      .option("--sort <field>", "field to sort by; prefix with - for descending")
      .option("--page-all", "follow pagination via links.next, emitting NDJSON (one JSON object per line)")
      .action(
        withErrorHandling(async (_opts, cmd: Command) => {
          await runList(resource, cmd);
        })
      );
  }

  if (resource.verbs.includes("get")) {
    if (resource.singleton) {
      resourceCmd
        .command("get")
        .description(`Get the current ${resource.name} (GET /${resource.name})`)
        .action(
          withErrorHandling(async (_opts, cmd: Command) => {
            await runGet(resource, undefined, cmd);
          })
        );
    } else {
      resourceCmd
        .command("get <id>")
        .description(`Get a single ${singular(resource.name)} by id (GET /${resource.name}/<id>)`)
        .action(
          withErrorHandling(async (id: string, _opts, cmd: Command) => {
            await runGet(resource, id, cmd);
          })
        );
    }
  }

  if (resource.verbs.includes("create")) {
    resourceCmd
      .command("create")
      .description(`Create a ${singular(resource.name)} (POST /${resource.name})`)
      .requiredOption("--data <json>", "JSON request body")
      .option("--dry-run", "print the method, URL and body without sending the request")
      .option("--idempotency-key <key>", "Idempotency-Key header value")
      .action(
        withErrorHandling(async (opts, cmd: Command) => {
          await runCreate(resource, opts, cmd);
        })
      );
  }

  if (resource.verbs.includes("update")) {
    resourceCmd
      .command("update <id>")
      .description(`Update a ${singular(resource.name)} by id (PUT /${resource.name}/<id>)`)
      .requiredOption("--data <json>", "JSON request body")
      .option("--dry-run", "print the method, URL and body without sending the request")
      .option("--idempotency-key <key>", "Idempotency-Key header value")
      .action(
        withErrorHandling(async (id: string, opts, cmd: Command) => {
          await runUpdate(resource, id, opts, cmd);
        })
      );
  }

  if (resource.verbs.includes("delete")) {
    resourceCmd
      .command("delete <id>")
      .description(`Delete a ${singular(resource.name)} by id (DELETE /${resource.name}/<id>)`)
      .option("--yes", "skip the confirmation prompt")
      .option("--dry-run", "print the method and URL without sending the request")
      .option("--idempotency-key <key>", "Idempotency-Key header value")
      .action(
        withErrorHandling(async (id: string, opts, cmd: Command) => {
          await runDelete(resource, id, opts, cmd);
        })
      );
  }
}

function singular(name: string): string {
  // Good enough for this fixed resource list (contacts -> contact, activities
  // -> activity, tags -> tag, records -> record, etc).
  if (name.endsWith("ies")) return `${name.slice(0, -3)}y`;
  if (name.endsWith("s")) return name.slice(0, -1);
  return name;
}

// ---------------------------------------------------------------------------
// Verb implementations
// ---------------------------------------------------------------------------

async function runList(resource: ResourceDef, cmd: Command): Promise<void> {
  const globals = resolveGlobals(cmd);
  requireToken(globals);
  const opts = cmd.opts<{ page?: string; limit?: string; sort?: string; pageAll?: boolean }>();

  const query = new URLSearchParams();
  if (opts.page !== undefined) query.set("page", opts.page);
  if (opts.limit !== undefined) query.set("limit", opts.limit);
  if (opts.sort !== undefined) query.set("sort", opts.sort);

  const qs = query.toString();
  const initialPath = `/${resource.name}${qs ? `?${qs}` : ""}`;

  if (opts.pageAll) {
    // Safety guard against a malformed/malicious `links.next` looping forever:
    // cap the number of pages fetched and bail if the same next-path is seen
    // twice in a row (a cycle).
    const MAX_PAGES = 10000;
    const visited = new Set<string>();
    let nextPath: string | null = initialPath;
    let pageCount = 0;
    while (nextPath) {
      if (visited.has(nextPath)) {
        console.error(`Warning: pagination loop detected (repeated links.next "${nextPath}"); stopping.`);
        break;
      }
      if (pageCount >= MAX_PAGES) {
        console.error(`Warning: reached the maximum of ${MAX_PAGES} pages; stopping.`);
        break;
      }
      visited.add(nextPath);
      pageCount += 1;

      const result = await apiRequest("GET", nextPath, requestOptions(globals));
      const body = result.json as { data?: unknown[]; links?: { next?: string | null } } | null;
      const items = Array.isArray(body?.data) ? (body!.data as unknown[]) : [];
      for (const item of items) {
        console.log(formatNdjsonLine(item));
      }
      nextPath = body?.links?.next ? stripApiPrefix(body.links.next) : null;
    }
    return;
  }

  const result = await apiRequest("GET", initialPath, requestOptions(globals));
  console.log(formatOutput(result.json, globals.format));
}

async function runGet(resource: ResourceDef, id: string | undefined, cmd: Command): Promise<void> {
  const globals = resolveGlobals(cmd);
  requireToken(globals);
  const apiPath = resource.singleton ? `/${resource.name}` : `/${resource.name}/${encodeURIComponent(id!)}`;
  const result = await apiRequest("GET", apiPath, requestOptions(globals));
  console.log(formatOutput(result.json, globals.format));
}

async function runCreate(
  resource: ResourceDef,
  opts: { data?: string; dryRun?: boolean; idempotencyKey?: string },
  cmd: Command
): Promise<void> {
  const globals = resolveGlobals(cmd);
  const body = parseDataFlag(opts.data);
  const apiPath = `/${resource.name}`;

  if (opts.dryRun) {
    printDryRun("POST", buildFullUrl(globals, apiPath), body, opts.idempotencyKey);
    process.exit(0);
  }

  requireToken(globals);
  const result = await apiRequest(
    "POST",
    apiPath,
    requestOptions(globals, { body, idempotencyKey: opts.idempotencyKey })
  );
  console.log(formatOutput(result.json, globals.format));
}

async function runUpdate(
  resource: ResourceDef,
  id: string,
  opts: { data?: string; dryRun?: boolean; idempotencyKey?: string },
  cmd: Command
): Promise<void> {
  const globals = resolveGlobals(cmd);
  const body = parseDataFlag(opts.data);
  const apiPath = `/${resource.name}/${encodeURIComponent(id)}`;

  if (opts.dryRun) {
    printDryRun("PUT", buildFullUrl(globals, apiPath), body, opts.idempotencyKey);
    process.exit(0);
  }

  requireToken(globals);
  const result = await apiRequest(
    "PUT",
    apiPath,
    requestOptions(globals, { body, idempotencyKey: opts.idempotencyKey })
  );
  console.log(formatOutput(result.json, globals.format));
}

async function runDelete(
  resource: ResourceDef,
  id: string,
  opts: { yes?: boolean; dryRun?: boolean; idempotencyKey?: string },
  cmd: Command
): Promise<void> {
  const globals = resolveGlobals(cmd);
  const apiPath = `/${resource.name}/${encodeURIComponent(id)}`;

  if (opts.dryRun) {
    printDryRun("DELETE", buildFullUrl(globals, apiPath), undefined, opts.idempotencyKey);
    process.exit(0);
  }

  if (!opts.yes) {
    const ok = await confirm(`Delete ${singular(resource.name)} ${id}? [y/N] `);
    if (!ok) {
      console.error("Aborted.");
      process.exit(0);
    }
  }

  requireToken(globals);
  const result = await apiRequest(
    "DELETE",
    apiPath,
    requestOptions(globals, { idempotencyKey: opts.idempotencyKey })
  );
  console.log(formatOutput(result.json, globals.format));
}

function printDryRun(method: string, url: string, body: unknown, idempotencyKey: string | undefined): void {
  // Dry-run output is human/status text describing a request that was never
  // sent — not machine JSON data — so it belongs on stderr, keeping stdout
  // JSON-only for piped consumers.
  console.error("DRY RUN — no request was sent.");
  console.error(`Method: ${method}`);
  console.error(`URL: ${url}`);
  if (idempotencyKey) {
    console.error(`Idempotency-Key: ${idempotencyKey}`);
  }
  if (body !== undefined) {
    console.error("Body:");
    console.error(JSON.stringify(body, null, 2));
  }
}

// ---------------------------------------------------------------------------
// schema / auth commands
// ---------------------------------------------------------------------------

function registerSchemaCommand(program: Command): void {
  program
    .command("schema")
    .argument("<resource>", `resource name (${RESOURCES.map((r) => r.name).join(", ")})`)
    .argument("[verb]", "list|get|create|update|delete — omit to print all supported verbs")
    .description(
      "Print the request/response schema for a resource endpoint, read from docs/api/openapi.json. " +
        "Resolves $ref one level deep. Makes no network call."
    )
    .action((resourceName: string, verb: string | undefined) => {
      runSchemaCommand(resourceName, verb);
    });
}

function registerAuthCommand(program: Command): void {
  const authCmd = program.command("auth").description("Authentication utilities");

  authCmd
    .command("whoami")
    .description("Fetch the authenticated user via GET /user — a quick token check")
    .action(
      withErrorHandling(async (_opts, cmd: Command) => {
        const globals = resolveGlobals(cmd);
        requireToken(globals);
        const result = await apiRequest("GET", "/user", requestOptions(globals));
        console.log(formatOutput(result.json, globals.format));
      })
    );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const program = buildProgram();
  program.parseAsync(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(5);
  });
}
