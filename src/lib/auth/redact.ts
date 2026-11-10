import type { RecalledMemory, ScanResult } from "../types";

function stripNotes(text: string, notes: string[]): string {
  let out = text.replace(/\s*\("[^"]*"\)/g, "");
  for (const note of notes) {
    if (note && out.includes(note)) out = out.split(note).join("[redacted]");
  }
  return out;
}

/**
 * Public (unauthenticated) scan of someone else's wallet: memory still influences
 * flag/suppress decisions, but note text and the memory list are withheld. Counts
 * and opaque memoryRefs stay so the UI can show "suppressed by memory" without
 * leaking what the owner wrote.
 */
export function redactScanForPublic(scan: ScanResult): ScanResult {
  const notes = scan.memoriesUsed.map((m) => m.parsed?.note).filter((n): n is string => Boolean(n));
  return {
    ...scan,
    memoriesUsed: [] as RecalledMemory[],
    memoryRedacted: true,
    memoriesUsedCount: scan.memoriesUsed.length,
    results: scan.results.map((r) => ({ ...r, reason: stripNotes(r.reason, notes) })),
    summary: scan.summary ? stripNotes(scan.summary, notes) : scan.summary,
  };
}
