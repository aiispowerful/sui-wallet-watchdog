/**
 * Starter memories written by `npm run seed`. The test-fixture address also gets
 * labelled approvals so unit tests can show memory suppressing alerts the user
 * previously approved, while genuinely new risks stay flagged.
 */
import { DEMO_ADDRESS, DEMO_PARTIES } from "../sui/fixture";
import { shortAddress } from "../sui/normalize";
import type { WatchdogMemory } from "../types";

const p = (address: string, m: Omit<WatchdogMemory, "type" | "address">): WatchdogMemory => ({
  type: "preference",
  address,
  ...m,
});

const label = (address: string, m: Omit<WatchdogMemory, "type" | "address">): WatchdogMemory => ({
  type: "label",
  address,
  ...m,
});

export function starterProfile(address: string): WatchdogMemory[] {
  return [
    p(address, { minOutflowSui: 5, note: "Transfers under 5 SUI are routine for me (gas top-ups, tips, small payments)." }),
    p(address, { kind: "unknown_token_inflow", verdict: "suspicious", note: "Unsolicited tokens are airdrop phishing bait. Never interact with them." }),
    p(address, { kind: "activity_burst", verdict: "suspicious", note: "I never send many transactions within minutes; a burst means a drainer or a leaked key." }),
    p(address, { note: "Staking and unstaking SUI with validators through 0x3::sui_system is normal for me." }),
    p(address, { note: "I swap on Cetus and DeepBook. Swap/router calls on those DEXes are normal, even if a new pool or version appears." }),
    p(address, { note: "A single failed transaction is usually slippage on a swap. Flag failures only if they repeat or hit an unknown contract." }),
    p(address, { note: "Any outflow above 1,000 SUI must always be flagged as high severity, even to addresses I have approved before." }),
    p(address, { kind: "high_gas", verdict: "expected", note: "I sometimes mint NFTs or create objects; storage-heavy transactions with higher gas are expected." }),
    p(address, { note: "I live in India (IST, UTC+5:30). Outgoing activity between 1 AM and 6 AM IST is unusual for me." }),
    p(address, { note: "A first-time recipient receiving more than 100 SUI should be confirmed with me before it is considered safe." }),
    p(address, { note: "Calls to brand-new or unverified packages that ask to transfer or approve my coins are high risk." }),
    p(address, { note: "I move savings to my own cold wallet roughly once a week; ask me once, then remember that address." }),
  ];
}

/** Demo-only labelled approvals / warnings that match the fixture's six baseline alerts. */
export function demoApprovals(address: string): WatchdogMemory[] {
  const cold = DEMO_PARTIES.EXCHANGE;
  const mint = DEMO_PARTIES.MINT;
  return [
    label(address, {
      verdict: "expected",
      kind: "large_outflow",
      subject: cold,
      subjectLabel: shortAddress(cold),
      note: "This is my own cold wallet. Weekly savings transfers here are expected.",
    }),
    label(address, {
      verdict: "expected",
      kind: "new_contract",
      subject: mint,
      subjectLabel: `${shortAddress(mint)}::mint::mint_nft`,
      note: "NFT mint package I trust.",
    }),
    label(address, {
      verdict: "expected",
      kind: "failed_tx",
      subject: mint,
      subjectLabel: `${shortAddress(mint)}::mint::mint_nft`,
      note: "A single failed mint is usually slippage and is expected.",
    }),
  ];
}

export function seedProfile(address: string): WatchdogMemory[] {
  const base = starterProfile(address);
  if (address.toLowerCase() === DEMO_ADDRESS) return [...base, ...demoApprovals(address)];
  return base;
}
