"use client";
import { useCallback, useEffect, useState } from "react";
import { KIND_LABEL } from "@/lib/memory/format";
import type { FlagResult, ScanResult, Verdict } from "@/lib/types";
import { FlagCard, type LabelOutcome } from "./FlagCard";
import { MemoryPanel } from "./MemoryPanel";
import { Badge, Card, Stat, short } from "./ui";

interface Status {
  tatum: string;
  tatumConfigured: boolean;
  memory: string;
  memoryConfigured: boolean;
  llm: string;
  llmConfigured: boolean;
  defaultAddress: string | null;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

export function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [address, setAddress] = useState("demo");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [prev, setPrev] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, LabelOutcome>>({});
  const [memVersion, setMemVersion] = useState(0);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: Status) => {
        setStatus(s);
        if (s.defaultAddress) setAddress(s.defaultAddress);
      })
      .catch(() => undefined);
  }, []);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await post<ScanResult>("/api/scan", { address });
      setPrev((p) => (scan && scan.address === r.address ? scan : p && p.address === r.address ? p : null));
      setScan(r);
      setLabels({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [address, scan]);

  const onLabel = useCallback(
    async (r: FlagResult, verdict: Verdict, note: string) => {
      const res = await post<{ blobId?: string; status: string; store: string }>("/api/label", {
        address,
        candidate: r.candidate,
        verdict,
        note: note || undefined,
      });
      setLabels((l) => ({ ...l, [r.candidate.id]: { verdict, ...res } }));
      setMemVersion((v) => v + 1);
    },
    [address],
  );

  const flagged = scan?.results.filter((r) => r.decision === "flag") ?? [];
  const suppressed = scan?.results.filter((r) => r.decision === "suppress") ?? [];
  const prevFlagged = new Set(prev?.results.filter((r) => r.decision === "flag").map((r) => r.candidate.id) ?? []);
  const newlySuppressed = suppressed.filter((r) => prevFlagged.has(r.candidate.id));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">🐕 Sui Wallet Watchdog</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            An AI agent that watches a Sui wallet through <b>Tatum</b>, flags unusual activity, and <b>remembers your answers on Walrus Memory</b> — so it
            stops crying wolf about things you already approved.
          </p>
        </div>
        {status && (
          <div className="flex flex-col items-end gap-1 text-xs">
            <Badge tone={status.tatumConfigured ? "green" : "amber"}>⛓ {status.tatum}</Badge>
            <Badge tone={status.memoryConfigured ? "violet" : "amber"}>🧠 {status.memory}</Badge>
            <Badge tone={status.llmConfigured ? "sky" : "amber"}>🤖 {status.llm}</Badge>
          </div>
        )}
      </header>

      <Card>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runScan();
          }}
        >
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x… Sui address, or 'demo'"
            className="min-w-72 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-sky-600 focus:outline-none"
            aria-label="Sui address"
          />
          <button type="submit" disabled={loading} className="rounded-lg bg-sky-600 px-5 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50">
            {loading ? "Scanning…" : scan ? "Re-scan" : "Scan wallet"}
          </button>
          <button type="button" onClick={() => setAddress("demo")} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Use demo wallet
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </Card>

      {scan && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Without memory" value={scan.stats.candidates} hint="alerts a naive watchdog raises" />
            <Stat label="With Walrus Memory" value={scan.stats.flagged} hint="alerts that still need you" tone="text-amber-300" />
            <Stat label="Suppressed" value={scan.stats.suppressed} hint="matched patterns you approved" tone="text-emerald-300" />
            <Stat label="Learned from" value={`${scan.memoriesUsed.length} memories`} hint={short(scan.engine.memory.split(":").slice(1).join(":"), 14)} tone="text-violet-300" />
          </div>

          {scan.summary && (
            <Card className="border-sky-900 bg-sky-950/30">
              <p className="text-sm text-sky-200">🤖 {scan.summary}</p>
            </Card>
          )}

          <Card>
            <h2 className="text-lg font-semibold text-slate-100">Before / after memory</h2>
            <p className="mb-3 text-xs text-slate-500">
              Left: every detector hit (what you&apos;d see with an empty memory). Right: what the agent decided after recalling your labels.
              {prev && newlySuppressed.length > 0 && (
                <span className="ml-1 text-emerald-400">Since your last scan the agent learned to stop flagging {newlySuppressed.length} item(s).</span>
              )}
            </p>
            <div className="grid gap-2 text-sm">
              {scan.results.map((r) => (
                <div key={r.candidate.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-slate-950/50 px-3 py-2">
                  <span className="truncate text-slate-300">
                    ⚠ {KIND_LABEL[r.candidate.kind]} {r.candidate.subjectLabel ? `· ${r.candidate.subjectLabel}` : ""}
                    {r.candidate.amount !== undefined ? ` · ${r.candidate.amount} ${r.candidate.symbol ?? ""}` : ""}
                  </span>
                  <span className="text-slate-600">→</span>
                  <span className={r.decision === "flag" ? "text-amber-300" : "text-emerald-400 line-through decoration-emerald-700"}>
                    {r.decision === "flag" ? `still flagged (${r.severity})` : "suppressed"}
                    {r.memoryRefs.length > 0 && <span className="ml-2 text-xs text-violet-300 no-underline">🧠×{r.memoryRefs.length}</span>}
                    {prevFlagged.has(r.candidate.id) && r.decision === "suppress" && <Badge tone="green">learned</Badge>}
                  </span>
                </div>
              ))}
              {scan.results.length === 0 && <p className="text-slate-500">No unusual activity in the recent window. 🎉</p>}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">Needs your attention ({flagged.length})</h2>
              {flagged.map((r) => (
                <FlagCard key={r.candidate.id} r={r} memories={scan.memoriesUsed} onLabel={onLabel} labelled={labels[r.candidate.id]} />
              ))}
              {suppressed.length > 0 && (
                <details className="rounded-xl border border-slate-800 p-3">
                  <summary className="cursor-pointer text-sm text-slate-400">Suppressed by memory ({suppressed.length})</summary>
                  <div className="mt-3 space-y-3">
                    {suppressed.map((r) => (
                      <FlagCard key={r.candidate.id} r={r} memories={scan.memoriesUsed} onLabel={onLabel} labelled={labels[r.candidate.id]} />
                    ))}
                  </div>
                </details>
              )}
            </div>
            <div className="space-y-6">
              <Card>
                <h2 className="mb-2 text-lg font-semibold text-slate-100">Wallet</h2>
                <p className="break-all font-mono text-xs text-slate-400">{scan.address}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Source: {scan.source === "tatum" ? "Tatum Sui mainnet gateway" : scan.source === "fixture" ? "demo fixture" : "public Sui GraphQL"} ·{" "}
                  {scan.snapshot.txs.length} txs{scan.snapshot.suiUsd ? ` · SUI $${scan.snapshot.suiUsd.toFixed(3)}${scan.source === "tatum" ? " (Tatum Data API)" : ""}` : ""}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {scan.snapshot.balances.slice(0, 8).map((b) => (
                    <li key={b.coinType} className="flex justify-between gap-2">
                      <span className="text-slate-300">{b.symbol}</span>
                      <span className="font-mono text-slate-200">
                        {b.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        {b.usd ? <span className="ml-2 text-slate-500">${b.usd.toFixed(2)}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <MemoryPanel address={address} version={memVersion} onSaved={() => setMemVersion((v) => v + 1)} />
              <p className="text-xs text-slate-600">
                Engine: {scan.engine.llm}
                {scan.engine.usedLlm ? "" : " (rules)"} · {scan.engine.memory}
                {scan.engine.llmError ? ` · LLM error: ${scan.engine.llmError}` : ""}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
