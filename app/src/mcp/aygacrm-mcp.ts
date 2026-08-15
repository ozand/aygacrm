#!/usr/bin/env node
// Stdio entry point for the AygaCRM MCP server. Run with `pnpm mcp` (tsx),
// or via the `aygacrm-mcp` bin once the package is installed globally/linked.
// stdout is reserved for the MCP JSON-RPC channel — all logging goes to stderr.
//
// Standalone process: load DATABASE_URL / AYGACRM_API_TOKEN from .env since,
// unlike the Next.js app, this entry point does not auto-load env files.
// quiet: true — dotenv's banner would otherwise corrupt the stdout JSON-RPC channel.
import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { validateApiTokenValue } from "@/lib/api/auth";
import { createAygacrmMcpServer } from "@/lib/mcp/server";
import type { RequestMetadata } from "@/lib/mcp/tools";

async function main(): Promise<void> {
  const token = process.env.AYGACRM_API_TOKEN;
  if (!token) {
    console.error("AYGACRM_API_TOKEN is required");
    process.exit(1);
  }

  const auth = await validateApiTokenValue(token);
  if (!auth) {
    console.error("Invalid AYGACRM_API_TOKEN");
    process.exit(1);
  }

  const meta: RequestMetadata = {
    ipAddress: null,
    userAgent: "aygacrm-mcp/stdio",
  };

  const server = createAygacrmMcpServer(auth, meta);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("AygaCRM MCP server (stdio) connected.");
}

main().catch((error) => {
  console.error("AygaCRM MCP server failed to start:", error);
  process.exit(1);
});
