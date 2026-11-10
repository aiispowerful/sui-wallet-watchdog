import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AuthError } from "./errors";

export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function signPayload(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPayload<T>(token: string, secret: string): T {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) throw new AuthError("Malformed token.", 401, "bad_token");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!secureEqual(sig, expected)) throw new AuthError("Invalid token.", 401, "bad_token");
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    throw new AuthError("Malformed token.", 401, "bad_token");
  }
}

/** Length-safe comparison: hash both sides so timingSafeEqual never throws on length mismatch. */
export function secureEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

export function unixSeconds(now = Date.now()): number {
  return Math.floor(now / 1000);
}
