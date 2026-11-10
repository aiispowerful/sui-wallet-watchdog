/**
 * Seeds the watched wallet's Walrus Memory namespace with a starter "security profile":
 * standing preferences the agent recalls on every scan (≥10 memories on mainnet).
 *
 *   npm run seed -- 0xYOUR_SUI_ADDRESS        (or set WATCH_ADDRESS)
 *   npm run seed -- demo                      (seeds the test-fixture namespace)
 *   npm run seed -- 0x... --dry-run           (print without writing)
 */
import "./env";
import { getConfig, hasMemWal } from "../src/lib/config";
import { formatMemory, namespaceFor } from "../src/lib/memory/format";
import { seedProfile } from "../src/lib/memory/seed-profile";
import { createMemoryStore } from "../src/lib/memory/store";
import { DEMO_ADDRESS } from "../src/lib/sui/fixture";
import { normalizeAddress } from "../src/lib/sui/normalize";

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const input = args.find((a) => !a.startsWith("--")) ?? process.env.WATCH_ADDRESS;
  if (!input) throw new Error("Usage: npm run seed -- <0xSuiAddress> [--dry-run]");
  const address = input.toLowerCase() === "demo" ? DEMO_ADDRESS : normalizeAddress(input);

  const cfg = getConfig();
  const namespace = namespaceFor(cfg.memwalNamespacePrefix, address);
  const texts = seedProfile(address).map(formatMemory);
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
