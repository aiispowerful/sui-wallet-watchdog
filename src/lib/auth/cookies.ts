import { SESSION_COOKIE } from "./session";

export function parseCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function readSessionToken(req: Request): string | undefined {
  return parseCookie(req.headers.get("cookie"), SESSION_COOKIE);
}

export function serializeSessionCookie(token: string, opts: { maxAge: number; secure: boolean }): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, opts.maxAge)}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  return serializeSessionCookie("", { maxAge: 0, secure });
}

export function requestIsSecure(req: Request): boolean {
  const proto = (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")).split(",")[0]?.trim();
  return proto === "https";
}

/** Hostname used in sign-in messages. AUTH_DOMAIN pins it in production. */
export function requestDomain(req: Request, env: Record<string, string | undefined> = process.env): string {
  const configured = env.AUTH_DOMAIN?.trim().toLowerCase();
  const raw = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost").split(",")[0]?.trim().toLowerCase() ?? "localhost";
  const host = raw;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  if (configured && !isLocal) return configured;
  return host;
}

export function cookieSecureFlag(req: Request): boolean {
  return requestIsSecure(req) || process.env.NODE_ENV === "production";
}
