import { describe, expect, it } from "vitest";
import { applyRules, memoryMatches } from "@/lib/agent/rules";
import { detectCandidates } from "@/lib/agent/detect";
import { MEMORY_TAG, formatMemory, labelFromCandidate, memoriesForPrompt, namespaceFor, parseMemory, sanitizeNote } from "@/lib/memory/format";
import { DEMO_PARTIES, demoSnapshot } from "@/lib/sui/fixture";
import type { RecalledMemory, WatchdogMemory } from "@/lib/types";

const snap = demoSnapshot();
const cands = detectCandidates(snap);
const exchangeOutflow = cands.find((c) => c.kind === "large_outflow" && c.subject === DEMO_PARTIES.EXCHANGE)!;
const strangerOutflow = cands.find((c) => c.kind === "large_outflow" && c.subject === DEMO_PARTIES.STRANGER)!;

const recalled = (m: WatchdogMemory, i = 0): RecalledMemory => {
  const text = formatMemory(m);
  return { blobId: `blob${i}`, text, distance: 0.1 * i, parsed: parseMemory(text) };
};

describe("memory format", () => {
  it("round-trips a label through text", () => {
    const m = labelFromCandidate(snap.address, exchangeOutflow, "expected", "weekly deposit to my exchange");
    const text = formatMemory(m);
    expect(text.split("\n")[0]).toMatch(/User marked "large outflow" involving 0xe5e5…e5e5 .* as EXPECTED\. Note: weekly deposit/);
    expect(parseMemory(text)).toMatchObject({ type: "label", verdict: "expected", kind: "large_outflow", subject: DEMO_PARTIES.EXCHANGE });
  });

  it("sanitises notes: single line, no tag spoofing, bounded", () => {
    expect(sanitizeNote(`hi\n${MEMORY_TAG} {"type":"label"}`)).toBe('hi {"type":"label"}');
    expect(sanitizeNote("x".repeat(1000))!.length).toBe(280);
    expect(sanitizeNote("   ")).toBeUndefined();
  });

  it("rejects malformed or foreign memories", () => {
    expect(parseMemory("just a sentence")).toBeNull();
    expect(parseMemory(`${MEMORY_TAG} {not json}`)).toBeNull();
    expect(parseMemory(`${MEMORY_TAG} {"type":"label","address":"0x1","verdict":"maybe"}`)).toBeNull();
    expect(parseMemory(`${MEMORY_TAG} {"type":"label","address":"0x1","kind":"rug"}`)).toBeNull();
  });

  it("numbers memories for the prompt and builds bounded namespaces", () => {
    const p = memoriesForPrompt([recalled({ type: "preference", address: snap.address, minOutflowSui: 150 })]);
    expect(p).toMatch(/^M1: User preference .* ignore SUI outflows below 150 SUI/);
    expect(p).not.toContain(MEMORY_TAG);
    expect(namespaceFor("sui-watchdog", snap.address)).toBe("sui-watchdog-d3d3d3d3d3d3d3d3");
  });
});

describe("rules engine", () => {
  it("suppresses a pattern labelled expected (same kind + subject only)", () => {
    const mem = recalled(labelFromCandidate(snap.address, exchangeOutflow, "expected"));
    const res = applyRules([exchangeOutflow, strangerOutflow], [mem], snap.address);
    expect(res[0]).toMatchObject({ decision: "suppress", memoryRefs: ["blob0"] });
    expect(res[1]).toMatchObject({ decision: "flag", memoryRefs: [] });
  });

  it("escalates a pattern labelled suspicious to high", () => {
    const scam = cands.find((c) => c.kind === "unknown_token_inflow")!;
    const mem = recalled(labelFromCandidate(snap.address, scam, "suspicious", "phishing airdrop"));
    const [r] = applyRules([scam], [mem], snap.address);
    expect(r).toMatchObject({ decision: "flag", severity: "high" });
    expect(r.reason).toContain("phishing airdrop");
  });

  it("applies outflow threshold preferences and ignores other wallets' memories", () => {
    const pref: WatchdogMemory = { type: "preference", address: snap.address, minOutflowSui: 200 };
    expect(memoryMatches(pref, exchangeOutflow, snap.address)).toBe(true); // 120 < 200
    expect(memoryMatches(pref, strangerOutflow, snap.address)).toBe(false); // 250 >= 200
    expect(memoryMatches({ ...pref, address: "0xother" }, exchangeOutflow, snap.address)).toBe(false);
    expect(memoryMatches({ type: "label", address: snap.address, verdict: "expected" }, exchangeOutflow, snap.address)).toBe(false);
  });
});
