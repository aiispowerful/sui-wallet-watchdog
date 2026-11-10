import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { MemWalMock } from "@mysten-incubation/memwal";
import { getConfig } from "@/lib/config";
import { MemWalStore } from "@/lib/memory/store";
import { labelMessageFromBody } from "@/lib/auth/messages";
import { issueNonce } from "@/lib/auth/nonce";
import { DEMO_ADDRESS } from "@/lib/sui/fixture";

vi.mock("@/lib/server", () => ({ getDeps: vi.fn() }));

import { getDeps } from "@/lib/server";
import { POST as noncePOST } from "@/app/api/auth/nonce/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { POST as labelPOST } from "@/app/api/label/route";
import { POST as memoriesPOST } from "@/app/api/memories/route";

const SECRET = "test-session-secret-value-32ch";
const HOST = "localhost:3000";

function deps() {
  const cfg = getConfig({});
  const mock = MemWalMock.create({ namespace: cfg.memwalNamespacePrefix });
  return { cfg, memory: new MemWalStore(mock as never, "mock") };
}

function jsonReq(url: string, body: unknown, extra: HeadersInit = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST, ...extra },
    body: JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const m = raw.match(/watchdog_session=([^;]+)/);
  if (!m) return "";
  return `watchdog_session=${m[1]}`;
}

const candidate = {
  id: "c1",
  kind: "large_outflow" as const,
  severity: "medium" as const,
  digest: "D1",
  subject: "0x" + "11".repeat(32),
  summary: "sent 10 SUI",
};

describe("auth and label routes", () => {
  const prev = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
    delete process.env.AUTH_DOMAIN;
    vi.mocked(getDeps).mockReturnValue(deps() as never);
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prev;
  });

  async function signIn(kp = new Ed25519Keypair()) {
    const address = kp.getPublicKey().toSuiAddress();
    const nonceRes = await noncePOST(jsonReq("http://localhost/api/auth/nonce", { purpose: "login", address }));
    expect(nonceRes.status).toBe(200);
    const issued = await nonceRes.json();
    const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(issued.message));
    const loginRes = await loginPOST(jsonReq("http://localhost/api/auth/login", { address, nonce: issued.nonce, message: issued.message, signature }));
    expect(loginRes.status).toBe(200);
    const cookie = cookieFrom(loginRes);
    expect(cookie).toContain("watchdog_session=");
    return { kp, address, cookie };
  }

  it("sets a session cookie after a valid sign-in and reports the address", async () => {
    const { address, cookie } = await signIn();
    const me = await meGET(new Request("http://localhost/api/auth/me", { headers: { cookie, host: HOST } }));
    expect(me.status).toBe(200);
    await expect(me.json()).resolves.toMatchObject({ address });
    const out = await logoutPOST(new Request("http://localhost/api/auth/logout", { method: "POST", headers: { host: HOST } }));
    expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });

  it("rejects an expired login nonce and a signature from a different key", async () => {
    const kp = new Ed25519Keypair();
    const address = kp.getPublicKey().toSuiAddress();
    const stale = issueNonce(SECRET, { purpose: "login", address, domain: HOST, now: Date.now() - 10 * 60 * 1000 });
    const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(stale.nonce));
    const expired = await loginPOST(
      jsonReq("http://localhost/api/auth/login", { address, nonce: stale.nonce, message: "not-the-message", signature }),
    );
    expect(expired.status).toBe(401);

    const issuedRes = await noncePOST(jsonReq("http://localhost/api/auth/nonce", { purpose: "login", address }));
    const issued = await issuedRes.json();
    const other = new Ed25519Keypair();
    const { signature: badSig } = await other.signPersonalMessage(new TextEncoder().encode(issued.message));
    const mismatch = await loginPOST(jsonReq("http://localhost/api/auth/login", { address, nonce: issued.nonce, message: issued.message, signature: badSig }));
    expect(mismatch.status).toBe(403);
  });

  it("returns 401 for an unsigned label on a real address and 403 for a mismatched signature", async () => {
    const { address, cookie, kp } = await signIn();
    const unsigned = await labelPOST(
      jsonReq("http://localhost/api/label", { address, candidate, verdict: "expected" }, { cookie }),
    );
    expect(unsigned.status).toBe(401);
    await expect(unsigned.json()).resolves.toMatchObject({ code: "unsigned" });

    const noSession = await labelPOST(jsonReq("http://localhost/api/label", { address, candidate, verdict: "expected" }));
    expect(noSession.status).toBe(401);

    const nonceRes = await noncePOST(jsonReq("http://localhost/api/auth/nonce", { purpose: "label", address }, { cookie }));
    const issued = await nonceRes.json();
    const message = labelMessageFromBody(address, candidate, "expected", undefined, issued.nonce, issued.expiresAt);
    const other = new Ed25519Keypair();
    const { signature } = await other.signPersonalMessage(new TextEncoder().encode(message));
    const mismatched = await labelPOST(
      jsonReq("http://localhost/api/label", { address, candidate, verdict: "expected", nonce: issued.nonce, message, signature }, { cookie }),
    );
    expect(mismatched.status).toBe(403);

    // The rightful key can label after a fresh nonce.
    const nonce2 = await (await noncePOST(jsonReq("http://localhost/api/auth/nonce", { purpose: "label", address }, { cookie }))).json();
    const msg2 = labelMessageFromBody(address, candidate, "expected", undefined, nonce2.nonce, nonce2.expiresAt);
    const { signature: okSig } = await kp.signPersonalMessage(new TextEncoder().encode(msg2));
    const ok = await labelPOST(
      jsonReq("http://localhost/api/label", { address, candidate, verdict: "expected", nonce: nonce2.nonce, message: msg2, signature: okSig }, { cookie }),
    );
    expect(ok.status).toBe(200);
    const saved = await ok.json();
    expect(saved.proof?.signature).toBe(okSig);
    expect(saved.demo).toBeUndefined();
  });

  it("rejects the old 'demo' alias and requires a session plus signature for every address, including the former fixture", async () => {
    const alias = await labelPOST(jsonReq("http://localhost/api/label", { address: "demo", candidate, verdict: "expected", note: "sample" }));
    expect(alias.status).toBe(400);

    const unsigned = await labelPOST(jsonReq("http://localhost/api/label", { address: DEMO_ADDRESS, candidate, verdict: "expected", note: "sample" }));
    expect(unsigned.status).toBe(401);
    await expect(unsigned.json()).resolves.toMatchObject({ code: "unauthenticated" });

    const list = await memoriesPOST(jsonReq("http://localhost/api/memories", { address: DEMO_ADDRESS }));
    expect(list.status).toBe(401);

    const almost = "0x" + "d3".repeat(31) + "d4";
    const similar = await labelPOST(jsonReq("http://localhost/api/label", { address: almost, candidate, verdict: "expected" }));
    expect(similar.status).toBe(401);
    expect(almost).not.toBe(DEMO_ADDRESS);
  });
});
