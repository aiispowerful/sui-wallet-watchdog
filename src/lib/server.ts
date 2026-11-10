import "server-only";
import { getConfig, hasMemWal } from "./config";
import { OpenAICompatibleProvider, type LLMProvider } from "./llm/provider";
import { createMemoryStore } from "./memory/store";
import { getWalletSnapshot } from "./sui/snapshot";
import type { ScanDeps } from "./agent/scan";

export function getDeps(): ScanDeps {
  const cfg = getConfig();
  const llm: LLMProvider | undefined = cfg.llmApiKey ? new OpenAICompatibleProvider(cfg.llmApiKey, cfg.llmBaseUrl, cfg.llmModel) : undefined;
  return {
    cfg,
    memory: createMemoryStore(cfg),
    llm,
    getSnapshot: (address) => getWalletSnapshot(address, cfg),
  };
}

export function integrationStatus() {
  const cfg = getConfig();
  return {
    tatum: cfg.tatumApiKey ? "Tatum Sui mainnet gateway" : "public Sui GraphQL (dev fallback — set TATUM_API_KEY)",
    tatumConfigured: Boolean(cfg.tatumApiKey),
    memory: hasMemWal(cfg) ? `Walrus Memory mainnet (${new URL(cfg.memwalServerUrl).host})` : "in-memory MemWalMock (set MEMWAL_KEY + MEMWAL_ACCOUNT_ID)",
    memoryConfigured: hasMemWal(cfg),
    llm: cfg.llmApiKey ? `${cfg.llmModel} @ ${new URL(cfg.llmBaseUrl).host}` : "rules-only (set OPENAI_API_KEY)",
    llmConfigured: Boolean(cfg.llmApiKey),
    defaultAddress: cfg.defaultAddress ?? null,
  };
}
