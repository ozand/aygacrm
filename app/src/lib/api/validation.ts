import { NextRequest } from "next/server";
import { ZodSchema } from "zod";
import { apiError } from "./auth";

export async function parseJsonBody(
  request: NextRequest
): Promise<{ data: unknown } | { error: ReturnType<typeof apiError> }> {
  try {
    const data = await request.json();
    return { data };
  } catch {
    return { error: apiError("JSON_PARSE_ERROR", 400) };
  }
}

export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown
): { data: T } | { error: ReturnType<typeof apiError> } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fieldErrors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return { error: apiError("VALIDATION_ERROR", 422, fieldErrors) };
  }
  return { data: result.data };
}
