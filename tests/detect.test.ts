import { describe, expect, it } from "vitest";
import { detectCandidates, counterparties } from "@/lib/agent/detect";
import { DEMO_PARTIES, demoSnapshot } from "@/lib/sui/fixture";
import { normalizeAddress, normalizeCoinType, toHuman } from "@/lib/sui/normalize";

describe("normalize", () => {
  it("pads addresses and shortens framework coin types", () => {
    expect(normalizeAddress("0x5")).toBe("0x" + "0".repeat(63) + "5");
    expect(normalizeCoinType("0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI")).toBe("0x2::sui::SUI");
    expect(toHuman("-250000000000", 9)).toBe(-250);
    expect(() => normalizeAddress("not-an-address")).toThrow();
  });
});

describe("detectCandidates (no-memory baseline)", () => {
  const snap = demoSnapshot();
  const cands = detectCandidates(snap);
  const kinds = (k: string) => cands.filter((c) => c.kind === k);

  it("flags the 250 SUI send to a never-seen address as large + new counterparty", () => {
    const large = kinds("large_outflow").find((c) => c.subject === DEMO_PARTIES.STRANGER);
    expect(large?.amount).toBe(250);
    expect(large?.severity).toBe("high");
    expect(kinds("new_counterparty").some((c) => c.subject === DEMO_PARTIES.STRANGER)).toBe(true);
  });

  it("flags the exchange deposit as a large outflow but not as a new counterparty", () => {
    expect(kinds("large_outflow").some((c) => c.subject === DEMO_PARTIES.EXCHANGE)).toBe(true);
    expect(kinds("new_counterparty").some((c) => c.subject === DEMO_PARTIES.EXCHANGE)).toBe(false);
  });

  it("flags unsolicited unknown tokens and failed txs, but not routine friend transfers", () => {
    expect(kinds("unknown_token_inflow")[0]?.subject).toBe(DEMO_PARTIES.SCAM_COIN);
    expect(kinds("failed_tx")).toHaveLength(1);
    expect(cands.some((c) => c.subject === DEMO_PARTIES.FRIEND)).toBe(false);
  });

  it("produces stable, unique ids sorted by severity", () => {
    const ids = cands.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(detectCandidates(demoSnapshot()).map((c) => c.id)).toEqual(ids);
    const rank = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < cands.length; i++) expect(rank[cands[i].severity]).toBeGreaterThanOrEqual(rank[cands[i - 1].severity]);
  });

  it("finds counterparties from balance changes and sender", () => {
    const t = snap.txs.find((x) => x.sender === DEMO_PARTIES.AIRDROPPER)!;
    expect(counterparties(t, snap.address)).toEqual([DEMO_PARTIES.AIRDROPPER]);
  });

  it("detects bursts of outgoing transactions", () => {
    const s = demoSnapshot();
    const base = s.txs[0];
    s.txs = Array.from({ length: 9 }, (_, i) => ({ ...base, digest: `B${i}`, timestampMs: base.timestampMs + i * 30_000, balanceChanges: [] }));
    expect(detectCandidates(s).some((c) => c.kind === "activity_burst")).toBe(true);
  });
});
