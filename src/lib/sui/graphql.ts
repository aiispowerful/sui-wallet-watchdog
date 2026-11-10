/**
 * Sui mainnet GraphQL client.
 *
 * Primary endpoint: Tatum's Sui gateway — https://sui-mainnet.gateway.tatum.io/graphql
 * (auth: `x-api-key` header). Tatum's discovery endpoint (`/_methods`, `/llms.txt`) lists
 * GraphQL as the Sui mainnet interface; Sui has deprecated JSON-RPC.
 *
 * Dev-only fallback (no TATUM_API_KEY): the public endpoint https://graphql.mainnet.sui.io/graphql.
 */
import type { WalletTx } from "../types";
import { normalizeAddress, normalizeCoinType, normalizePackageId } from "./normalize";

export interface RawBalance {
  coinType: string;
  totalBalance: string;
}

export const TATUM_SUI_GRAPHQL_URL = "https://sui-mainnet.gateway.tatum.io/graphql";
export const PUBLIC_SUI_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";

const LOWEST_CHECKPOINT_RE = /lowest available checkpoint is (\d+)/i;
const LOWEST_CHECKPOINT = new Map<string, number>();
const META_CACHE = new Map<string, { decimals: number; symbol: string } | null>();

export class SuiGraphQLError extends Error {
  constructor(
    message: string,
    readonly lowestAvailableCheckpoint?: number,
  ) {
    super(message);
    this.name = "SuiGraphQLError";
  }
}

interface GqlTx {
  digest: string;
  sender: { address: string } | null;
  effects: {
    status: string;
    timestamp: string | null;
    gasEffects: { gasSummary: { computationCost: string | number; storageCost: string | number; storageRebate: string | number } } | null;
    balanceChanges: { nodes: Array<{ owner: { address: string } | null; coinType: { repr: string }; amount: string }> };
  } | null;
  kind: {
    __typename: string;
    commands?: { nodes: Array<{ __typename: string; function?: { name: string; module: { name: string; package: { address: string } } } }> };
  } | null;
}

const TX_QUERY = `query WatchdogTxs($a: SuiAddress!, $n: Int!, $after: UInt53) {
  transactions(last: $n, filter: { affectedAddress: $a, afterCheckpoint: $after }) {
    nodes {
      digest
      sender { address }
      effects {
        status
        timestamp
        gasEffects { gasSummary { computationCost storageCost storageRebate } }
        balanceChanges(first: 20) { nodes { owner { address } coinType { repr } amount } }
      }
      kind {
        __typename
        ... on ProgrammableTransaction {
          commands(first: 10) { nodes { __typename ... on MoveCallCommand { function { name module { name package { address } } } } } }
        }
      }
    }
  }
}`;

