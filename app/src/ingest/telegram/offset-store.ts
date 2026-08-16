/**
 * Persists the last processed Telegram `update_id + 1` ("offset") to a small
 * JSON file so a restart of the adapter doesn't reprocess updates it already
 * handled. This is a convenience, not a correctness requirement: writes to
 * AygaCRM go through `POST /api/v1/ingest`, which is idempotent per
 * (source, external_id) (issues #25/#26) — a lost or stale offset file only
 * costs some redundant re-POSTs, never duplicate data.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Default location: `app/.telegram-offset.json` (gitignored). */
export const DEFAULT_OFFSET_PATH = path.resolve(process.cwd(), ".telegram-offset.json");

interface OffsetFile {
  offset: number;
}

/**
 * Reads the persisted offset. Defaults to `0` (start from the beginning of
 * Telegram's update backlog) if the file is missing, unreadable, or holds a
 * malformed value.
 */
export async function readOffset(filePath: string = DEFAULT_OFFSET_PATH): Promise<number> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<OffsetFile>;
    return typeof parsed.offset === "number" && Number.isFinite(parsed.offset) ? parsed.offset : 0;
  } catch {
    return 0;
  }
}

/** Persists `offset` to disk, overwriting any previous value. */
export async function writeOffset(offset: number, filePath: string = DEFAULT_OFFSET_PATH): Promise<void> {
  const payload: OffsetFile = { offset };
  await writeFile(filePath, JSON.stringify(payload), "utf-8");
}
