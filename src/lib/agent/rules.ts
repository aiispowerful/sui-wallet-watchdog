/**
 * Deterministic memory rules. Used (a) as a fallback when no LLM is configured and
 * (b) as a safety guard over the LLM: anything the user has explicitly labelled
 * SUSPICIOUS can never be suppressed by the model, and anything labelled EXPECTED
 * cannot be re-flagged by the model.
 */
import type { Candidate, FlagResult, RecalledMemory, Severity, WatchdogMemory } from "../types";

export function memoryMatches(m: WatchdogMemory, c: Candidate, address: string): boolean {
  if (m.address !== address && m.address !== "*") return false;
  if (m.type === "preference" && m.minOutflowSui !== undefined && c.kind === "large_outflow") {
    return (c.amount ?? Infinity) < m.minOutflowSui;
  }
  if (!m.verdict) return false;
  if (m.kind && m.kind !== c.kind) return false;
  if (m.subject && m.subject !== c.subject) return false;
  // A label with neither kind nor subject is too broad to act on deterministically.
  return Boolean(m.kind || m.subject);
}

export function verdictOf(m: WatchdogMemory): "expected" | "suspicious" {
  if (m.type === "preference" && m.minOutflowSui !== undefined && !m.verdict) return "expected";
  return m.verdict ?? "expected";
}

export function applyRules(candidates: Candidate[], memories: RecalledMemory[], address: string): FlagResult[] {
  return candidates.map((c) => {
    const hits = memories.filter((m) => m.parsed && memoryMatches(m.parsed, c, address));
    const suspicious = hits.filter((m) => verdictOf(m.parsed!) === "suspicious");
    const expected = hits.filter((m) => verdictOf(m.parsed!) === "expected");
    if (suspicious.length) {
      return {
        candidate: c,
        decision: "flag",
        severity: "high" as Severity,
        reason: `You previously marked this pattern as suspicious${suspicious[0].parsed?.note ? ` ("${suspicious[0].parsed.note}")` : ""}.`,
        memoryRefs: suspicious.map((m) => m.blobId),
      };
    }
    if (expected.length) {
      return {
        candidate: c,
        decision: "suppress",
        severity: c.severity,
        reason: `Matches a pattern you approved${expected[0].parsed?.note ? ` ("${expected[0].parsed.note}")` : ""}.`,
        memoryRefs: expected.map((m) => m.blobId),
      };
    }
    return { candidate: c, decision: "flag", severity: c.severity, reason: c.summary, memoryRefs: [] };
  });
}