export class SuiGraphQLClient {
  constructor(
    readonly url: string,
    private readonly apiKey?: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  /** Free Tatum plans are rate limited (HTTP 429): requests are spaced out and 429s retried with backoff. */
  private static nextSlot = 0;
  private readonly minIntervalMs = 340;

  private async throttle(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, SuiGraphQLClient.nextSlot);
    SuiGraphQLClient.nextSlot = slot + this.minIntervalMs;
    if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
  }

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    let res: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (this.apiKey) await this.throttle();
      res = await this.fetchImpl(this.url, { method: "POST", headers, body: JSON.stringify({ query, variables }), cache: "no-store" });
      if (res.status !== 429 && res.status < 500) break;
      const retryAfter = Number(res.headers?.get?.("retry-after"));
      await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt));
    }
    if (!res!.ok) throw new SuiGraphQLError(`Sui GraphQL HTTP ${res!.status} from ${new URL(this.url).host}`);
    res = res!;
    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string; extensions?: { chain?: string[] } }> };
    if (json.errors?.length) {
      const detail = [json.errors[0].message, ...(json.errors[0].extensions?.chain ?? [])].join(": ");
      const m = detail.match(LOWEST_CHECKPOINT_RE);
      throw new SuiGraphQLError(`Sui GraphQL: ${detail}`, m ? Number(m[1]) : undefined);
    }
    return json.data as T;
  }

  async latestCheckpoint(): Promise<number> {
    const d = await this.query<{ checkpoint: { sequenceNumber: number } }>(`{ checkpoint { sequenceNumber } }`);
    return Number(d.checkpoint.sequenceNumber);
  }

  async getBalances(address: string): Promise<RawBalance[]> {
    const d = await this.query<{ address: { balances: { nodes: Array<{ coinType: { repr: string }; totalBalance: string }> } } | null }>(
      `query($a: SuiAddress!) { address(address: $a) { balances(first: 50) { nodes { coinType { repr } totalBalance } } } }`,
      { a: normalizeAddress(address) },
    );
    return (d.address?.balances.nodes ?? []).map((n) => ({ coinType: normalizeCoinType(n.coinType.repr), totalBalance: n.totalBalance }));
  }

  /** Coin metadata for many coin types in ONE request (aliased fields), cached per process. */
  async getCoinMetadataMany(coinTypes: string[]): Promise<Record<string, { decimals: number; symbol: string } | null>> {
    const out: Record<string, { decimals: number; symbol: string } | null> = {};
    const missing = coinTypes.filter((t) => {
      if (META_CACHE.has(t)) out[t] = META_CACHE.get(t)!;
      return !META_CACHE.has(t);
    });
    if (missing.length === 0) return out;
    const fields = missing.map((_, i) => `c${i}: coinMetadata(coinType: $t${i}) { decimals symbol }`).join("\n");
    const vars = Object.fromEntries(missing.map((t, i) => [`t${i}`, t]));
    const decl = missing.map((_, i) => `$t${i}: String!`).join(", ");
    try {
      const d = await this.query<Record<string, { decimals: number; symbol: string } | null>>(`query(${decl}) {\n${fields}\n}`, vars);
      missing.forEach((t, i) => {
        const m = d[`c${i}`] ?? null;
        META_CACHE.set(t, m);
        out[t] = m;
      });
    } catch {
      for (const t of missing) out[t] = null;
    }
    return out;
  }

  /**
   * Most recent transactions affecting the address (sent or received), newest first.
   * Pruned gateways reject ranges below their lowest retained checkpoint; we read that
   * bound from the error and retry once from there.
   */
  async getRecentTransactions(address: string, limit = 25): Promise<WalletTx[]> {
    const vars = { a: normalizeAddress(address), n: Math.min(Math.max(limit, 1), 50) };
    let data: { transactions: { nodes: GqlTx[] } | null };
    try {
      data = await this.query(TX_QUERY, { ...vars, after: LOWEST_CHECKPOINT.get(this.url) ?? null });
    } catch (e) {
      if (e instanceof SuiGraphQLError && e.lowestAvailableCheckpoint !== undefined) {
        LOWEST_CHECKPOINT.set(this.url, e.lowestAvailableCheckpoint);
        data = await this.query(TX_QUERY, { ...vars, after: e.lowestAvailableCheckpoint });
      } else throw e;
    }
    return (data.transactions?.nodes ?? []).map(mapGqlTx).sort((a, b) => b.timestampMs - a.timestampMs);
  }
}

export function mapGqlTx(t: GqlTx): WalletTx {
  const g = t.effects?.gasEffects?.gasSummary;
  return {
    digest: t.digest,
    timestampMs: t.effects?.timestamp ? Date.parse(t.effects.timestamp) : 0,
    sender: t.sender ? normalizeAddress(t.sender.address) : "system",
    success: (t.effects?.status ?? "SUCCESS") === "SUCCESS",
    gasMist: g ? Number(g.computationCost) + Number(g.storageCost) - Number(g.storageRebate) : 0,
    balanceChanges: (t.effects?.balanceChanges.nodes ?? []).map((b) => ({
      owner: b.owner ? normalizeAddress(b.owner.address) : "unknown",
      coinType: normalizeCoinType(b.coinType.repr),
      raw: b.amount,
    })),
    moveCalls: (t.kind?.commands?.nodes ?? [])
      .filter((c) => c.function)
      .map((c) => `${normalizePackageId(c.function!.module.package.address)}::${c.function!.module.name}::${c.function!.name}`),
  };
}

export type { GqlTx };
