/** Builds a WalletSnapshot from Tatum (primary) or the public endpoint (dev fallback). */
import type { AppConfig } from "../config";
import { getTatumUsdRate } from "../price/tatum";
import { SUI_COIN_TYPE, type CoinBalance, type WalletSnapshot } from "../types";
import { demoSnapshot } from "./fixture";
import { PUBLIC_SUI_GRAPHQL_URL, SuiGraphQLClient } from "./graphql";
import { coinSymbolFromType, normalizeAddress, toHuman } from "./normalize";

const WELL_KNOWN: Record<string, { symbol: string; decimals: number }> = {
  [SUI_COIN_TYPE]: { symbol: "SUI", decimals: 9 },
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": { symbol: "USDC", decimals: 6 },
};

export function isDemoAddress(address: string): boolean {
  return address.trim().toLowerCase() === "demo";
}

export function makeSuiClient(cfg: AppConfig): { client: SuiGraphQLClient; source: "tatum" | "sui-graphql" } {
  if (cfg.tatumApiKey) return { client: new SuiGraphQLClient(cfg.tatumGraphqlUrl, cfg.tatumApiKey), source: "tatum" };
  if (!cfg.allowPublicFallback) throw new Error("TATUM_API_KEY is not set (and ALLOW_PUBLIC_SUI_FALLBACK=false).");
  return { client: new SuiGraphQLClient(PUBLIC_SUI_GRAPHQL_URL), source: "sui-graphql" };
}

export async function getWalletSnapshot(addressInput: string, cfg: AppConfig, txLimit = 25): Promise<WalletSnapshot> {
  if (isDemoAddress(addressInput)) return demoSnapshot();
  const address = normalizeAddress(addressInput);
  const { client, source } = makeSuiClient(cfg);

  // Gateway calls are throttled inside the client; the price call goes to a different Tatum API.
  const pricePromise = cfg.tatumApiKey ? getTatumUsdRate("SUI", cfg.tatumApiKey, cfg.tatumDataUrl) : Promise.resolve(undefined);
  const rawBalances = await client.getBalances(address);
  const txs = await client.getRecentTransactions(address, txLimit);
  const suiUsd = await pricePromise;

  // Resolve decimals/symbols for every coin type we will display or reason about.
  const coinTypes = new Set<string>(rawBalances.map((b) => b.coinType));
  for (const t of txs) for (const c of t.balanceChanges) coinTypes.add(c.coinType);
  const unknown = [...coinTypes].filter((ct) => !WELL_KNOWN[ct]).slice(0, 40);
  const fetched = unknown.length ? await client.getCoinMetadataMany(unknown) : {};
  const coinMeta: WalletSnapshot["coinMeta"] = {};
  for (const ct of coinTypes) {
    coinMeta[ct] = WELL_KNOWN[ct] ?? fetched[ct] ?? { symbol: coinSymbolFromType(ct), decimals: 9 };
  }

  const balances: CoinBalance[] = rawBalances
    .map((b) => {
      const meta = coinMeta[b.coinType] ?? { symbol: coinSymbolFromType(b.coinType), decimals: 9 };
      const amount = toHuman(b.totalBalance, meta.decimals);
      return {
        coinType: b.coinType,
        symbol: meta.symbol,
        decimals: meta.decimals,
        raw: b.totalBalance,
        amount,
        usd: b.coinType === SUI_COIN_TYPE && suiUsd ? amount * suiUsd : undefined,
      };
    })
    .sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0) || b.amount - a.amount);

  return { address, source, fetchedAt: new Date().toISOString(), balances, txs, suiUsd, coinMeta };
}
