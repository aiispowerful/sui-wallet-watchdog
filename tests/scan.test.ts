import { MemWalMock } from "@mysten-incubation/memwal";
import { describe, expect, it } from "vitest";
import { rememberLabel, rememberPreference } from "@/lib/agent/learn";
import { runScan, type ScanDeps } from "@/lib/agent/scan";
import { getConfig } from "@/lib/config";
import type { LLMProvider } from "@/lib/llm/provider";
import { MemWalStore } from "@/lib/memory/store";
import { DEMO_PARTIES, demoSnapshot } from "@/lib/sui/fixture";

function deps(llm?: LLMProvider): ScanDeps {
  const cfg = getConfig({});
  const mock = MemWalMock.create({ namespace: cfg.memwalNamespacePrefix });
  return { cfg, memory: new MemWalStore(mock as never, "mock"), llm, getSnapshot: async () => demoSnapshot() };
}

describe("agent learning loop (MemWalMock + rules)", () => {
  it("stops flagging a pattern after the user labels it expected", async () => {
    const d = deps();
    const before = await runScan("demo", d);
    expect(before.memoriesUsed).toHaveLength(0);
    const target = before.results.find((r) => r.candidate.kind === "large_outflow" && r.candidate.subject === DEMO_PARTIES.EXCHANGE)!;
    expect(target.decision).toBe("flag");

    const saved = await rememberLabel(d.memory, d.cfg.memwalNamespacePrefix, before.address, target.candidate, "expected", "my exchange deposit");
    expect(saved.status).toBe("done");
    expect(saved.blobId).toBeTruthy();

    const after = await runScan("demo", d);
    const again = after.results.find((r) => r.candidate.id === target.candidate.id)!;
    expect(again.decision).toBe("suppress");
    expect(again.memoryRefs).toContain(saved.blobId);
    expect(after.stats.flagged).toBe(before.stats.flagged - 1);
    expect(after.memoriesUsed.length).toBeGreaterThan(0);
  });

  it("threshold preferences suppress small large-outflows", async () => {
    const d = deps();
    await rememberPreference(d.memory, d.cfg.memwalNamespacePrefix, demoSnapshot().address, { minOutflowSui: 200 });
    const r = await runScan("demo", d);
    const ex = r.results.find((x) => x.candidate.kind === "large_outflow" && x.candidate.subject === DEMO_PARTIES.EXCHANGE)!;
    const st = r.results.find((x) => x.candidate.kind === "large_outflow" && x.candidate.subject === DEMO_PARTIES.STRANGER)!;
    expect(ex.decision).toBe("suppress");
    expect(st.decision).toBe("flag");
  });

  it("withoutMemory returns the pure baseline", async () => {
    const d = deps();
    const r0 = await runScan("demo", d);
    await rememberLabel(d.memory, d.cfg.memwalNamespacePrefix, r0.address, r0.baseline[0], "expected");
    const r = await runScan("demo", d, { withoutMemory: true });
    expect(r.stats.flagged).toBe(r.stats.candidates);
  });
});

describe("LLM triage", () => {
  it("uses LLM decisions, maps memory refs, and never lets the LLM suppress a suspicious label", async () => {
    let prompt = "";
    const d = deps();
    const r0 = await runScan("demo", d);
    const scam = r0.baseline.find((c) => c.kind === "unknown_token_inflow")!;
    const failed = r0.baseline.find((c) => c.kind === "failed_tx")!;
    await rememberLabel(d.memory, d.cfg.memwalNamespacePrefix, r0.address, scam, "suspicious", "phishing");

    d.llm = {
      name: "fake",
      async completeJSON(messages) {
        prompt = messages[1].content;
        return "```json\n" + JSON.stringify({
          decisions: [
            { id: scam.id, decision: "suppress", severity: "low", reason: "looks fine", memory_refs: ["M1"] },
            { id: failed.id, decision: "suppress", severity: "low", reason: "Failed mints are harmless.", memory_refs: [] },
          ],
          summary: "One phishing token, otherwise normal.",
        }) + "\n```";
      },
    };
    const r = await runScan("demo", d);
    expect(prompt).toContain("MEMORIES recalled from Walrus Memory");
    expect(prompt).toMatch(/M1: User marked "unknown token received"/);
    expect(r.engine.usedLlm).toBe(true);
    expect(r.summary).toBe("One phishing token, otherwise normal.");
    expect(r.results.find((x) => x.candidate.id === scam.id)).toMatchObject({ decision: "flag", severity: "high" });
    expect(r.results.find((x) => x.candidate.id === failed.id)).toMatchObject({ decision: "suppress", reason: "Failed mints are harmless." });
  });

  it("falls back to rules when the LLM fails", async () => {
    const d = deps({ name: "broken", completeJSON: async () => "I am not JSON" });
    const r = await runScan("demo", d);
    expect(r.engine.usedLlm).toBe(false);
    expect(r.engine.llmError).toMatch(/JSON/);
    expect(r.stats.flagged).toBe(r.stats.candidates);
  });
});
