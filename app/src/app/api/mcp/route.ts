export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiAuthContext, hasAbility, validateApiToken } from "@/lib/api/auth";
import {
  ToolError,
  ToolErrorCode,
  isToolName,
  executeToolByName,
  listToolsMeta,
  normalizeZodError,
  toolDefinitions,
  type RequestMetadata,
} from "@/lib/mcp/tools";

function errorResponse(message: string, code: ToolErrorCode, status: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        code,
      },
    },
    { status }
  );
}

function getRequestMetadata(request: NextRequest): RequestMetadata {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

const requestSchema = z.object({
  tool: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: "monica-crm",
    version: "1.0.0",
    tools: listToolsMeta(),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authContext: ApiAuthContext | null = await validateApiToken(request);
  if (!authContext) {
    return errorResponse("Unauthorized", "UNAUTHORIZED", 401);
  }

  let parsedBody: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    const bodyResult = requestSchema.safeParse(json);

    if (!bodyResult.success) {
      return errorResponse(normalizeZodError(bodyResult.error), "INVALID_REQUEST", 400);
    }

    parsedBody = bodyResult.data;
  } catch {
    return errorResponse("Invalid JSON body", "INVALID_REQUEST", 400);
  }

  if (!isToolName(parsedBody.tool)) {
    return errorResponse("Unknown tool", "UNKNOWN_TOOL", 400);
  }

  const definition = toolDefinitions[parsedBody.tool];

  if (!hasAbility(authContext, definition.ability)) {
    return errorResponse("Insufficient permissions", "FORBIDDEN", 403);
  }

  try {
    const meta = getRequestMetadata(request);
    const result = await executeToolByName(
      parsedBody.tool,
      authContext,
      parsedBody.arguments,
      meta
    );
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof ToolError) {
      return errorResponse(error.message, error.code, error.status);
    }

    console.error("MCP route error:", error);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}
