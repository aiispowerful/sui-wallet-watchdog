/**
 * The Watchdog agent loop:
 *
 *   observe  → Tatum Sui RPC snapshot (balances, recent txs, SUI/USD)
 *   detect   → deterministic candidates (the "no-memory" baseline)
 *   recall   → semantic recall of the user's past labels from Walrus Memory
 *   decide   → LLM triage with memories in context (rules engine as fallback + guard)
 *   learn    → user labels flags; labels are written back to Walrus Memory (see label.ts)
 */
import type { AppConfig } from "../config";
import type { LLMProvider } from "../llm/provider";
import { extractJSON } from "../llm/provider";
import { KIND_LABEL, namespaceFor } from "../memory/format";
import type { MemoryStore } from "../memory/store";
import type { Candidate, FlagResult, RecalledMemory, ScanResult, WalletSnapshot } from "../types";
import { detectCandidates, type DetectOptions } from "./detect";
import { DecisionSchema, SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { applyRules } from "./rules";

export interface ScanDeps {
  cfg: AppConfig;
  memory: MemoryStore;
  llm?: LLMProvider;
  getSnapshot: (address: string) => Promise<WalletSnapshot>;
  detect?: Partial<DetectOptions>;
}

export interface ScanOptions {
  /** Skip memory recall entirely, i.e. what the agent would say with an empty memory. */
  withoutMemory?: boolean;
}

const MAX_RECALL_QUERIES = 12;

/** Queries used to recall relevant memories: one broad, plus one per distinct candidate subject/kind. */
export function recallQueries(address: string, candidates: Candidate[]): string[] {
  const q = new Set<string>([`wallet ${address} user labels and preferences: expected or suspicious activity`]);
  for (const c of candidates) {
    q.add(`${KIND_LABEL[c.kind]}${c.subject ? ` involving ${c.subject}` : ""}${c.subjectLabel ? ` (${c.subjectLabel})` : ""}`);
    if (q.size >= MAX_RECALL_QUERIES) break;
  }
  return [...q];
}

export async function recallMemories(memory: MemoryStore, namespace: string, address: string, candidates: Candidate[]): Promise<RecalledMemory[]> {
  const queries = recallQueries(address, candidates);
  const settled = await Promise.allSettled(queries.map((q, i) => memory.recall(q, namespace, i === 0 ? 25 : 6)));
  const byBlob = new Map<string, RecalledMemory>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const m of s.value) {
      const prev = byBlob.get(m.blobId);
      if (!prev || m.distance < prev.distance) byBlob.set(m.blobId, m);
    }
  }
  if (byBlob.size === 0 && settled.every((s) => s.status === "rejected")) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }
  // Keep only memories about this wallet (or global ones); unparseable free-text memories are kept for the LLM.
  return [...byBlob.values()]
    .filter((m) => !m.parsed || m.parsed.address === address || m.parsed.address === "*")
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 30);
}

/** Merge LLM output with deterministic rules. Explicit user labels always win. */
export function mergeDecisions(ruleResults: FlagResult[], llmRaw: unknown, memories: RecalledMemory[]): FlagResult[] {
  const parsed = DecisionSchema.parse(llmRaw);
  const byId = new Map(parsed.decisions.map((d) => [d.id, d]));
  const refToBlob = (ref: string) => {
    const n = Number(ref.replace(/^M/i, ""));
    return Number.isInteger(n) && n >= 1 && n <= memories.length ? memories[n - 1].blobId : undefined;
  };
  return ruleResults.map((r) => {
    const d = byId.get(r.candidate.id);
    if (!d) return r; // model skipped it → keep deterministic decision
    const labelled = r.memoryRefs.length > 0;
    const guardSuspicious = labelled && r.decision === "flag" && r.severity === "high";
    if (guardSuspicious && d.decision === "suppress") return r;
    // An EXPECTED label (or matching threshold preference) cannot be re-flagged by the model.
    if (labelled && r.decision === "suppress" && d.decision === "flag") return r;
    const refs = d.memory_refs.map(refToBlob).filter((x): x is string => Boolean(x));
    return {
      candidate: r.candidate,
      decision: d.decision,
      severity: guardSuspicious ? "high" : d.severity,
      reason: d.reason || r.reason,
      memoryRefs: refs.length ? refs : d.decision === r.decision ? r.memoryRefs : [],
    };
  });
}

export async function runScan(address: string, deps: ScanDeps, opts: ScanOptions = {}): Promise<ScanResult> {
  const snapshot = await deps.getSnapshot(address);
  const addr = snapshot.address;
  const baseline = detectCandidates(snapshot, deps.detect);
  const namespace = namespaceFor(deps.cfg.memwalNamespacePrefix, addr);

  let memories: RecalledMemory[] = [];
  let memoryError: string | undefined;
  if (!opts.withoutMemory && baseline.length > 0) {
    try {
      memories = await recallMemories(deps.memory, namespace, addr, baseline);
    } catch (e) {
      memoryError = e instanceof Error ? e.message : String(e);
    }
  }

  let results = applyRules(baseline, memories, addr);
  let usedLlm = false;
  let llmError: string | undefined;
  let summary: string | undefined;
  if (deps.llm && baseline.length > 0) {
    try {
      const raw = await deps.llm.completeJSON([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(snapshot, baseline, memories) },
      ]);
      const json = extractJSON(raw);
      results = mergeDecisions(results, json, memories);
      summary = DecisionSchema.parse(json).summary;
      usedLlm = true;
    } catch (e) {
      llmError = e instanceof Error ? e.message : String(e);
    }
  }

  const flagged = results.filter((r) => r.decision === "flag");
  const rank = { high: 0, medium: 1, low: 2 } as const;
  results = [...results].sort(
    (a, b) => (a.decision === b.decision ? 0 : a.decision === "flag" ? -1 : 1) || rank[a.severity] - rank[b.severity],
  );

  return {
    address: addr,
    source: snapshot.source,
    scannedAt: new Date().toISOString(),
    snapshot,
    baseline,
    results,
    memoriesUsed: memories,
    engine: {
      llm: deps.llm?.name ?? "rules-only (no LLM key)",
      memory: `${deps.memory.kind}:${namespace}${memoryError ? ` (recall failed: ${memoryError})` : ""}`,
      usedLlm,
      llmError,
    },
    stats: {
      candidates: baseline.length,
      flagged: flagged.length,
      suppressed: results.length - flagged.length,
      escalated: results.filter((r) => r.decision === "flag" && r.severity === "high" && r.candidate.severity !== "high").length,
    },
    summary,
  };
}
