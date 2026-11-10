/**
 * In-memory sliding-window rate limiter for the scan API.
 * State is per-process, so it resets when a serverless instance recycles — that's fine.
 */
export const DEFAULT_RATE_LIMIT_PER_HOUR = 20;
export const HOUR_MS = 60 * 60 * 1000;

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

export function parseRateLimitPerHour(raw?: string | null): number {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_RATE_LIMIT_PER_HOUR;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_RATE_LIMIT_PER_HOUR;
  return Math.floor(n);
}

/** First IP in x-forwarded-for, then x-real-ip, otherwise "unknown". */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  return "unknown";
}

export function createRateLimiter() {
  const buckets = new Map<string, number[]>();

  function check(
    key: string,
    opts: { now?: number; limit?: number; windowMs?: number } = {},
  ): RateLimitResult {
    const now = opts.now ?? Date.now();
    const limit = opts.limit ?? parseRateLimitPerHour(process.env.RATE_LIMIT_PER_HOUR);
    const windowMs = opts.windowMs ?? HOUR_MS;

    if (limit <= 0) {
      return { ok: true, limit: 0, remaining: 0, resetAt: now, retryAfterSec: 0 };
    }

    const cutoff = now - windowMs;
    const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= limit) {
      const resetAt = hits[0] + windowMs;
      return {
        ok: false,
        limit,
        remaining: 0,
        resetAt,
        retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    hits.push(now);
    buckets.set(key, hits);
    return {
      ok: true,
      limit,
      remaining: limit - hits.length,
      resetAt: hits[0] + windowMs,
      retryAfterSec: 0,
    };
  }

  function reset() {
    buckets.clear();
  }

  return { check, reset };
}

export const scanRateLimiter = createRateLimiter();

export function rateLimitedResponse(result: RateLimitResult): Response {
  return Response.json(
    { error: "Too many scans from this IP. Try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

/** Returns a 429 response when the caller is over the limit; otherwise null. */
export function enforceScanRateLimit(req: Request, now = Date.now()): Response | null {
  const limit = parseRateLimitPerHour(process.env.RATE_LIMIT_PER_HOUR);
  const result = scanRateLimiter.check(getClientIp(req.headers), { now, limit });
  if (!result.ok) return rateLimitedResponse(result);
  return null;
}
