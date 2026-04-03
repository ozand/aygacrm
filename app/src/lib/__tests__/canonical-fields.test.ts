import { vi } from "vitest";

// Mock "use server" - must be before importing the module
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {},
}));

import { describe, expect, it } from "vitest";
import { selectCanonicalValue } from "@/lib/actions/canonical-fields";

type ProvenanceRecord = {
  field: string;
  value: string | null;
  source: string;
  confidence: number;
  createdAt: Date;
  isActive: boolean;
};

function makeRecord(overrides: Partial<ProvenanceRecord>): ProvenanceRecord {
  return {
    field: "firstName",
    value: "Alice",
    source: "other",
    confidence: Number.NaN,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    isActive: true,
    ...overrides,
  };
}

describe("selectCanonicalValue", () => {
  it("returns null for an empty array", async () => {
    await expect(selectCanonicalValue([])).resolves.toBeNull();
  });

  it("returns a single manual record with manual reason", async () => {
    const record = makeRecord({
      value: "Manual Name",
      source: "manual",
      confidence: Number.NaN,
    });

    await expect(selectCanonicalValue([record])).resolves.toEqual({
      value: "Manual Name",
      source: "manual",
      confidence: 1,
      reason: "Manual edit by user",
    });
  });

  it("prioritizes manual over higher-confidence linkedin", async () => {
    const manual = makeRecord({
      value: "From Manual",
      source: "manual",
      confidence: 0.2,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const linkedin = makeRecord({
      value: "From LinkedIn",
      source: "linkedin",
      confidence: 0.95,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    await expect(selectCanonicalValue([linkedin, manual])).resolves.toEqual({
      value: "From Manual",
      source: "manual",
      confidence: 0.2,
      reason: "Manual edit by user",
    });
  });

  it("chooses highest confidence among non-manual records", async () => {
    const linkedin = makeRecord({
      value: "LinkedIn Value",
      source: "linkedin",
      confidence: Number.NaN,
    });
    const email = makeRecord({
      value: "Email Value",
      source: "email",
      confidence: Number.NaN,
    });

    await expect(selectCanonicalValue([email, linkedin])).resolves.toEqual({
      value: "LinkedIn Value",
      source: "linkedin",
      confidence: 0.8,
      reason: "Highest confidence from linkedin",
    });
  });

  it("breaks ties by recency when confidence is the same", async () => {
    const older = makeRecord({
      value: "Old Email",
      source: "email",
      confidence: 0.7,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newer = makeRecord({
      value: "New Email",
      source: "email",
      confidence: 0.7,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    await expect(selectCanonicalValue([older, newer])).resolves.toEqual({
      value: "New Email",
      source: "email",
      confidence: 0.7,
      reason: "Most recent from email",
    });
  });

  it("chooses most recent when multiple sources share top confidence", async () => {
    const telegram = makeRecord({
      value: "Telegram Value",
      source: "telegram",
      confidence: Number.NaN,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const whatsapp = makeRecord({
      value: "WhatsApp Value",
      source: "whatsapp",
      confidence: Number.NaN,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    await expect(selectCanonicalValue([telegram, whatsapp])).resolves.toEqual({
      value: "WhatsApp Value",
      source: "whatsapp",
      confidence: 0.6,
      reason: "Most recent from whatsapp",
    });
  });

  it("uses explicit confidence over source priority", async () => {
    const email = makeRecord({
      value: "High Confidence Email",
      source: "email",
      confidence: 0.95,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const linkedin = makeRecord({
      value: "Default LinkedIn",
      source: "linkedin",
      confidence: Number.NaN,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    await expect(selectCanonicalValue([linkedin, email])).resolves.toEqual({
      value: "High Confidence Email",
      source: "email",
      confidence: 0.95,
      reason: "Highest confidence from email",
    });
  });

  it("falls back to SOURCE_PRIORITY.other for unknown source", async () => {
    const unknown = makeRecord({
      value: "Mystery Source",
      source: "unknown-source",
      confidence: Number.NaN,
    });

    await expect(selectCanonicalValue([unknown])).resolves.toEqual({
      value: "Mystery Source",
      source: "unknown-source",
      confidence: 0.3,
      reason: "Highest confidence from unknown-source",
    });
  });
});
