import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RESOURCES } from "@/cli/aygacrm";
import { formatOutput, formatNdjsonLine } from "@/cli/lib/format";
import { statusToExitCode, NETWORK_ERROR_STATUS } from "@/cli/lib/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPENAPI_PATH = path.resolve(__dirname, "../../../docs/api/openapi.json");

interface OpenApiDoc {
  tags: { name: string }[];
}

function loadOpenApi(): OpenApiDoc {
  return JSON.parse(readFileSync(OPENAPI_PATH, "utf-8"));
}

describe("CLI resource coverage against docs/api/openapi.json", () => {
  it("has a CLI resource command for every top-level API resource", () => {
    const doc = loadOpenApi();
    const apiResourceNames = doc.tags.map((tag) => tag.name.toLowerCase());
    const cliResourceNames = new Set(RESOURCES.map((r) => r.name));

    const missing = apiResourceNames.filter((name) => !cliResourceNames.has(name));

    expect(missing, `API resources with no CLI command: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not define CLI resources that don't exist in the API", () => {
    const doc = loadOpenApi();
    const apiResourceNames = new Set(doc.tags.map((tag) => tag.name.toLowerCase()));

    const extra = RESOURCES.map((r) => r.name).filter((name) => !apiResourceNames.has(name));

    expect(extra, `CLI resources with no matching API tag: ${extra.join(", ")}`).toEqual([]);
  });

  it("every resource declares an envelope schema, and list-capable resources declare a paginated schema", () => {
    for (const resource of RESOURCES) {
      expect(resource.schemas.envelope, `${resource.name} is missing an envelope schema`).toBeTruthy();
      if (resource.verbs.includes("list")) {
        expect(
          resource.schemas.paginated,
          `${resource.name} supports list but has no paginated schema`
        ).toBeTruthy();
      }
      if (resource.verbs.includes("create")) {
        expect(resource.schemas.create, `${resource.name} supports create but has no create schema`).toBeTruthy();
      }
      if (resource.verbs.includes("update")) {
        expect(resource.schemas.update, `${resource.name} supports update but has no update schema`).toBeTruthy();
      }
    }
  });

  it("only the user resource is read-only (get only)", () => {
    const readOnly = RESOURCES.filter((r) => r.verbs.length === 1 && r.verbs[0] === "get");
    expect(readOnly.map((r) => r.name)).toEqual(["user"]);
  });
});

describe("formatOutput", () => {
  it("formats json as pretty-printed JSON", () => {
    const data = { data: { id: "1", name: "Ada" } };
    const output = formatOutput(data, "json");
    expect(output).toBe(JSON.stringify(data, null, 2));
    expect(JSON.parse(output)).toEqual(data);
  });

  it("formats a paginated list response as an aligned table using the data array", () => {
    const data = {
      data: [
        { id: "1", first_name: "Ada", last_name: "Lovelace" },
        { id: "2", first_name: "Grace", last_name: "Hopper" },
      ],
      links: { first: "/contacts?page=1", last: "/contacts?page=1", prev: null, next: null },
      meta: { current_page: 1, total: 2 },
    };
    const output = formatOutput(data, "table");
    const lines = output.split("\n");

    expect(lines[0]).toContain("id");
    expect(lines[0]).toContain("first_name");
    expect(lines[0]).toContain("last_name");
    expect(lines[1]).toMatch(/^-+(\s\s-+)*$/);
    expect(output).toContain("Ada");
    expect(output).toContain("Hopper");
  });

  it("formats a single-object envelope as a one-row table", () => {
    const data = { data: { id: "1", email: "a@example.com" } };
    const output = formatOutput(data, "table");
    expect(output).toContain("id");
    expect(output).toContain("email");
    expect(output).toContain("a@example.com");
  });

  it("flattens nested objects/arrays to one level as compact JSON", () => {
    const data = { data: [{ id: "1", account: { id: "acc-1" }, tags: ["a", "b"] }] };
    const output = formatOutput(data, "table");
    expect(output).toContain(JSON.stringify({ id: "acc-1" }));
    expect(output).toContain(JSON.stringify(["a", "b"]));
  });

  it("reports no results for an empty list", () => {
    const output = formatOutput({ data: [] }, "table");
    expect(output).toBe("No results.");
  });

  it("formats a single NDJSON line per item", () => {
    const line = formatNdjsonLine({ id: "1", name: "Ada" });
    expect(line).toBe(JSON.stringify({ id: "1", name: "Ada" }));
    expect(line.includes("\n")).toBe(false);
  });
});

describe("statusToExitCode", () => {
  it("maps success statuses to 0", () => {
    expect(statusToExitCode(200)).toBe(0);
    expect(statusToExitCode(201)).toBe(0);
  });

  it("maps 401 and 403 to the auth exit code (2)", () => {
    expect(statusToExitCode(401)).toBe(2);
    expect(statusToExitCode(403)).toBe(2);
  });

  it("maps 400 and 422 to the validation exit code (3)", () => {
    expect(statusToExitCode(400)).toBe(3);
    expect(statusToExitCode(422)).toBe(3);
  });

  it("maps 404 to the not-found exit code (4)", () => {
    expect(statusToExitCode(404)).toBe(4);
  });

  it("maps 429, 5xx, and network failures to the API/server error exit code (5)", () => {
    expect(statusToExitCode(429)).toBe(5);
    expect(statusToExitCode(500)).toBe(5);
    expect(statusToExitCode(503)).toBe(5);
    expect(statusToExitCode(NETWORK_ERROR_STATUS)).toBe(5);
  });
});
