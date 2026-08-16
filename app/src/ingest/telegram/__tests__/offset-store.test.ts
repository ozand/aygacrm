import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readOffset, writeOffset } from "@/ingest/telegram/offset-store";

// Uses a per-test temp directory (never the repo) so these tests don't leave
// or depend on state under app/.
let dir: string;
let filePath: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "telegram-offset-test-"));
  filePath = path.join(dir, "offset.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("offset-store", () => {
  it("returns 0 when the file does not exist", async () => {
    await expect(readOffset(filePath)).resolves.toBe(0);
  });

  it("round-trips a written offset", async () => {
    await writeOffset(42, filePath);
    await expect(readOffset(filePath)).resolves.toBe(42);
  });

  it("overwrites a previously written offset", async () => {
    await writeOffset(1, filePath);
    await writeOffset(99, filePath);
    await expect(readOffset(filePath)).resolves.toBe(99);
  });

  it("defaults to 0 for malformed JSON", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, "not json", "utf-8");
    await expect(readOffset(filePath)).resolves.toBe(0);
  });

  it("defaults to 0 when the offset field is missing or not a number", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, JSON.stringify({ offset: "not-a-number" }), "utf-8");
    await expect(readOffset(filePath)).resolves.toBe(0);

    await writeFile(filePath, JSON.stringify({}), "utf-8");
    await expect(readOffset(filePath)).resolves.toBe(0);
  });
});
