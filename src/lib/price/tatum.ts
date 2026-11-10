/** Tatum Data API — exchange rate by symbol (GET /v4/data/rate/symbol). */
export async function getTatumUsdRate(
  symbol: string,
  apiKey: string,
  baseUrl = "https://api.tatum.io",
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): Promise<number | undefined> {
  try {
    const url = `${baseUrl}/v4/data/rate/symbol?symbol=${encodeURIComponent(symbol)}&basePair=USD`;
    const res = await fetchImpl(url, { headers: { "x-api-key": apiKey, accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { value?: string };
    const v = Number(j.value);
    return Number.isFinite(v) && v > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}
