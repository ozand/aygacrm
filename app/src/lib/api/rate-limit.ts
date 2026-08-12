// In-memory fixed-window rate limiter. Single-server only (per docs/product/scope.md).
// Keyed by API token id. Not shared across processes — acceptable for the
// documented single-server deployment.

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number; // seconds until the current window resets
}

const WINDOW_MS = 60_000;

function defaultLimit(): number {
  const raw = Number(process.env.API_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 120;
}

// Exported pure function so tests can inject the store, limit, and now.
export function evaluateRateLimit(
  store: Map<string, { count: number; windowStart: number }>,
  key: string,
  limit: number,
  now: number
): RateLimitResult {
  const entry = store.get(key);

  let windowStart: number;
  let count: number;

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    windowStart = now;
    count = 1;
  } else {
    windowStart = entry.windowStart;
    count = entry.count + 1;
  }

  store.set(key, { count, windowStart });

  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  const resetSeconds = Math.ceil((windowStart + WINDOW_MS - now) / 1000);

  return { allowed, limit, remaining, resetSeconds };
}

const store = new Map<string, { count: number; windowStart: number }>();

// Real entry point used by withApiAuth.
export function checkRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  return evaluateRateLimit(store, key, defaultLimit(), now);
}

// Test/maintenance helper.
export function _resetRateLimitStore(): void {
  store.clear();
}
