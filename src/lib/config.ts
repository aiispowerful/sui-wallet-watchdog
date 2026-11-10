/**
 * Central, server-only view of environment configuration.
 * Everything is optional so the app builds and runs (in demo mode) without keys.
 */
export interface AppConfig {
  tatumApiKey?: string;
  tatumGraphqlUrl: string;
  tatumDataUrl: string;
  memwalKey?: string;
  memwalAccountId?: string;
  memwalServerUrl: string;
  memwalNamespacePrefix: string;
  llmApiKey?: string;
  llmBaseUrl: string;
  llmModel: string;
  allowPublicFallback: boolean;
  defaultAddress?: string;
}

export function getConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const blank = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  return {
    tatumApiKey: blank(env.TATUM_API_KEY) ?? blank(env.TATUM_MAINNET_API_KEY),
    tatumGraphqlUrl: blank(env.TATUM_SUI_GRAPHQL_URL) ?? "https://sui-mainnet.gateway.tatum.io/graphql",
    tatumDataUrl: blank(env.TATUM_DATA_URL) ?? "https://api.tatum.io",
    memwalKey: blank(env.MEMWAL_KEY) ?? blank(env.MEMWAL_PRIVATE_KEY),
    memwalAccountId: blank(env.MEMWAL_ACCOUNT_ID),
    memwalServerUrl: blank(env.MEMWAL_SERVER_URL) ?? "https://relayer.memory.walrus.xyz",
    memwalNamespacePrefix: blank(env.MEMWAL_NAMESPACE_PREFIX) ?? "sui-watchdog",
    llmApiKey: blank(env.OPENAI_API_KEY) ?? blank(env.LLM_API_KEY),
    llmBaseUrl: (blank(env.OPENAI_BASE_URL) ?? blank(env.LLM_BASE_URL) ?? "https://api.openai.com/v1").replace(/\/+$/, ""),
    llmModel: blank(env.LLM_MODEL) ?? blank(env.OPENAI_MODEL) ?? "gpt-4o-mini",
    allowPublicFallback: (blank(env.ALLOW_PUBLIC_SUI_FALLBACK) ?? "true") !== "false",
    defaultAddress: blank(env.WATCH_ADDRESS),
  };
}

export function hasMemWal(c: AppConfig): boolean {
  return Boolean(c.memwalKey && c.memwalAccountId);
}
