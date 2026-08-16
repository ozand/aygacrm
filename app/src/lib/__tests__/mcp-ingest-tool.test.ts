import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIngest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/api/audit-helpers", () => ({
  createAuditLogFromApi: vi.fn(),
}));

vi.mock("@/lib/external-record-upsert", () => ({
  upsertExternalRecord: vi.fn(),
}));

vi.mock("@/lib/ingest/ingest", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ingest/ingest")>("@/lib/ingest/ingest");
  return {
    ...actual,
    ingestExternalItem: mockIngest,
  };
});

import { ToolError } from "@/lib/mcp/tools";
import { toolDefinitions } from "@/lib/mcp/tools";
import { IngestValidationError } from "@/lib/ingest/ingest";

describe("aygacrm_ingest MCP tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is registered with the contacts:write ability", () => {
    const tool = toolDefinitions.aygacrm_ingest;
    expect(tool).toBeDefined();
    expect(tool.ability).toBe("contacts:write");
    expect(tool.parameters.required).toEqual(["source", "kind", "handle"]);
  });

  it("rejects an invalid source/kind combination via its own schema", () => {
    const tool = toolDefinitions.aygacrm_ingest;
    const result = tool.schema.safeParse({ source: "todoist", kind: "meeting", handle: "alice" });
    expect(result.success).toBe(false);
  });

  it("forwards camelCase args to ingestExternalItem, mapping username -> nickname", async () => {
    mockIngest.mockResolvedValue({
      contactId: "contact-1",
      recordId: "record-1",
      contactCreated: true,
      recordCreated: true,
    });

    const tool = toolDefinitions.aygacrm_ingest;
    const auth = { userId: "user-1", accountId: "account-1", tokenId: "token-1", abilities: ["contacts:write"] };
    const args = tool.schema.parse({
      source: "telegram",
      kind: "message",
      handle: "alice_handle",
      contactHints: { firstName: "Alice", username: "alice_handle" },
    });

    const result = await tool.execute(auth, args, { ipAddress: null, userAgent: "test" });

    expect(result).toEqual({
      contactId: "contact-1",
      recordId: "record-1",
      contactCreated: true,
      recordCreated: true,
    });

    expect(mockIngest).toHaveBeenCalledWith(
      { userId: "user-1" },
      expect.objectContaining({
        source: "telegram",
        kind: "message",
        handle: "alice_handle",
        contactHints: { firstName: "Alice", lastName: undefined, nickname: "alice_handle" },
      }),
      { setBy: "token-1" }
    );
  });

  it("converts an IngestValidationError into a ToolError", async () => {
    mockIngest.mockRejectedValue(new IngestValidationError("Invalid source/kind combination"));

    const tool = toolDefinitions.aygacrm_ingest;
    const auth = { userId: "user-1", accountId: "account-1", tokenId: "token-1", abilities: ["contacts:write"] };
    const args = tool.schema.parse({ source: "telegram", kind: "message", handle: "alice" });

    await expect(tool.execute(auth, args, { ipAddress: null, userAgent: "test" })).rejects.toThrow(ToolError);
  });
});
