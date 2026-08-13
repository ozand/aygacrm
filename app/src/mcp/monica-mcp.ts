#!/usr/bin/env node
// Stdio entry point for the Monica MCP server. Run with `pnpm mcp` (tsx),
// or via the `monica-mcp` bin once the package is installed globally/linked.
// stdout is reserved for the MCP JSON-RPC channel — all logging goes to stderr.
//
// Standalone process: load DATABASE_URL / MONICA_API_TOKEN from .env since,
// unlike the Next.js app, this entry point does not auto-load env files.
import "dotenv/config";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { validateApiTokenValue } from "@/lib/api/auth";
import { createMonicaMcpServer } from "@/lib/mcp/server";
import type { RequestMetadata } from "@/lib/mcp/tools";

async function main(): Promise<void> {
  const token = process.env.MONICA_API_TOKEN;
  if (!token) {
    console.error("MONICA_API_TOKEN is required");
    process.exit(1);
  }

  const auth = await validateApiTokenValue(token);
  if (!auth) {
    console.error("Invalid MONICA_API_TOKEN");
    process.exit(1);
  }

  const meta: RequestMetadata = {
    ipAddress: null,
    userAgent: "monica-mcp/stdio",
  };

  const server = createMonicaMcpServer(auth, meta);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Monica MCP server (stdio) connected.");
}

main().catch((error) => {
  console.error("Monica MCP server failed to start:", error);
  process.exit(1);
});
