"use client";
import { useEffect, useState } from "react";
import { Card, short } from "./ui";

interface MemItem {
  blobId: string;
  headline: string;
  distance: number;
  createdAt?: string;
}

export function MemoryPanel({ address, version, onSaved }: { address: string; version: number; onSaved: () => void }) {
  const [items, setItems] = useState<MemItem[] | null>(null);
  const [store, setStore] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [threshold, setThreshold] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/memories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (!cancelled) {
          setItems(j.memories);
          setStore(j.store);
          setErr(null);
        }
      })
      .catch((e) => !cancelled && setErr(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, [address, version]);

  async function savePref(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { address };
      if (threshold.trim()) body.minOutflowSui = Number(threshold);
      if (note.trim()) body.note = note.trim();
      const r = await fetch("/api/preference", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setThreshold("");
      setNote("");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-100">🧠 What the agent remembers</h2>
      <p className="mb-3 text-xs text-slate-500">{store === "walrus-mainnet" ? "Encrypted on Walrus mainnet via Walrus Memory" : "Local mock memory (no MemWal key)"}</p>
      {err && <p className="mb-2 text-xs text-rose-400">{err}</p>}
      <ul className="max-h-72 space-y-2 overflow-auto pr-1">
        {(items ?? []).map((m) => (
          <li key={m.blobId} className="rounded-lg bg-slate-950/60 p-2 text-xs text-slate-300">
            {m.headline}
            <div className="mt-1 text-[10px] text-slate-600">blob {short(m.blobId, 6)}</div>
          </li>
        ))}
        {items && items.length === 0 && <li className="text-xs text-slate-500">Nothing yet — label a flag to teach the agent.</li>}
      </ul>
      <form onSubmit={savePref} className="mt-4 space-y-2">
        <div className="text-xs font-medium text-slate-400">Add a standing preference</div>
        <input
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          inputMode="decimal"
          placeholder="Ignore SUI outflows below… (e.g. 150)"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Or a note, e.g. 'I only use Cetus for swaps'"
          maxLength={280}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
        />
        <button disabled={saving} className="w-full rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50">
          {saving ? "Writing to Walrus…" : "Remember this"}
        </button>
      </form>
    </Card>
  );
}
