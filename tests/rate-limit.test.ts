import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RATE_LIMIT_PER_HOUR,
  createRateLimiter,
  enforceScanRateLimit,
  getClientIp,
  parseRateLimitPerHour,
  rateLimitedResponse,
  scanRateLimiter,
} from "@/lib/rate-limit";
import { getConfig } from "@/lib/config";

vi.mock("@/lib/server", () => ({ getDeps: () => ({}) }));
vi.mock("@/lib/agent/scan", () => ({
  runScan: vi.fn(async () => ({ address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", results: [], memoriesUsed: [], stats: { candidates: 0, flagged: 0, suppressed: 0 } })),
}));

describe("parseRateLimitPerHour", () => {
  it("defaults to 20 when unset, empty, or invalid", () => {
    expect(DEFAULT_RATE_LIMIT_PER_HOUR).toBe(20);
    expect(parseRateLimitPerHour(undefined)).toBe(20);
    expect(parseRateLimitPerHour(null)).toBe(20);
    expect(parseRateLimitPerHour("")).toBe(20);
    expect(parseRateLimitPerHour("  ")).toBe(20);
    expect(parseRateLimitPerHour("nope")).toBe(20);
    expect(parseRateLimitPerHour("-3")).toBe(20);
    expect(parseRateLimitPerHour("Infinity")).toBe(20);
  });

  it("parses a non-negative integer, with 0 meaning disabled", () => {
    expect(parseRateLimitPerHour("0")).toBe(0);
    expect(parseRateLimitPerHour(" 7 ")).toBe(7);
    expect(parseRateLimitPerHour("20")).toBe(20);
    expect(parseRateLimitPerHour("20.9")).toBe(20);
  });
});

describe("getConfig rateLimitPerHour", () => {
  it("reads RATE_LIMIT_PER_HOUR from the env object", () => {
    expect(getConfig({}).rateLimitPerHour).toBe(20);
    expect(getConfig({ RATE_LIMIT_PER_HOUR: "0" }).rateLimitPerHour).toBe(0);
    expect(getConfig({ RATE_LIMIT_PER_HOUR: "5" }).rateLimitPerHour).toBe(5);
  });
});

describe("getClientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": " 1.2.3.4, 5.6.7.8 " }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(getClientIp(new Headers({ "x-real-ip": " 9.9.9.9 " }))).toBe("9.9.9.9");
    expect(getClientIp(new Headers({ "x-forwarded-for": "  ,  ", "x-real-ip": "10.0.0.1" }))).toBe("10.0.0.1");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("sliding-window limiter", () => {
  it("allows up to the limit, then blocks until the oldest hit leaves the window", () => {
    const limiter = createRateLimiter();
    const opts = { limit: 3, windowMs: 1000 };
    expect(limiter.check("a", { ...opts, now: 0 }).ok).toBe(true);
    expect(limiter.check("a", { ...opts, now: 100 }).remaining).toBe(1);
    expect(limiter.check("a", { ...opts, now: 200 })).toMatchObject({ ok: true, remaining: 0 });

    const blocked = limiter.check("a", { ...opts, now: 200 });
    expect(blocked).toMatchObject({ ok: false, remaining: 0, limit: 3 });
    expect(blocked.retryAfterSec).toBe(1);
    expect(blocked.resetAt).toBe(1000);

    // oldest hit (t=0) is still in the window at t=1000? cutoff is 0, filter t > 0 keeps 100 and 200
    const after = limiter.check("a", { ...opts, now: 1000 });
    expect(after.ok).toBe(true);
    expect(after.remaining).toBe(0); // 100, 200, and the new 1000

    const later = limiter.check("a", { ...opts, now: 1201 });
    expect(later.ok).toBe(true);
  });

  it("keeps keys independent", () => {
    const limiter = createRateLimiter();
    const opts = { now: 0, limit: 1, windowMs: 1000 };
    expect(limiter.check("ip-a", opts).ok).toBe(true);
    expect(limiter.check("ip-a", opts).ok).toBe(false);
    expect(limiter.check("ip-b", opts).ok).toBe(true);
  });

  it("disables when the limit is 0", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 50; i += 1) {
      expect(limiter.check("ip", { now: i, limit: 0 }).ok).toBe(true);
    }
  });
});

describe("429 response", () => {
  it("returns JSON, status 429, and Retry-After", async () => {
    const res = rateLimitedResponse({
      ok: false,
      limit: 20,
      remaining: 0,
      resetAt: 1_700_000_000_000,
      retryAfterSec: 42,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("20");
    await expect(res.json()).resolves.toEqual({ error: "Too many scans from this IP. Try again later." });
  });
});

describe("enforceScanRateLimit", () => {
  const prev = process.env.RATE_LIMIT_PER_HOUR;

  beforeEach(() => {
    scanRateLimiter.reset();
    process.env.RATE_LIMIT_PER_HOUR = "2";
  });

  afterEach(() => {
    scanRateLimiter.reset();
    if (prev === undefined) delete process.env.RATE_LIMIT_PER_HOUR;
    else process.env.RATE_LIMIT_PER_HOUR = prev;
  });

  it("returns null under the limit and a 429 once it is exceeded", async () => {
    const req = () => new Request("http://localhost/api/scan", { method: "POST", headers: { "x-forwarded-for": "203.0.113.9" } });
    expect(enforceScanRateLimit(req(), 1_000)).toBeNull();
    expect(enforceScanRateLimit(req(), 2_000)).toBeNull();
    const limited = enforceScanRateLimit(req(), 3_000);
    expect(limited).not.toBeNull();
    expect(limited!.status).toBe(429);
    expect(limited!.headers.get("Retry-After")).toBeTruthy();
    await expect(limited!.json()).resolves.toMatchObject({ error: expect.stringMatching(/too many scans/i) });
  });

  it("does not limit when RATE_LIMIT_PER_HOUR is 0", () => {
    process.env.RATE_LIMIT_PER_HOUR = "0";
    const req = new Request("http://localhost/api/scan", { method: "POST" });
    for (let i = 0; i < 30; i += 1) {
      expect(enforceScanRateLimit(req, i)).toBeNull();
    }
  });
});

describe("scan route uses the limiter", () => {
  const prev = process.env.RATE_LIMIT_PER_HOUR;

  beforeEach(() => {
    scanRateLimiter.reset();
    process.env.RATE_LIMIT_PER_HOUR = "1";
  });

  afterEach(() => {
    scanRateLimiter.reset();
    if (prev === undefined) delete process.env.RATE_LIMIT_PER_HOUR;
    else process.env.RATE_LIMIT_PER_HOUR = prev;
  });

  it("returns 429 on the second scan from the same IP", async () => {
    const { POST } = await import("@/app/api/scan/route");
    const body = JSON.stringify({ address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
    const headers = { "content-type": "application/json", "x-real-ip": "198.51.100.4" };
    const first = await POST(new Request("http://localhost/api/scan", { method: "POST", headers, body }));
    expect(first.status).toBe(200);
    const second = await POST(new Request("http://localhost/api/scan", { method: "POST", headers, body }));
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
    await expect(second.json()).resolves.toMatchObject({ error: expect.stringMatching(/too many scans/i) });
  });
});
