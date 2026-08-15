// Minimal fetch wrapper for the AygaCRM REST API v1 client CLI.
//
// apiRequest() always talks to `${url}/api/v1${path}`. Non-2xx responses throw
// ApiClientError (carrying the HTTP status + parsed error body) so the command
// layer in aygacrm.ts can map it to a structured process exit code via
// statusToExitCode().

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequestOptions {
  /** Bearer token. Omit to send the request unauthenticated (server will 401). */
  token?: string;
  /** API origin, e.g. http://localhost:4000 (no trailing slash required). */
  url: string;
  /** JSON-serializable request body. Omit for bodyless requests. */
  body?: unknown;
  /** Value for the `Idempotency-Key` header on write operations. */
  idempotencyKey?: string;
}

export interface ApiRequestResult {
  status: number;
  json: unknown;
}

/** Sentinel status used for network-level failures (no HTTP response received). */
export const NETWORK_ERROR_STATUS = 0;

/**
 * Error thrown by apiRequest() for any non-2xx response, or for network
 * failures (fetch rejecting before a response was received).
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfter: string | null;

  constructor(message: string, status: number, body: unknown, retryAfter: string | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

/**
 * Maps an HTTP status code (or the NETWORK_ERROR_STATUS sentinel) to the
 * CLI's structured exit code:
 *   0 success
 *   2 auth error       (401/403 — also used directly for a missing token)
 *   3 validation error (400/422 — also used directly for bad --data JSON)
 *   4 not found        (404)
 *   5 API/server error (429, 5xx, network failure, anything else)
 */
export function statusToExitCode(status: number): number {
  if (status === 401 || status === 403) return 2;
  if (status === 400 || status === 422) return 3;
  if (status === 404) return 4;
  if (status >= 200 && status < 300) return 0;
  return 5;
}

function extractErrorMessage(json: unknown, fallback: string): string {
  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    (json as { error?: unknown }).error &&
    typeof (json as { error: unknown }).error === "object"
  ) {
    const errorObj = (json as { error: Record<string, unknown> }).error;
    if (typeof errorObj.message === "string") {
      return errorObj.message;
    }
  }
  return fallback;
}

/**
 * Issues an HTTP request against the AygaCRM REST API v1.
 *
 * `path` is the resource path (e.g. "/contacts" or "/contacts/123"); the
 * `/api/v1` base path is prepended automatically. Non-2xx responses throw
 * ApiClientError; network failures also throw ApiClientError with
 * status = NETWORK_ERROR_STATUS.
 */
export async function apiRequest(
  method: HttpMethod,
  path: string,
  options: ApiRequestOptions
): Promise<ApiRequestResult> {
  const base = options.url.replace(/\/+$/, "");
  const fullUrl = `${base}/api/v1${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const init: RequestInit = { method, headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiClientError(
      `Network error calling ${fullUrl}: ${message}`,
      NETWORK_ERROR_STATUS,
      null
    );
  }

  const text = await response.text();
  let json: unknown = null;
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  if (!response.ok) {
    const retryAfter = response.headers.get("Retry-After");
    const message = extractErrorMessage(json, `Request failed with status ${response.status}`);
    throw new ApiClientError(message, response.status, json, retryAfter);
  }

  return { status: response.status, json };
}

/**
 * Strips a leading "/api/v1" from a server-provided link (e.g.
 * PaginatedResponse.links.next), so it can be re-passed to apiRequest()
 * without double-prefixing the base path.
 *
 * Handles both relative links (e.g. "/api/v1/contacts?page=2") and absolute
 * links (e.g. "http://host/api/v1/contacts?page=2") — the API may return
 * either. Absolute links are parsed and reduced to pathname+search before
 * stripping, so callers always get back a path suitable for apiRequest()
 * (which prepends "/api/v1" itself).
 */
export function stripApiPrefix(link: string): string {
  let pathAndQuery = link;
  if (/^https?:\/\//i.test(link)) {
    const parsed = new URL(link);
    pathAndQuery = `${parsed.pathname}${parsed.search}`;
  }
  return pathAndQuery.replace(/^\/api\/v1/, "");
}
