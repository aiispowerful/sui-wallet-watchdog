import { describe, expect, it } from "vitest";
import { OpenAICompatibleProvider, extractJSON } from "@/lib/llm/provider";
import { getTatumUsdRate } from "@/lib/price/tatum";
import { SuiGraphQLClient } from "@/lib/sui/graphql";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("SuiGraphQLClient (Tatum gateway)", () => {
  it("sends x-api-key and retries from the gateway's lowest available checkpoint", async () => {
    const calls: Array<{ headers: Record<string, string>; body: { variables: Record<string, unknown> } }> = [];
    const fake = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ headers: init.headers as Record<string, string>, body });
      if (calls.length === 1) {
        return json({
          data: { transactions: null },
          errors: [{ message: "Failed to list transactions", extensions: { chain: ["OutOfRange: lowest available checkpoint is 237661232"] } }],
        });
      }
      return json({
        data: {
          transactions: {
            nodes: [
              {
                digest: "D1",
                sender: { address: "0xabc" },
                effects: {
                  status: "SUCCESS",
                  timestamp: "2026-11-10T08:44:28.227Z",
                  gasEffects: { gasSummary: { computationCost: 100, storageCost: 50, storageRebate: 30 } },
                  balanceChanges: { nodes: [{ owner: { address: "0xabc" }, coinType: { repr: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI" }, amount: "-120" }] },
                },
                kind: { __typename: "ProgrammableTransaction", commands: { nodes: [{ __typename: "MoveCallCommand", function: { name: "swap", module: { name: "router", package: { address: "0x00000000000000000000000000000000000000000000000000000000000000ff" } } } }] } },
              },
            ],
          },
        },
      });
    }) as unknown as typeof fetch;
    const c = new SuiGraphQLClient("https://sui-mainnet.gateway.tatum.io/graphql", "k", fake);
    const txs = await c.getRecentTransactions("0xabc", 10);
    expect(calls[0].headers["x-api-key"]).toBe("k");
    expect(calls[1].body.variables.after).toBe(237661232);
    expect(txs[0]).toMatchObject({ digest: "D1", success: true, gasMist: 120, moveCalls: ["0x" + "0".repeat(62) + "ff::router::swap"] });
    expect(txs[0].balanceChanges[0].coinType).toBe("0x2::sui::SUI");
  });
});

describe("Tatum price", () => {
  it("parses the rate", async () => {
    const fake = (async () => json({ value: "0.8438", basePair: "USD", symbol: "SUI" })) as unknown as typeof fetch;
    expect(await getTatumUsdRate("SUI", "k", "https://api.tatum.io", fake)).toBeCloseTo(0.8438);
    const bad = (async () => json({}, 401)) as unknown as typeof fetch;
    expect(await getTatumUsdRate("SUI", "k", "https://api.tatum.io", bad)).toBeUndefined();
  });
});

describe("LLM provider", () => {
  it("extracts JSON from fenced or chatty output", () => {
    expect(extractJSON('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJSON('noise {"b":2} trailing')).toEqual({ b: 2 });
    expect(() => extractJSON("nothing")).toThrow();
  });

  it("retries without response_format for servers that reject it", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fake = (async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body));
      bodies.push(b);
      if (b.response_format) return new Response("response_format not supported", { status: 400 });
      return json({ choices: [{ message: { content: '{"ok":true}' } }] });
    }) as unknown as typeof fetch;
    const p = new OpenAICompatibleProvider("key", "https://example.test/v1", "m", fake);
    expect(await p.completeJSON([{ role: "user", content: "hi" }])).toBe('{"ok":true}');
    expect(bodies).toHaveLength(2);
  });
});
