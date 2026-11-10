import { readSessionToken } from "./cookies";
import { AuthError } from "./errors";
import { getSessionSecret } from "./secret";
import { parseSession, type SessionPayload } from "./session";

export { cookieSecureFlag } from "./cookies";

export function trySession(req: Request, secret?: string, now = Date.now()): SessionPayload | null {
  let sec = secret;
  if (!sec) {
    try {
      sec = getSessionSecret();
    } catch {
      return null;
    }
  }
  const token = readSessionToken(req);
  if (!token) return null;
  try {
    return parseSession(token, sec, now);
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

export function requireSession(req: Request, address?: string, secret = getSessionSecret(), now = Date.now()): SessionPayload {
  const token = readSessionToken(req);
  if (!token) throw new AuthError("Sign in with your Sui wallet to continue.", 401, "unauthenticated");
  const session = parseSession(token, secret, now);
  if (address && session.addr !== address) {
    throw new AuthError("This session is for a different address. Sign in with the wallet you want to teach.", 403, "mismatch");
  }
  return session;
}
