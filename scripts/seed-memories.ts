/**
 * Seeds the watched wallet's Walrus Memory namespace with a starter "security profile":
 * standing preferences the agent recalls on every scan (≥10 memories on mainnet).
 *
 *   npm run seed -- 0xYOUR_SUI_ADDRESS        (or set WATCH_ADDRESS)
 *   npm run seed -- demo                      (seeds the demo wallet)
 *   npm run seed -- 0x... --dry-run           (print without writing)
 */
import "./env";
import { getConfig, hasMemWal } from "../src/lib/config";
import { formatMemory, namespaceFor } from "../src/lib/memory/format";
import { createMemoryStore } from "../src/lib/memory/store";
import { DEMO_ADDRESS } from "../src/lib/sui/fixture";
import { normalizeAddress } from "../src/lib/sui/normalize";
import type { WatchdogMemory } from "../src/lib/types";

export function starterProfile(address: string): WatchdogMemory[] {
  const p = (m: Omit<WatchdogMemory, "type" | "address">): WatchdogMemory => ({ type: "preference", address, ...m });
  return [
    p({ minOutflowSui: 5, note: "Transfers under 5 SUI are routine for me (gas top-ups, tips, small payments)." }),
    p({ kind: "unknown_token_inflow", verdict: "suspicious", note: "Unsolicited tokens are airdrop phishing bait. Never interact with them." }),
    p({ kind: "activity_burst", verdict: "suspicious", note: "I never send many transactions within minutes; a burst means a drainer or a leaked key." }),
    p({ note: "Staking and unstaking SUI with validators through 0x3::sui_system is normal for me." }),
    p({ note: "I swap on Cetus and DeepBook. Swap/router calls on those DEXes are normal, even if a new pool or version appears." }),
    p({ note: "A single failed transaction is usually slippage on a swap. Flag failures only if they repeat or hit an unknown contract." }),
    p({ note: "Any outflow above 1,000 SUI must always be flagged as high severity, even to addresses I have approved before." }),
    p({ kind: "high_gas", verdict: "expected", note: "I sometimes mint NFTs or create objects; storage-heavy transactions with higher gas are expected." }),
    p({ note: "I live in India (IST, UTC+5:30). Outgoing activity between 1 AM and 6 AM IST is unusual for me." }),
    p({ note: "A first-time recipient receiving more than 100 SUI should be confirmed with me before it is considered safe." }),
    p({ note: "Calls to brand-new or unverified packages that ask to transfer or approve my coins are high risk." }),
    p({ note: "I move savings to my own cold wallet roughly once a week; ask me once, then remember that address." }),
  ];
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const input = args.find((a) => !a.startsWith("--")) ?? process.env.WATCH_ADDRESS;
  if (!input) throw new Error("Usage: npm run seed -- <0xSuiAddress|demo> [--dry-run]");
  const address = input.toLowerCase() === "demo" ? DEMO_ADDRESS : normalizeAddress(input);

  const cfg = getConfig();
  const namespace = namespaceFor(cfg.memwalNamespacePrefix, address);
  const texts = starterProfile(address).map(formatMemory);
  console.log(`Seeding ${texts.length} memories → namespace "${namespace}" (${hasMemWal(cfg) ? "Walrus Memory mainnet" : "MOCK — set MEMWAL_KEY + MEMWAL_ACCOUNT_ID"})`);
  if (dry) {
    texts.forEach((t, i) => console.log(`${i + 1}. ${t.split("\n")[0]}`));
    return;
  }
  if (!hasMemWal(cfg)) console.warn("WARNING: no MemWal credentials; writing to an in-process mock (nothing reaches mainnet).");

  const store = createMemoryStore(cfg);
  const results = await store.rememberMany(texts, namespace);
  results.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.status.padEnd(7)} blob=${r.blobId || "-"}  ${texts[i].split("\n")[0].slice(0, 90)}`));
  const done = results.filter((r) => r.status === "done").length;
  console.log(`\n${done}/${texts.length} memories stored.`);

  const check = await store.recall("what does the user consider suspicious?", namespace, 5);
  console.log(`Recall check: ${check.length} hits; top → ${check[0]?.text.split("\n")[0] ?? "(none)"}`);
  if (done < texts.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
