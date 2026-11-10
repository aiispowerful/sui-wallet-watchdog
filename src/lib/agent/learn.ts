/** The "learn" half of the loop: turn user feedback into Walrus Memory writes. */
import { describeMemory, formatMemory, labelFromCandidate, namespaceFor, sanitizeNote } from "../memory/format";
import type { MemoryStore, StoredMemory } from "../memory/store";
import type { Candidate, Verdict, WatchdogMemory } from "../types";

export interface LearnResult extends StoredMemory {
  namespace: string;
  text: string;
  headline: string;
}

export async function rememberLabel(
  memory: MemoryStore,
  prefix: string,
  address: string,
  candidate: Candidate,
  verdict: Verdict,
  note?: string,
): Promise<LearnResult> {
  const m = labelFromCandidate(address, candidate, verdict, note);
  return write(memory, prefix, m);
}

export async function rememberPreference(
  memory: MemoryStore,
  prefix: string,
  address: string,
  pref: Pick<WatchdogMemory, "minOutflowSui" | "note" | "kind" | "verdict" | "subject" | "subjectLabel">,
): Promise<LearnResult> {
  const m: WatchdogMemory = { type: "preference", address, ...pref, note: sanitizeNote(pref.note), createdAt: new Date().toISOString() };
  return write(memory, prefix, m);
}

async function write(memory: MemoryStore, prefix: string, m: WatchdogMemory): Promise<LearnResult> {
  const namespace = namespaceFor(prefix, m.address);
  const text = formatMemory(m);
  const stored = await memory.remember(text, namespace, { wait: true, timeoutMs: 40_000 });
  return { ...stored, namespace, text, headline: describeMemory(m) };
}
