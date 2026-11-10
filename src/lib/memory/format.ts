/**
 * Memory serialisation. Every memory stored in Walrus Memory is one natural-language
 * sentence (good for semantic recall) followed by a machine-readable tag line
 * (good for deterministic rule matching and for showing provenance in the UI):
 *
 *   User marked "large_outflow" involving 0xe5e5…e5e5 on wallet 0xd3d3…d3d3 as EXPECTED. Note: weekly deposit to my exchange.
 *   [watchdog:v1] {"type":"label","address":"0x…","verdict":"expected",...}
 */
import { shortAddress } from "../sui/normalize";
import type { Candidate, CandidateKind, RecalledMemory, Verdict, WatchdogMemory } from "../types";

export const MEMORY_TAG = "[watchdog:v1]";
const KINDS: CandidateKind[] = [
  "large_outflow",
  "new_counterparty",
  "unknown_token_inflow",
  "new_contract",
  "failed_tx",
  "high_gas",
  "activity_burst",
];

export const KIND_LABEL: Record<CandidateKind, string> = {
  large_outflow: "large outflow",
  new_counterparty: "new counterparty",
  unknown_token_inflow: "unknown token received",
  new_contract: "new contract interaction",
  failed_tx: "failed transaction",
  high_gas: "high gas",
  activity_burst: "activity burst",
};

const MAX_NOTE = 280;

export function sanitizeNote(note?: string): string | undefined {
  if (!note) return undefined;
  // Single line, no tag spoofing, bounded length.
  const n = note.replaceAll(MEMORY_TAG, " ").replace(/\s+/g, " ").trim().slice(0, MAX_NOTE);
  return n || undefined;
}

export function labelFromCandidate(address: string, c: Candidate, verdict: Verdict, note?: string): WatchdogMemory {
  return {
    type: "label",
    address,
    verdict,
    kind: c.kind,
    subject: c.subject,
    subjectLabel: c.subjectLabel,
    note: sanitizeNote(note),
    createdAt: new Date().toISOString(),
  };
}

export function describeMemory(m: WatchdogMemory): string {
  const wallet = shortAddress(m.address);
  if (m.type === "preference") {
    const parts: string[] = [];
    if (m.minOutflowSui !== undefined) parts.push(`ignore SUI outflows below ${m.minOutflowSui} SUI`);
    if (m.verdict && m.kind) {
      parts.push(`treat every "${KIND_LABEL[m.kind]}" as ${m.verdict.toUpperCase()}${m.subjectLabel ? ` when it involves ${m.subjectLabel}` : ""}`);
    }
    if (m.note) parts.push(m.note);
    return `User preference for wallet ${wallet}: ${(parts.join("; ") || "(none)").replace(/[.\s]+$/, "")}.`;
  }
  const what = m.kind ? `"${KIND_LABEL[m.kind]}"` : "activity";
  const subj = m.subjectLabel ?? (m.subject ? shortAddress(m.subject) : undefined);
  return `User marked ${what}${subj ? ` involving ${subj}` : ""} on wallet ${wallet} as ${(m.verdict ?? "expected").toUpperCase()}.${m.note ? ` Note: ${m.note}` : ""}`;
}

export function formatMemory(m: WatchdogMemory): string {
  const clean: WatchdogMemory = { ...m, note: sanitizeNote(m.note) };
  return `${describeMemory(clean)}\n${MEMORY_TAG} ${JSON.stringify(clean)}`;
}

export function parseMemory(text: string): WatchdogMemory | null {
  const i = text.lastIndexOf(MEMORY_TAG);
  if (i < 0) return null;
  try {
    const raw = JSON.parse(text.slice(i + MEMORY_TAG.length).trim()) as Partial<WatchdogMemory>;
    if (raw.type !== "label" && raw.type !== "preference") return null;
    if (typeof raw.address !== "string") return null;
    if (raw.verdict && raw.verdict !== "expected" && raw.verdict !== "suspicious") return null;
    if (raw.kind && !KINDS.includes(raw.kind)) return null;
    if (raw.minOutflowSui !== undefined && !(typeof raw.minOutflowSui === "number" && raw.minOutflowSui >= 0)) return null;
    return {
      type: raw.type,
      address: raw.address.toLowerCase(),
      verdict: raw.verdict,
      kind: raw.kind,
      subject: typeof raw.subject === "string" ? raw.subject : undefined,
      subjectLabel: typeof raw.subjectLabel === "string" ? raw.subjectLabel : undefined,
      minOutflowSui: raw.minOutflowSui,
      note: sanitizeNote(typeof raw.note === "string" ? raw.note : undefined),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    };
  } catch {
    return null;
  }
}

/** Human-readable part only (what we show in the UI and give to the LLM). */
export function memoryHeadline(text: string): string {
  const i = text.indexOf(MEMORY_TAG);
  return (i < 0 ? text : text.slice(0, i)).trim();
}

/** Compact memory list for the LLM prompt: `M1: …`. */
export function memoriesForPrompt(memories: RecalledMemory[]): string {
  if (memories.length === 0) return "(no memories yet)";
  return memories.map((m, i) => `M${i + 1}: ${memoryHeadline(m.text)}${m.parsed?.subject ? ` [subject=${m.parsed.subject}]` : ""}`).join("\n");
}

/** Bump when the demo seed profile changes so older, conflicting memories are not recalled. */
export const DEMO_NAMESPACE_VERSION = "v2";
const DEMO_ADDRESS = "0x" + "d3".repeat(32);

export function namespaceFor(prefix: string, address: string): string {
  const normalized = address.toLowerCase();
  const id = normalized.replace(/^0x/, "").slice(0, 16);
  const base = `${prefix}-${id}`;
  return normalized === DEMO_ADDRESS ? `${base}-${DEMO_NAMESPACE_VERSION}` : base;
}
