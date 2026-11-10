/**
 * Stateless HMAC-signed nonces.
 *
 * Each nonce is a signed token that carries a purpose, issued-at, expiry, a random
 * id, and (for action nonces) the bound address. There is no shared store across
 * serverless instances, so "single use" is enforced only by a short TTL (5 minutes)
 * rather than a replay cache. Within that window a captured unused nonce could be
 * replayed on another instance. That is an accepted tradeoff for a free serverless
 * deploy without Redis: login replay only mints another session for the same
 * address, and action replay could write a duplicate memory, but the signature
 * still has to come from the wallet owner and the TTL is short.
 */
import { AuthError } from "./errors";
import { isoFromUnix, randomId, signPayload, unixSeconds, verifyPayload } from "./token";

export const NONCE_TTL_SECONDS = 5 * 60;
export type NoncePurpose = "login" | "label" | "preference";

export interface NoncePayload {
  typ: "n";
  p: NoncePurpose;
  iat: number;
  exp: number;
  jti: string;
  addr?: string;
  dom?: string;
}

export interface IssuedNonce {
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  purpose: NoncePurpose;
  domain?: string;
}

export function issueNonce(
  secret: string,
  opts: { purpose: NoncePurpose; address?: string; domain?: string; now?: number; ttlSeconds?: number },
): IssuedNonce {
  const now = unixSeconds(opts.now ?? Date.now());
  const exp = now + (opts.ttlSeconds ?? NONCE_TTL_SECONDS);
  const payload: NoncePayload = {
    typ: "n",
    p: opts.purpose,
    iat: now,
    exp,
    jti: randomId(),
    ...(opts.address ? { addr: opts.address } : {}),
    ...(opts.domain ? { dom: opts.domain } : {}),
  };
  return {
    nonce: signPayload(payload, secret),
    issuedAt: isoFromUnix(now),
    expiresAt: isoFromUnix(exp),
    purpose: opts.purpose,
    domain: opts.domain,
  };
}

export function verifyNonce(
  nonce: string,
  secret: string,
  opts: { purpose: NoncePurpose; address?: string; domain?: string; now?: number },
): NoncePayload {
  const payload = verifyPayload<NoncePayload>(nonce, secret);
  if (payload.typ !== "n") throw new AuthError("Not a nonce token.", 401, "bad_nonce");
  if (payload.p !== opts.purpose) throw new AuthError("This nonce is for a different action.", 403, "nonce_purpose");
  const now = unixSeconds(opts.now ?? Date.now());
  if (typeof payload.exp !== "number" || now >= payload.exp) {
    throw new AuthError("This approval expired. Please try again.", 401, "expired");
  }
  if (opts.address && payload.addr && payload.addr !== opts.address) {
    throw new AuthError("This nonce was issued for a different address.", 403, "nonce_address");
  }
  if (opts.domain && payload.dom && payload.dom !== opts.domain) {
    throw new AuthError("This nonce was issued for a different site.", 403, "nonce_domain");
  }
  return payload;
}
