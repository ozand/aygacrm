import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ApiAuthContext, hasAbility } from "@/lib/api/auth";
import {
  ToolError,
  executeToolByName,
  isToolName,
  listToolsMeta,
  toolDefinitions,
  type RequestMetadata,
} from "@/lib/mcp/tools";

export function createAygacrmMcpServer(
  auth: ApiAuthContext,
  meta: RequestMetadata
): Server {
  const server = new Server(
    {
      name: "aygacrm",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: listToolsMeta().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!isToolName(name)) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    const definition = toolDefinitions[name];

    if (!hasAbility(auth, definition.ability)) {
      return {
        content: [{ type: "text", text: `Forbidden: ${definition.ability}` }],
        isError: true,
      };
    }

    try {
      const result = await executeToolByName(name, auth, args ?? {}, meta);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (error) {
      if (error instanceof ToolError) {
        return {
          content: [{ type: "text", text: error.message }],
          isError: true,
        };
      }

      console.error(error);
      return {
        content: [{ type: "text", text: "Internal server error" }],
        isError: true,
      };
    }
  });

  return server;
}
