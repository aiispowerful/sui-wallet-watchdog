"use client";
import { useState } from "react";
import { KIND_LABEL } from "@/lib/memory/format";
import type { FlagResult, RecalledMemory, Verdict } from "@/lib/types";
import { Badge, SeverityBadge, short } from "./ui";

export interface LabelOutcome {
  verdict: Verdict;
  blobId?: string;
  status: string;
  store: string;
}

export function FlagCard({
  r,
  memories,
  onLabel,
  labelled,
}: {
  r: FlagResult;
  memories: RecalledMemory[];
  onLabel: (r: FlagResult, verdict: Verdict, note: string) => Promise<void>;
  labelled?: LabelOutcome;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Verdict | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const c = r.candidate;
  const cited = memories.filter((m) => r.memoryRefs.includes(m.blobId));
  const suppressed = r.decision === "suppress";

  async function label(v: Verdict) {
    setBusy(v);
    setErr(null);
    try {
      await onLabel(r, v, note);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className={`rounded-xl border p-4 ${suppressed ? "border-slate-800 bg-slate-950/40 opacity-80" : "border-slate-700 bg-slate-950/70"}`}>
      <div className="flex flex-wrap items-center gap-2">
        {suppressed ? <Badge tone="green">suppressed by memory</Badge> : <SeverityBadge severity={r.severity} />}
        <Badge tone="sky">{KIND_LABEL[c.kind]}</Badge>
        {c.timestampMs ? <span className="text-xs text-slate-500">{new Date(c.timestampMs).toLocaleString()}</span> : null}
        {c.digest && !c.digest.startsWith("DEMO") && (
          <a className="ml-auto text-xs text-sky-400 hover:underline" href={`https://suiscan.xyz/mainnet/tx/${c.digest}`} target="_blank" rel="noreferrer">
            tx {short(c.digest, 5)} ↗
          </a>
        )}
      </div>
      <p className="mt-2 break-words text-sm text-slate-200">{r.reason}</p>
      {r.reason !== c.summary && <p className="mt-1 text-xs text-slate-500">Detector: {c.summary}</p>}
      {cited.length > 0 && (
        <ul className="mt-2 space-y-1">
          {cited.map((m) => (
            <li key={m.blobId} className="text-xs text-violet-300">
              🧠 {m.text.split("\n")[0]} <span className="text-slate-600">blob {short(m.blobId, 5)}</span>
            </li>
          ))}
        </ul>
      )}
      {labelled ? (
        <p className="mt-3 text-xs text-emerald-400">
          ✓ Remembered as <b>{labelled.verdict}</b> in {labelled.store === "walrus-mainnet" ? "Walrus Memory (mainnet)" : "mock memory"}
          {labelled.blobId ? ` · blob ${short(labelled.blobId, 6)}` : ` · job ${labelled.status}`}. Re-scan to see the agent apply it.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note, e.g. 'my Binance deposit address'"
            className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-600 focus:outline-none sm:min-w-56 sm:flex-1"
            maxLength={280}
          />
          <div className="flex gap-2">
            <button
              disabled={busy !== null}
              onClick={() => label("expected")}
              className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 sm:flex-none sm:py-1.5"
            >
              {busy === "expected" ? "Check your wallet…" : "✓ Expected"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => label("suspicious")}
              className="flex-1 rounded-lg bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50 sm:flex-none sm:py-1.5"
            >
              {busy === "suspicious" ? "Check your wallet…" : "⚠ Suspicious"}
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-rose-400">{err}</p>}
    </article>
  );
}
