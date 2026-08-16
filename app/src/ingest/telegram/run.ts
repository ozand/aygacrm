#!/usr/bin/env node
/**
 * Telegram reference ingestion adapter (issue #27) — the first EPIC-0004
 * source.
 *
 * Architecture: this is an EXTERNAL AGENT, not a native AygaCRM connector.
 * AygaCRM defines ingestion *contracts*, not source connectors — see
 * docs/integrations/roadmap.md and docs/integrations/ingestion-conventions.md.
 * This script:
 *   1. authenticates to Telegram itself (bot token, long-polling getUpdates),
 *   2. maps each text message to the ingest contract (./map.ts, pure),
 *   3. pushes it into AygaCRM over HTTP via POST /api/v1/ingest, using an
 *      AygaCRM API token — the same Bearer-auth HTTP boundary the CLI uses.
 *
 * It deliberately imports NOTHING from AygaCRM's server internals (no
 * @/lib/db, no @prisma/client, no server actions) — only the CLI's plain
 * fetch wrapper (src/cli/lib/client.ts), which talks to AygaCRM purely over
 * HTTP. Idempotency and contact resolution are AygaCRM's problem (issues
 * #25/#26); this adapter's only job is collecting from Telegram and posting.
 *
 * Run via `pnpm ingest:telegram` (tsx). Requires TELEGRAM_BOT_TOKEN and
 * AYGACRM_API_TOKEN; see docs/integrations/telegram.md.
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { apiRequest, ApiClientError } from "../../cli/lib/client";
import { telegramUpdateToIngest, type IngestRequestBody } from "./map";
import { getUpdates } from "./telegram-api";
import { DEFAULT_OFFSET_PATH, readOffset, writeOffset } from "./offset-store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standalone process (not the Next.js app): load .env explicitly, matching
// src/cli/aygacrm.ts. This file lives at src/ingest/telegram/run.ts, three
// levels below app/.
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env"), quiet: true });

const POLL_TIMEOUT_SECONDS = 30;
const POLL_ERROR_BACKOFF_MS = 5000;
const DEFAULT_RETRY_AFTER_MS = 1000;

interface RunnerConfig {
  botToken: string;
  apiToken: string;
  apiUrl: string;
  offsetPath: string;
}

function loadConfig(): RunnerConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const apiToken = process.env.AYGACRM_API_TOKEN;

  if (!botToken) {
    console.error("Missing TELEGRAM_BOT_TOKEN environment variable. See docs/integrations/telegram.md.");
    process.exit(1);
  }
  if (!apiToken) {
    console.error("Missing AYGACRM_API_TOKEN environment variable. See docs/integrations/telegram.md.");
    process.exit(1);
  }

  return {
    botToken,
    apiToken,
    apiUrl: process.env.AYGACRM_API_URL ?? "http://localhost:4000",
    offsetPath: DEFAULT_OFFSET_PATH,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface IngestResponseBody {
  contact_id?: string;
  record_id?: string;
  contact_created?: boolean;
  record_created?: boolean;
}

/**
 * Posts one mapped update to /ingest. Returns true only if AygaCRM accepted it
 * (so the caller may safely ACK it to Telegram by advancing the offset), false
 * on any failure. A false MUST NOT advance the offset — otherwise Telegram
 * drops the update server-side and the message is lost forever. Re-posting an
 * already-succeeded item on the next poll is harmless: #25/#26 idempotency
 * dedups it.
 */
