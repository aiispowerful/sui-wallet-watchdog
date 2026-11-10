/**
 * Deterministic anomaly detector. Produces *candidates* — the "no memory" baseline of
 * what a naive watchdog would flag. The memory-aware agent then decides which of these
 * really deserve the user's attention.
 */
import { SUI_COIN_TYPE, type Candidate, type CandidateKind, type Severity, type WalletSnapshot, type WalletTx } from "../types";
import { coinSymbolFromType, shortAddress, toHuman } from "../sui/normalize";

export interface DetectOptions {
  /** How many of the newest transactions count as "new activity" to judge. */
  recentWindow: number;
  /** Absolute SUI outflow that is always considered large. */
  largeOutflowSui: number;
  /** Relative: outflow larger than this multiple of the median past outflow is large. */
  outflowMedianMultiple: number;
  /** Net gas (SUI) above which a tx is considered expensive. */
  highGasSui: number;
  /** Sent-tx count within burstWindowMs that counts as a burst. */
  burstCount: number;
  burstWindowMs: number;
  /** Coin types considered "known" (inflows of anything else are suspicious airdrops). */
  knownCoinTypes: string[];
}

export const DEFAULT_DETECT_OPTIONS: DetectOptions = {
  recentWindow: 10,
  largeOutflowSui: 100,
  outflowMedianMultiple: 5,
  highGasSui: 0.1,
  burstCount: 8,
  burstWindowMs: 10 * 60_000,
  knownCoinTypes: [SUI_COIN_TYPE, "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"],
};

const FRAMEWORK_PACKAGES = new Set(["0x1", "0x2", "0x3"]);

export function candidateId(kind: CandidateKind, digest: string | undefined, subject: string | undefined): string {
  return [kind, digest ?? "-", subject ?? "-"].join(":");
}

function meta(snapshot: WalletSnapshot, coinType: string) {
  return snapshot.coinMeta[coinType] ?? { symbol: coinSymbolFromType(coinType), decimals: 9 };
}

/** Net change of a coin for the watched address in one tx (human units). */
export function netChange(tx: WalletTx, address: string, coinType: string, decimals: number): number {
  return tx.balanceChanges
    .filter((c) => c.owner === address && c.coinType === coinType)
    .reduce((s, c) => s + toHuman(c.raw, decimals), 0);
}

/** Other addresses involved in a tx: recipients of our outflow, or the sender of an inflow. */
export function counterparties(tx: WalletTx, address: string): string[] {
  const set = new Set<string>();
  for (const c of tx.balanceChanges) {
    if (c.owner !== address && c.owner.startsWith("0x")) set.add(c.owner);
  }
  if (tx.sender !== address && tx.sender.startsWith("0x")) set.add(tx.sender);
  return [...set];
}

