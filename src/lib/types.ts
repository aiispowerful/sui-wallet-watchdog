/** Core domain types shared by the server (API routes), the agent and the UI. */

export const SUI_COIN_TYPE = "0x2::sui::SUI";

export type DataSource = "tatum" | "sui-graphql" | "fixture";

export interface CoinBalance {
  coinType: string;
  symbol: string;
  decimals: number;
  /** Raw integer amount as a string (base units). */
  raw: string;
  /** Human amount (raw / 10^decimals). */
  amount: number;
  usd?: number;
}

export interface BalanceChange {
  owner: string;
  coinType: string;
  /** Signed raw amount in base units. */
  raw: string;
}

export interface WalletTx {
  digest: string;
  timestampMs: number;
  sender: string;
  success: boolean;
  /** Net gas paid in MIST (computation + storage - rebate). */
  gasMist: number;
  balanceChanges: BalanceChange[];
  /** Move calls as `package::module::function`. */
  moveCalls: string[];
}

export interface WalletSnapshot {
  address: string;
  source: DataSource;
  fetchedAt: string;
  balances: CoinBalance[];
  txs: WalletTx[];
  suiUsd?: number;
  /** Decimals/symbol per coin type, used to humanise balance changes. */
  coinMeta: Record<string, { symbol: string; decimals: number }>;
}

/** Kinds of anomaly the deterministic detector can raise. */
export type CandidateKind =
  | "large_outflow"
  | "new_counterparty"
  | "unknown_token_inflow"
  | "new_contract"
  | "failed_tx"
  | "high_gas"
  | "activity_burst";

export type Severity = "low" | "medium" | "high";

/** A deterministic "this might be unusual" signal — the no-memory baseline. */
export interface Candidate {
  id: string;
  kind: CandidateKind;
  severity: Severity;
  digest?: string;
  timestampMs?: number;
  /** Counterparty address, package id, or coin type depending on the kind. */
  subject?: string;
  /** Human-readable label for subject (symbol, short address, module path). */
  subjectLabel?: string;
  amount?: number;
  symbol?: string;
  summary: string;
}

export type Verdict = "expected" | "suspicious";

/** Structured content of one memory written to Walrus Memory. */
export interface WatchdogMemory {
  type: "label" | "preference";
  address: string;
  verdict?: Verdict;
  kind?: CandidateKind;
  subject?: string;
  subjectLabel?: string;
  /** For preference memories: ignore outflows strictly below this many SUI. */
  minOutflowSui?: number;
  note?: string;
  createdAt?: string;
}

export interface RecalledMemory {
  blobId: string;
  text: string;
  distance: number;
  parsed: WatchdogMemory | null;
  createdAt?: string;
}

export type Decision = "flag" | "suppress";

export interface FlagResult {
  candidate: Candidate;
  decision: Decision;
  severity: Severity;
  reason: string;
  /** blob ids of memories that drove the decision */
  memoryRefs: string[];
}

export interface ScanResult {
  address: string;
  source: DataSource;
  scannedAt: string;
  snapshot: WalletSnapshot;
  /** Baseline: what would be flagged with zero memories. */
  baseline: Candidate[];
  results: FlagResult[];
  memoriesUsed: RecalledMemory[];
  engine: { llm: string; memory: string; usedLlm: boolean; llmError?: string };
  stats: { candidates: number; flagged: number; suppressed: number; escalated: number };
  /** One-sentence LLM assessment, when an LLM is configured. */
  summary?: string;
}