async function ingestOne(config: RunnerConfig, body: IngestRequestBody): Promise<boolean> {
  const label = `${body.handle} msg ${body.metadata.messageId}`;

  try {
    const result = await apiRequest("POST", "/ingest", {
      token: config.apiToken,
      url: config.apiUrl,
      body,
    });
    const json = result.json as IngestResponseBody | null;
    const action = json?.contact_created ? "created" : "updated";
    console.log(`ingested ${label} -> contact ${json?.contact_id ?? "?"} (${action})`);
    return true;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 429) {
      const retryAfterSeconds = Number(error.retryAfter);
      const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : DEFAULT_RETRY_AFTER_MS;
      console.error(`Rate limited ingesting ${label}; waiting ${waitMs}ms and retrying once.`);
      await sleep(waitMs);
      try {
        const retryResult = await apiRequest("POST", "/ingest", {
          token: config.apiToken,
          url: config.apiUrl,
          body,
        });
        const json = retryResult.json as IngestResponseBody | null;
        const action = json?.contact_created ? "created" : "updated";
        console.log(`ingested ${label} -> contact ${json?.contact_id ?? "?"} (${action}) [after retry]`);
        return true;
      } catch (retryError) {
        console.error(`Failed to ingest ${label} after retry: ${describeError(retryError)}`);
        return false;
      }
    }

    console.error(`Failed to ingest ${label}: ${describeError(error)}`);
    return false;
  }
}

export interface BatchResult {
  /** Offset to persist: one past the last update that was successfully handled (ingested or skipped). */
  offset: number;
  /** True if the batch stopped early because an ingest failed — the caller should back off and NOT advance further. */
  stoppedOnFailure: boolean;
}

/**
 * Advances the offset through a batch in order, ACKing an update only after it
 * is successfully handled. A skipped (unmappable) update is ACKed — there's
 * nothing to deliver. The FIRST failed ingest stops the batch WITHOUT advancing
 * past it, so the next poll re-fetches from exactly that update. This trades a
 * possible head-of-line stall on a genuinely poison message for a guarantee of
 * no silent message loss (at-least-once, idempotency dedups re-posts).
 */
export async function processBatch(
  updates: { update_id: number }[],
  ingest: (update: { update_id: number }) => Promise<boolean>,
  startOffset: number
): Promise<BatchResult> {
  let offset = startOffset;
  for (const update of updates) {
    const ok = await ingest(update);
    if (!ok) {
      return { offset, stoppedOnFailure: true };
    }
    offset = update.update_id + 1;
  }
  return { offset, stoppedOnFailure: false };
}

function describeError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

let shuttingDown = false;
const shutdownController = new AbortController();

function requestShutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  shutdownController.abort();
}

async function runLoop(config: RunnerConfig): Promise<void> {
  let offset = await readOffset(config.offsetPath);
  console.log(`Telegram ingestion adapter starting at offset ${offset}. Posting to ${config.apiUrl}/api/v1/ingest.`);

  while (!shuttingDown) {
    let updates;
    try {
      updates = await getUpdates(config.botToken, {
        offset,
        timeout: POLL_TIMEOUT_SECONDS,
        signal: shutdownController.signal,
      });
    } catch (error) {
      if (shuttingDown) break;
      console.error(`Failed to poll Telegram getUpdates: ${describeError(error)}`);
      await sleep(POLL_ERROR_BACKOFF_MS);
      continue;
    }

    const before = offset;
    const result = await processBatch(
      updates,
      async (update) => {
        const mapped = telegramUpdateToIngest(update);
        // Unmappable (no text / no sender) — nothing to deliver, so ACK it
        // (advance past it) rather than re-fetching it forever.
        if (!mapped) return true;
        return ingestOne(config, mapped);
      },
      offset
    );
    offset = result.offset;

    // Persist only when we actually advanced (some update handled).
    if (offset !== before) {
      await writeOffset(offset, config.offsetPath);
    }

    // A failed ingest left the offset parked on the bad update; back off before
    // re-polling so a persistent failure doesn't hammer Telegram + the API.
    if (result.stoppedOnFailure) {
      await sleep(POLL_ERROR_BACKOFF_MS);
    }
  }

  await writeOffset(offset, config.offsetPath);
  console.log("Telegram ingestion adapter stopped; offset persisted.");
}

function main(): void {
  const config = loadConfig();

  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, shutting down...");
    requestShutdown();
  });
  process.on("SIGTERM", () => {
    requestShutdown();
  });

  runLoop(config)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(describeError(error));
      process.exit(1);
    });
}

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
  main();
}
