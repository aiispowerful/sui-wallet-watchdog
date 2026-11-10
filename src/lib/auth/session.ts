import { AuthError } from "./errors";
import { isoFromUnix, signPayload, unixSeconds, verifyPayload } from "./token";

export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const SESSION_COOKIE = "watchdog_session";

export interface SessionPayload {
  typ: "s";
  addr: string;
  iat: number;
  exp: number;
}

export function issueSession(address: string, secret: string, now = Date.now()): { token: string; expiresAt: string; maxAge: number } {
  const iat = unixSeconds(now);
  const exp = iat + SESSION_TTL_SECONDS;
  const token = signPayload({ typ: "s", addr: address, iat, exp } satisfies SessionPayload, secret);
  return { token, expiresAt: isoFromUnix(exp), maxAge: SESSION_TTL_SECONDS };
}

export function parseSession(token: string, secret: string, now = Date.now()): SessionPayload {
  const payload = verifyPayload<SessionPayload>(token, secret);
  if (payload.typ !== "s" || typeof payload.addr !== "string") {
    throw new AuthError("Invalid session.", 401, "bad_session");
  }
  if (typeof payload.exp !== "number" || unixSeconds(now) >= payload.exp) {
    throw new AuthError("Your session expired. Please sign in again.", 401, "expired");
  }
  return payload;
}
