/** Live smoke test of every external integration. `npm run check [-- 0xAddress]` */
import "./env";
import { getConfig, hasMemWal } from "../src/lib/config";
import { OpenAICompatibleProvider } from "../src/lib/llm/provider";
import { namespaceFor } from "../src/lib/memory/format";
import { createMemoryStore } from "../src/lib/memory/store";
import { getTatumUsdRate } from "../src/lib/price/tatum";
import { makeSuiClient } from "../src/lib/sui/snapshot";

async function step(name: string, fn: () => Promise<string>) {
  const t = Date.now();
  try {
    console.log(`✔ ${name}: ${await fn()} (${Date.now() - t} ms)`);
  } catch (e) {
    console.log(`✘ ${name}: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

async function main() {
  const cfg = getConfig();
  const address = process.argv[2] ?? cfg.defaultAddress;
  const { client, source } = makeSuiClient(cfg);
  await step(`Sui checkpoint via ${source}`, async () => String(await client.latestCheckpoint()));
  if (address) {
    await step("balances", async () => `${(await client.getBalances(address)).length} coin types`);
    await step("recent transactions", async () => `${(await client.getRecentTransactions(address, 10)).length} txs`);
  }
  if (cfg.tatumApiKey) await step("Tatum Data API SUI/USD", async () => String(await getTatumUsdRate("SUI", cfg.tatumApiKey!, cfg.tatumDataUrl)));
  const mem = createMemoryStore(cfg);
  await step(`memory health (${hasMemWal(cfg) ? "walrus" : "mock"})`, async () => JSON.stringify(await mem.health()));
  if (address) {
    await step("memory recall", async () => `${(await mem.recall("user labels and preferences", namespaceFor(cfg.memwalNamespacePrefix, address), 5)).length} hits`);
  }
  if (cfg.llmApiKey) {
    const llm = new OpenAICompatibleProvider(cfg.llmApiKey, cfg.llmBaseUrl, cfg.llmModel);
    await step(`LLM ${llm.name}`, async () => (await llm.completeJSON([{ role: "user", content: 'Reply with {"ok":true}' }])).slice(0, 60));
  } else console.log("- LLM: not configured (rules-only mode)");
}

main();
