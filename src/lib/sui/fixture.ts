/**
 * Deterministic demo wallet used by tests and by the UI when the address "demo" is scanned.
 * Mirrors the shape returned by the live Tatum client so the whole agent pipeline is exercised.
 */
import type { WalletSnapshot, WalletTx } from "../types";

export const DEMO_ADDRESS = "0x" + "d3".repeat(32);
const ME = DEMO_ADDRESS;
const FRIEND = "0x" + "a1".repeat(32); // "rent to flatmate"
const EXCHANGE = "0x" + "e5".repeat(32); // user's own cold wallet
const STRANGER = "0x" + "66".repeat(32); // never seen before
const AIRDROPPER = "0x" + "bb".repeat(32);
const CETUS = "0x" + "1e".repeat(32);
const MINT = "0x" + "99".repeat(32); // trusted NFT mint package
const SCAM_COIN = "0x" + "5c".repeat(32) + "::claim::FREECLAIM";
const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const SUI = "0x2::sui::SUI";

const H = 3_600_000;
const T0 = Date.parse("2026-11-10T06:00:00Z");

function tx(
  i: number,
  hoursAgo: number,
  sender: string,
  changes: Array<[string, string, string]>,
  moveCalls: string[] = [],
  opts: { success?: boolean; gasMist?: number } = {},
): WalletTx {
  return {
    digest: `DEMO${String(i).padStart(4, "0")}${"x".repeat(36)}`,
    timestampMs: T0 - hoursAgo * H,
    sender,
    success: opts.success ?? true,
    gasMist: opts.gasMist ?? 2_000_000,
    balanceChanges: changes.map(([owner, coinType, raw]) => ({ owner, coinType, raw })),
    moveCalls,
  };
}

export function demoSnapshot(): WalletSnapshot {
  const txs: WalletTx[] = [
    tx(1, 1, ME, [[ME, SUI, "-250000000000"], [STRANGER, SUI, "250000000000"]], ["0x2::pay::split_and_transfer"]),
    tx(2, 2, AIRDROPPER, [[ME, SCAM_COIN, "1000000000000"]], [`${AIRDROPPER}::airdrop::spray`]),
    tx(3, 3, ME, [[ME, SUI, "-40000000000"], [ME, USDC, "33500000"]], [`${CETUS}::router::swap`]),
    tx(4, 4, ME, [[ME, SUI, "-30000000000"], [FRIEND, SUI, "30000000000"]], ["0x2::pay::split_and_transfer"]),
    tx(5, 5, ME, [[ME, SUI, "-3000000"]], [`${MINT}::mint::mint_nft`], { success: false }),
    tx(6, 30, ME, [[ME, SUI, "-120000000000"], [EXCHANGE, SUI, "120000000000"]], ["0x2::pay::split_and_transfer"]),
    tx(7, 54, ME, [[ME, SUI, "-30000000000"], [FRIEND, SUI, "30000000000"]], ["0x2::pay::split_and_transfer"]),
    tx(8, 78, ME, [[ME, SUI, "-5000000000"], [ME, USDC, "4200000"]], [`${CETUS}::router::swap`]),
    tx(9, 100, ME, [[ME, SUI, "-10000000000"]], ["0x3::sui_system::request_add_stake"]),
    tx(10, 130, EXCHANGE, [[ME, SUI, "500000000000"]], []),
    tx(11, 160, ME, [[ME, SUI, "-8000000000"], [ME, USDC, "6800000"]], [`${CETUS}::router::swap`]),
    tx(12, 190, ME, [[ME, SUI, "-2000000000"], [FRIEND, SUI, "2000000000"]], ["0x2::pay::split_and_transfer"]),
  ];
  return {
    address: ME,
    source: "fixture",
    fetchedAt: new Date(T0).toISOString(),
    suiUsd: 0.84,
    balances: [
      { coinType: SUI, symbol: "SUI", decimals: 9, raw: "412500000000", amount: 412.5 },
      { coinType: USDC, symbol: "USDC", decimals: 6, raw: "44500000", amount: 44.5 },
      { coinType: SCAM_COIN, symbol: "FREECLAIM", decimals: 9, raw: "1000000000000", amount: 1000 },
    ],
    txs,
    coinMeta: {
      [SUI]: { symbol: "SUI", decimals: 9 },
      [USDC]: { symbol: "USDC", decimals: 6 },
      [SCAM_COIN]: { symbol: "FREECLAIM", decimals: 9 },
    },
  };
}

export const DEMO_PARTIES = { ME, FRIEND, EXCHANGE, COLD_WALLET: EXCHANGE, STRANGER, AIRDROPPER, CETUS, MINT, SCAM_COIN, USDC };
