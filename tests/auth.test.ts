import { describe, expect, it } from "vitest";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { AuthError } from "@/lib/auth/errors";
import { buildLoginMessage, buildLabelMessage, buildPreferenceMessage, labelMessageFromBody } from "@/lib/auth/messages";
import { issueNonce, verifyNonce, NONCE_TTL_SECONDS } from "@/lib/auth/nonce";
import { redactScanForPublic } from "@/lib/auth/redact";
import { issueSession, parseSession, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { signPayload, verifyPayload } from "@/lib/auth/token";
import { verifySignedMessage } from "@/lib/auth/verify-message";
import type { ScanResult } from "@/lib/types";

const SECRET = "test-session-secret-value-32ch";
const ADDR = "0x" + "ab".repeat(32);

describe("HMAC tokens", () => {
  it("round-trips a payload and rejects tampering", () => {
    const token = signPayload({ typ: "n", n: 1 }, SECRET);
    expect(verifyPayload<{ typ: string; n: number }>(token, SECRET)).toEqual({ typ: "n", n: 1 });
    expect(() => verifyPayload(token + "x", SECRET)).toThrow(AuthError);
    expect(() => verifyPayload(token, "other-secret-value-32chars!!")).toThrow(AuthError);
  });
});

describe("stateless nonces", () => {
  it("issues a verifiable nonce with a 5-minute TTL", () => {
    const now = 1_700_000_000_000;
    const issued = issueNonce(SECRET, { purpose: "login", domain: "example.com", now });
    const payload = verifyNonce(issued.nonce, SECRET, { purpose: "login", domain: "example.com", now });
    expect(payload.p).toBe("login");
    expect(payload.dom).toBe("example.com");
    expect(payload.exp - payload.iat).toBe(NONCE_TTL_SECONDS);
    expect(issued.expiresAt).toBe(new Date(now + NONCE_TTL_SECONDS * 1000).toISOString());
  });

  it("rejects expired, wrong-purpose, and wrong-address nonces", () => {
    const now = 1_700_000_000_000;
    const issued = issueNonce(SECRET, { purpose: "label", address: ADDR, now });
    expect(() => verifyNonce(issued.nonce, SECRET, { purpose: "label", address: ADDR, now: now + (NONCE_TTL_SECONDS + 1) * 1000 })).toThrow(/expired/i);
    expect(() => verifyNonce(issued.nonce, SECRET, { purpose: "login", address: ADDR, now })).toThrow(/different action/i);
    const other = "0x" + "cd".repeat(32);
    expect(() => verifyNonce(issued.nonce, SECRET, { purpose: "label", address: other, now })).toThrow(/different address/i);
  });
});

describe("sessions", () => {
  it("issues a 12-hour session bound to an address", () => {
    const now = 1_700_000_000_000;
    const { token, maxAge } = issueSession(ADDR, SECRET, now);
    expect(maxAge).toBe(SESSION_TTL_SECONDS);
    const session = parseSession(token, SECRET, now);
    expect(session.addr).toBe(ADDR);
    expect(() => parseSession(token, SECRET, now + (SESSION_TTL_SECONDS + 1) * 1000)).toThrow(/expired/i);
  });
});

describe("message builders", () => {
  it("builds a stable login challenge", () => {
    const msg = buildLoginMessage({
      domain: "sui-wallet-watchdog.netlify.app",
      address: ADDR,
      nonce: "nonce-1",
      issuedAt: "2026-11-10T12:00:00.000Z",
      expiresAt: "2026-11-10T12:05:00.000Z",
    });
    expect(msg).toContain("Sui Wallet Watchdog");
    expect(msg).toContain("Sign in to sui-wallet-watchdog.netlify.app");
    expect(msg).toContain(`Address: ${ADDR}`);
    expect(msg).toContain("Nonce: nonce-1");
  });

  it("builds a human-readable label approval bound to the body fields", () => {
    const msg = labelMessageFromBody(
      ADDR,
      { kind: "large_outflow", subject: "0x" + "66".repeat(32), digest: "TxDigest1" },
      "expected",
      "weekly deposit",
      "nonce-2",
      "2026-11-10T12:05:00.000Z",
    );
    expect(msg).toBe(
      `Sui Wallet Watchdog: mark large_outflow involving ${"0x" + "66".repeat(32)} (tx TxDigest1) on ${ADDR} as EXPECTED. Note: weekly deposit Nonce: nonce-2 Expires: 2026-11-10T12:05:00.000Z`,
    );
    const rebuilt = buildLabelMessage({
      address: ADDR,
      kind: "large_outflow",
      subject: "0x" + "66".repeat(32),
      digest: "TxDigest1",
      verdict: "expected",
      note: "weekly deposit",
      nonce: "nonce-2",
      expiresAt: "2026-11-10T12:05:00.000Z",
    });
    expect(rebuilt).toBe(msg);
  });

  it("builds a preference message", () => {
    const msg = buildPreferenceMessage({ address: ADDR, minOutflowSui: 150, note: "Cetus only", nonce: "n", expiresAt: "E" });
    expect(msg).toContain("set preference on " + ADDR);
    expect(msg).toContain("ignore SUI outflows below 150");
    expect(msg).toContain("Note: Cetus only");
  });
});

describe("personal message verification (Ed25519Keypair)", () => {
  it("accepts a real personal message and rejects a mismatched address or text", async () => {
    const kp = new Ed25519Keypair();
    const address = kp.getPublicKey().toSuiAddress();
    const message = buildLoginMessage({
      domain: "localhost:3000",
      address,
      nonce: "abc",
      issuedAt: "2026-11-10T12:00:00.000Z",
      expiresAt: "2026-11-10T12:05:00.000Z",
    });
    const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(message));
    const ok = await verifySignedMessage({ message, signature, address });
    expect(ok.address).toBe(address);

    const other = new Ed25519Keypair().getPublicKey().toSuiAddress();
    await expect(verifySignedMessage({ message, signature, address: other })).rejects.toThrow(AuthError);

    await expect(verifySignedMessage({ message: message + "!", signature, address })).rejects.toThrow(AuthError);
  });
});

describe("public scan redaction", () => {
  it("keeps decisions and counts but strips notes and the memory list", () => {
    const scan = {
      address: ADDR,
      memoriesUsed: [
        { blobId: "blob1", text: "User marked x as EXPECTED. Note: my secret exchange", distance: 0.1, parsed: { type: "label", address: ADDR, note: "my secret exchange" } },
      ],
      results: [
        { candidate: { id: "c1", kind: "large_outflow", severity: "medium", summary: "sent 10" }, decision: "suppress", severity: "medium", reason: 'Matches a pattern you approved ("my secret exchange").', memoryRefs: ["blob1"] },
      ],
      stats: { candidates: 1, flagged: 0, suppressed: 1, escalated: 0 },
      summary: "Looks fine because of my secret exchange",
    } as unknown as ScanResult;
    const redacted = redactScanForPublic(scan);
    expect(redacted.memoryRedacted).toBe(true);
    expect(redacted.memoriesUsed).toEqual([]);
    expect(redacted.memoriesUsedCount).toBe(1);
    expect(redacted.results[0].decision).toBe("suppress");
    expect(redacted.results[0].reason).not.toContain("secret exchange");
    expect(redacted.summary).not.toContain("secret exchange");
  });
});