export function packagesOf(tx: WalletTx): string[] {
  return [...new Set(tx.moveCalls.map((m) => m.split("::")[0]).filter((p) => !FRAMEWORK_PACKAGES.has(p)))];
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function sev(n: number): Severity {
  return n >= 2 ? "high" : n >= 1 ? "medium" : "low";
}

export function detectCandidates(snapshot: WalletSnapshot, opts: Partial<DetectOptions> = {}): Candidate[] {
  const o = { ...DEFAULT_DETECT_OPTIONS, ...opts };
  const me = snapshot.address;
  const txs = [...snapshot.txs].sort((a, b) => b.timestampMs - a.timestampMs);
  const recent = txs.slice(0, o.recentWindow);
  const out: Candidate[] = [];
  const push = (c: Omit<Candidate, "id">) => {
    const id = candidateId(c.kind, c.digest, c.subject);
    if (!out.some((x) => x.id === id)) out.push({ ...c, id });
  };

  const suiDecimals = meta(snapshot, SUI_COIN_TYPE).decimals;
  const outflows = txs.map((t) => -netChange(t, me, SUI_COIN_TYPE, suiDecimals)).filter((v) => v > 0);

  // How often each counterparty / package appears across the whole fetched history.
  const cpCount = new Map<string, number>();
  const pkgCount = new Map<string, number>();
  for (const t of txs) {
    for (const cp of counterparties(t, me)) cpCount.set(cp, (cpCount.get(cp) ?? 0) + 1);
    for (const p of packagesOf(t)) pkgCount.set(p, (pkgCount.get(p) ?? 0) + 1);
  }

  for (const t of recent) {
    const sentByMe = t.sender === me;
    const cps = counterparties(t, me);
    const recipient = cps.find((cp) => t.balanceChanges.some((c) => c.owner === cp && BigInt(c.raw) > BigInt(0))) ?? cps[0];

    // 1. Large SUI outflow (absolute or relative to this wallet's own history).
    const outSui = -netChange(t, me, SUI_COIN_TYPE, suiDecimals);
    if (sentByMe && outSui > 0) {
      const others = outflows.filter((v) => v !== outSui);
      const med = median(others);
      const relLarge = med > 0 && outSui >= o.outflowMedianMultiple * med && outSui >= 10;
      if (outSui >= o.largeOutflowSui || relLarge) {
        const usd = snapshot.suiUsd ? ` (~$${(outSui * snapshot.suiUsd).toFixed(0)})` : "";
        push({
          kind: "large_outflow",
          severity: outSui >= o.largeOutflowSui * 2 ? "high" : "medium",
          digest: t.digest,
          timestampMs: t.timestampMs,
          subject: recipient,
          subjectLabel: recipient ? shortAddress(recipient) : undefined,
          amount: round(outSui),
          symbol: "SUI",
          summary: `Sent ${round(outSui)} SUI${usd}${recipient ? ` to ${shortAddress(recipient)}` : ""}${med ? `, ${(outSui / med).toFixed(1)}x the wallet's median outflow` : ""}.`,
        });
      }
    }

    // 2. First-time counterparty.
    for (const cp of cps) {
      if ((cpCount.get(cp) ?? 0) <= 1 && sentByMe) {
        push({
          kind: "new_counterparty",
          severity: outSui >= o.largeOutflowSui ? "high" : "medium",
          digest: t.digest,
          timestampMs: t.timestampMs,
          subject: cp,
          subjectLabel: shortAddress(cp),
          summary: `First interaction with ${shortAddress(cp)} in the recent history.`,
        });
      }
    }

    // 3. Unknown token received from someone else (classic airdrop/phishing pattern).
    for (const c of t.balanceChanges) {
      if (c.owner === me && BigInt(c.raw) > BigInt(0) && !o.knownCoinTypes.includes(c.coinType) && !sentByMe) {
        const m = meta(snapshot, c.coinType);
        push({
          kind: "unknown_token_inflow",
          severity: "medium",
          digest: t.digest,
          timestampMs: t.timestampMs,
          subject: c.coinType,
          subjectLabel: m.symbol,
          amount: round(toHuman(c.raw, m.decimals)),
          symbol: m.symbol,
          summary: `Received ${round(toHuman(c.raw, m.decimals))} unsolicited ${m.symbol} from ${shortAddress(t.sender)} — common airdrop-phishing pattern.`,
        });
      }
    }

    // 4. Interaction with a package not seen elsewhere in history.
    if (sentByMe) {
      for (const p of packagesOf(t)) {
        if ((pkgCount.get(p) ?? 0) <= 1) {
          const call = t.moveCalls.find((m) => m.startsWith(p + "::")) ?? p;
          const [, mod, fn] = call.split("::");
          push({
            kind: "new_contract",
            severity: "low",
            digest: t.digest,
            timestampMs: t.timestampMs,
            subject: p,
            subjectLabel: `${shortAddress(p)}::${mod ?? "?"}::${fn ?? "?"}`,
            summary: `Called a contract not seen before: ${shortAddress(p)}::${mod ?? "?"}::${fn ?? "?"}.`,
          });
        }
      }
    }

    // 5. Failed transaction sent by the wallet.
    if (sentByMe && !t.success) {
      push({
        kind: "failed_tx",
        severity: "low",
        digest: t.digest,
        timestampMs: t.timestampMs,
        subject: packagesOf(t)[0],
        subjectLabel: t.moveCalls[0],
        summary: `Transaction failed${t.moveCalls[0] ? ` calling ${t.moveCalls[0].split("::").slice(1).join("::")}` : ""} — possible bad approval or griefing.`,
      });
    }

    // 6. Expensive gas.
    const gasSui = t.gasMist / 1e9;
    if (sentByMe && gasSui >= o.highGasSui) {
      push({
        kind: "high_gas",
        severity: "low",
        digest: t.digest,
        timestampMs: t.timestampMs,
        amount: round(gasSui),
        symbol: "SUI",
        summary: `Paid ${round(gasSui)} SUI net gas in one transaction.`,
      });
    }
  }

  // 7. Burst of outgoing transactions.
  const sent = recent.filter((t) => t.sender === me).map((t) => t.timestampMs).sort((a, b) => a - b);
  for (let i = 0; i + o.burstCount - 1 < sent.length; i++) {
    if (sent[i + o.burstCount - 1] - sent[i] <= o.burstWindowMs) {
      push({
        kind: "activity_burst",
        severity: sev(1),
        timestampMs: sent[i + o.burstCount - 1],
        amount: o.burstCount,
        summary: `${o.burstCount}+ outgoing transactions within ${Math.round(o.burstWindowMs / 60_000)} minutes (bot or drainer-like pattern).`,
      });
      break;
    }
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (b.timestampMs ?? 0) - (a.timestampMs ?? 0));
}

function round(n: number): number {
  return Math.abs(n) >= 100 ? Math.round(n * 100) / 100 : Math.round(n * 10_000) / 10_000;
}
