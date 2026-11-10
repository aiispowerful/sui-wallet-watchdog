/**
 * Canonical personal-message builders shared by the client (what the wallet shows)
 * and the server (what it re-builds and compares). A signature is only accepted
 * when the signed UTF-8 text equals the message rebuilt from the request body.
 */
import type { Candidate, Verdict } from "../types";

export function buildLoginMessage(opts: {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}): string {
  return [
    "Sui Wallet Watchdog",
    `Sign in to ${opts.domain}`,
    "",
    `Address: ${opts.address}`,
    `Nonce: ${opts.nonce}`,
    `Issued at: ${opts.issuedAt}`,
    `Expires: ${opts.expiresAt}`,
  ].join("\n");
}

export function buildLabelMessage(opts: {
  address: string;
  kind: string;
  subject?: string;
  digest?: string;
  verdict: Verdict;
  note?: string;
  nonce: string;
  expiresAt: string;
}): string {
  const parts = [`mark ${opts.kind}`];
  if (opts.subject) parts.push(`involving ${opts.subject}`);
  if (opts.digest) parts.push(`(tx ${opts.digest})`);
  parts.push(`on ${opts.address} as ${opts.verdict.toUpperCase()}.`);
  const note = opts.note?.trim() ? `Note: ${opts.note.trim()}` : "Note: (none).";
  return `Sui Wallet Watchdog: ${parts.join(" ")} ${note} Nonce: ${opts.nonce} Expires: ${opts.expiresAt}`;
}

export function labelMessageFromBody(
  address: string,
  candidate: Pick<Candidate, "kind" | "subject" | "digest">,
  verdict: Verdict,
  note: string | undefined,
  nonce: string,
  expiresAt: string,
): string {
  return buildLabelMessage({
    address,
    kind: candidate.kind,
    subject: candidate.subject,
    digest: candidate.digest,
    verdict,
    note,
    nonce,
    expiresAt,
  });
}

export function buildPreferenceMessage(opts: {
  address: string;
  minOutflowSui?: number;
  note?: string;
  nonce: string;
  expiresAt: string;
}): string {
  const bits: string[] = [];
  if (opts.minOutflowSui !== undefined) bits.push(`ignore SUI outflows below ${opts.minOutflowSui}`);
  if (opts.note?.trim()) bits.push(`Note: ${opts.note.trim()}`);
  const body = bits.length ? bits.join("; ") : "(none)";
  return `Sui Wallet Watchdog: set preference on ${opts.address}: ${body}. Nonce: ${opts.nonce} Expires: ${opts.expiresAt}`;
}
