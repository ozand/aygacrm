import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Standard API error response
export interface ApiError {
  error: {
    message: string;
    error_code: number;
  };
}

// Standard API success response
export interface ApiResponse<T> {
  data: T;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    path: string;
    per_page: number;
    to: number;
    total: number;
  };
}

// API Error codes (matching Monica's original API)
export const API_ERRORS = {
  LIMIT_TOO_BIG: { code: 30, message: "The limit parameter is too big." },
  NOT_FOUND: { code: 31, message: "The resource has not been found." },
  VALIDATION_ERROR: { code: 32, message: "Error while trying to save the data." },
  TOO_MANY_PARAMS: { code: 33, message: "Too many parameters." },
  RATE_LIMITED: { code: 34, message: "Too many attempts, please slow down the request." },
  EMAIL_TAKEN: { code: 35, message: "This email address is already taken." },
  PARTIAL_CONTACT_ERROR: { code: 36, message: "You can't set a partner or a child to a partial contact." },
  JSON_PARSE_ERROR: { code: 37, message: "Problems parsing JSON." },
  FUTURE_DATE_REQUIRED: { code: 38, message: "Date should be in the future." },
  INVALID_SORT: { code: 39, message: "The sorting criteria is invalid." },
  INVALID_QUERY: { code: 40, message: "Invalid query." },
  INVALID_PARAMS: { code: 41, message: "Invalid parameters." },
  UNAUTHORIZED: { code: 42, message: "Unauthorized. Please provide a valid API token." },
  FORBIDDEN: { code: 43, message: "You don't have permission to access this resource." },
  INTERNAL_ERROR: { code: 50, message: "An internal error occurred." },
} as const;

// Helper to create error response
export function apiError(
  error: keyof typeof API_ERRORS,
  status: number = 400,
  customMessage?: string
): NextResponse<ApiError> {
  const err = API_ERRORS[error];
  return NextResponse.json(
    {
      error: {
        message: customMessage || err.message,
        error_code: err.code,
      },
    },
    { status }
  );
}

// Helper to create success response
export function apiSuccess<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data }, { status });
}

// Helper to create paginated response
export function apiPaginated<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  baseUrl: string
): NextResponse<PaginatedResponse<T>> {
  const lastPage = Math.ceil(total / limit);
  const from = total > 0 ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);

  return NextResponse.json({
    data,
    links: {
      first: `${baseUrl}?page=1`,
      last: `${baseUrl}?page=${lastPage}`,
      prev: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
      next: page < lastPage ? `${baseUrl}?page=${page + 1}` : null,
    },
    meta: {
      current_page: page,
      from,
      last_page: lastPage,
      path: baseUrl,
      per_page: limit,
      to,
      total,
    },
  });
}

// Token context type
export interface ApiAuthContext {
  userId: string;
  accountId: string;
  tokenId: string;
  abilities: string[];
}

// Hash token for storage (SHA256)
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Generate a new API token
export function generateToken(): { token: string; prefix: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const prefix = token.substring(0, 8);
  return { token, prefix };
}

// Validate API token from request
export async function validateApiToken(
  request: NextRequest
): Promise<ApiAuthContext | null> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const hashedToken = hashToken(token);

  try {
    const apiToken = await db.apiToken.findUnique({
      where: { token: hashedToken },
      include: {
        user: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!apiToken) {
      return null;
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp
    await db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      userId: apiToken.userId,
      accountId: apiToken.user.accountId,
      tokenId: apiToken.id,
      abilities: apiToken.abilities,
    };
  } catch (error) {
    console.error("Error validating API token:", error);
    return null;
  }
}

// Check if token has specific ability
export function hasAbility(context: ApiAuthContext, ability: string): boolean {
  // "*" means all abilities
  if (context.abilities.includes("*")) {
    return true;
  }
  return context.abilities.includes(ability);
}

// Higher-order function to protect API routes
export function withApiAuth(
  handler: (
    request: NextRequest,
    context: ApiAuthContext,
    params?: Record<string, string>
  ) => Promise<NextResponse>,
  requiredAbility?: string
) {
  return async (
    request: NextRequest,
    { params }: { params?: Promise<Record<string, string>> } = {}
  ): Promise<NextResponse> => {
    const authContext = await validateApiToken(request);

    if (!authContext) {
      return apiError("UNAUTHORIZED", 401);
    }

    if (requiredAbility && !hasAbility(authContext, requiredAbility)) {
      return apiError("FORBIDDEN", 403);
    }

    const resolvedParams = params ? await params : undefined;
    return handler(request, authContext, resolvedParams);
  };
}

// Parse pagination params from request
export function getPaginationParams(
  request: NextRequest,
  maxLimit: number = 100
): { page: number; limit: number } {
  const url = new URL(request.url);
  const pageStr = url.searchParams.get("page");
  const limitStr = url.searchParams.get("limit");

  let page = pageStr ? parseInt(pageStr, 10) : 1;
  let limit = limitStr ? parseInt(limitStr, 10) : 10;

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > maxLimit) limit = maxLimit;

  return { page, limit };
}

// Get sort params
export function getSortParams(
  request: NextRequest,
  allowedFields: string[]
): { field: string; direction: "asc" | "desc" } | null {
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort");

  if (!sort) return null;

  const isDesc = sort.startsWith("-");
  const field = isDesc ? sort.substring(1) : sort;

  // Convert snake_case to camelCase
  const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

  if (!allowedFields.includes(camelField)) {
    return null;
  }

  return {
    field: camelField,
    direction: isDesc ? "desc" : "asc",
  };
}

// Get base URL for pagination links
export function getBaseUrl(request: NextRequest): string {
  const url = new URL(request.url);
  // Remove page and limit params
  url.searchParams.delete("page");
  url.searchParams.delete("limit");
  return url.pathname;
}
