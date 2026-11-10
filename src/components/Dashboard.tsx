"use client";
import dynamic from "next/dynamic";
import { useCurrentAccount, useDAppKit, useWalletConnection } from "@mysten/dapp-kit-react";
import { useCallback, useState } from "react";
import { latchResume, settleResume } from "@/lib/auth/resume";
import { labelMessageFromBody } from "@/lib/auth/messages";
import { walletErrorMessage } from "@/lib/auth/wallet-error";
import { KIND_LABEL } from "@/lib/memory/format";
import type { FlagResult, ScanResult, Verdict } from "@/lib/types";
import { normalizeAddress } from "@/lib/sui/normalize";
import { FlagCard, type LabelOutcome } from "./FlagCard";
import { MemoryPanel } from "./MemoryPanel";
import { useSignedAction } from "./useSignedAction";
import { Badge, Card, Stat, short } from "./ui";

const WalletBar = dynamic(() => import("./WalletBar").then((m) => m.WalletBar), {
  ssr: false,
  loading: () => <span className="text-xs text-slate-500">Loading wallet…</span>,
});

function rateLimitMessage(res: Response, body: { error?: string } | undefined): string {
  const retry = Number(res.headers.get("Retry-After"));
  const minutes = Number.isFinite(retry) && retry > 0 ? Math.max(1, Math.ceil(retry / 60)) : null;
  if (minutes) {
    return `You've reached the scan limit for now. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  return body?.error ?? "You've reached the scan limit for now. Please try again later.";
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 429) throw new Error(rateLimitMessage(res, json));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

export function Dashboard() {
  const [address, setAddress] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [prev, setPrev] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, LabelOutcome>>({});
  const [memVersion, setMemVersion] = useState(0);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [resumeChoice, setResumeChoice] = useState<"continue" | "clear" | null>(null);
  const { requestSignature } = useSignedAction();
  const account = useCurrentAccount();
  const connection = useWalletConnection();
  const kit = useDAppKit();
  const settled = settleResume({
    sessionReady: sessionChecked,
    connectionStatus: connection.status,
    accountAddress: account?.address ?? null,
    sessionAddress,
  });
  const [resumed, setResumed] = useState(latchResume(null, { ready: false, address: null }));
  const nextResume = latchResume(resumed, settled);
  if (nextResume !== resumed) {
    setResumed(nextResume);
  }
  const showResumePrompt = Boolean(nextResume?.ready && nextResume.address && resumeChoice === null);

  const onSession = useCallback((addr: string | null) => {
    setSessionAddress(addr);
    setSessionChecked(true);
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
      try {
        const scoped = normalizeAddress(address);
        const proof = await requestSignature({
          purpose: "label",
          address: scoped,
          buildMessage: (nonce, expiresAt) =>
            labelMessageFromBody(scoped, r.candidate, verdict, note || undefined, nonce, expiresAt),
        });
        const res = await post<{ blobId?: string; status: string; store: string }>("/api/label", {
          address,
          candidate: r.candidate,
          verdict,
          note: note || undefined,
          ...proof,
        });
        setLabels((l) => ({ ...l, [r.candidate.id]: { verdict, ...res } }));
        setMemVersion((v) => v + 1);
      } catch (e) {
        throw new Error(walletErrorMessage(e));
      }
    },
    [address, requestSignature],
  );

  const flagged = scan?.results.filter((r) => r.decision === "flag") ?? [];
  const suppressed = scan?.results.filter((r) => r.decision === "suppress") ?? [];
  const prevFlagged = new Set(prev?.results.filter((r) => r.decision === "flag").map((r) => r.candidate.id) ?? []);
  const newlySuppressed = suppressed.filter((r) => prevFlagged.has(r.candidate.id));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 overflow-x-hidden px-4 py-6 sm:py-8">
      <header className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">🐕 Sui Wallet Watchdog</h1>
          <p className="mt-1 text-sm text-slate-400 sm:max-w-2xl">
            An AI agent that watches a Sui wallet through <b>Tatum</b>, flags unusual activity, and <b>remembers your answers on Walrus Memory</b> — so it
            stops crying wolf about things you already approved.
          </p>
        </div>
        <div className="w-full min-w-0 sm:w-auto sm:shrink-0">
          <WalletBar onSession={onSession} onUseAddress={showResumePrompt ? undefined : setAddress} />
        </div>
      </header>

      {showResumePrompt && nextResume?.address && (
        <Card className="border-sky-800 bg-sky-950/40">
          <p className="text-sm text-slate-100">
            Continue as <span className="font-mono">{short(nextResume.address, 4)}</span>?
          </p>
          <p className="mt-1 text-xs text-slate-400">A previous wallet connection or sign-in was restored. Confirm before we fill the address or show results.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 sm:w-auto"
              onClick={() => {
                if (nextResume?.address) setAddress(nextResume.address);
                setResumeChoice("continue");
              }}
            >
              Continue
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 sm:w-auto"
              onClick={() => {
                void (async () => {
                  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
                  await kit.disconnectWallet().catch(() => undefined);
                  setSessionAddress(null);
                  setSessionChecked(true);
                  setAddress("");
                  setScan(null);
                  setPrev(null);
                  setLabels({});
                  setResumeChoice("clear");
                })();
              }}
            >
              Clear & disconnect
            </button>
          </div>
        </Card>
      )}

      <Card>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!address.trim()) return;
            void runScan();
          }}
        >
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x… Sui address"
            className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-sky-600 focus:outline-none sm:flex-1"
            aria-label="Sui address"
            autoComplete="off"
          />
          <button type="submit" disabled={loading || !address.trim()} className="w-full shrink-0 rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-50 sm:w-auto sm:py-2">
            {loading ? "Scanning…" : scan ? "Re-scan" : "Scan wallet"}
          </button>
        </form>
        {!account && !sessionAddress && (
          <p className="mt-3 text-xs text-slate-500">
            Not connected with a wallet? Reloading this page will clear the address you type. Sign in to keep a session.
          </p>
        )}
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

          {scan.memoryRedacted && (
            <Card className="border-slate-700 bg-slate-900/40">
              <p className="text-sm text-slate-300">
                Memory still shapes these results (suppressed vs flagged), but note text and the memory list are hidden
                because you are not signed in as this wallet
                {sessionAddress ? ` (signed in as ${short(sessionAddress, 4)}).` : "."} Sign in with this address to see your notes.
              </p>
            </Card>
          )}

          {(scan.engine.memory.includes("recall failed") || scan.engine.llmError) && (
            <Card className="border-amber-900 bg-amber-950/30">
              <p className="text-sm text-amber-200">
                ⚠ Degraded mode: {scan.engine.memory.includes("recall failed") ? "memory recall failed, so results show the no-memory baseline. " : ""}
                {scan.engine.llmError ? "The LLM call failed, so the rules engine decided. " : ""}
              </p>
            </Card>
          )}

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
                <div key={r.candidate.id} className="grid grid-cols-1 items-start gap-1 rounded-lg bg-slate-950/50 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3">
                  <span className="min-w-0 break-words text-slate-300 sm:truncate">
                    ⚠ {KIND_LABEL[r.candidate.kind]} {r.candidate.subjectLabel ? `· ${r.candidate.subjectLabel}` : ""}
                    {r.candidate.amount !== undefined ? ` · ${r.candidate.amount} ${r.candidate.symbol ?? ""}` : ""}
                  </span>
                  <span className="hidden text-slate-600 sm:inline">→</span>
                  <span className={`min-w-0 break-words ${r.decision === "flag" ? "text-amber-300" : "text-emerald-400 line-through decoration-emerald-700"}`}>
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
                <p className="mt-1 break-words text-xs text-slate-500">
                  Source: {scan.source === "tatum" ? "Tatum Sui mainnet gateway" : scan.source === "fixture" ? "offline fixture" : "public Sui GraphQL"} ·{" "}
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
            </div>
          </div>
        </>
      )}

      <footer className="px-2 pt-8 pb-2 text-center text-xs leading-relaxed text-slate-600">
        Powered by Tatum · Walrus Memory
      </footer>
    </div>
  );
}
