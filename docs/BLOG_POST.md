# The wallet watchdog that remembers: building a learning security agent with Tatum and Walrus Memory

*Built for the Total Recall hackathon (Tatum × Walrus Memory), Smart Agents for Real Life track.*

## The problem: alerts you learn to ignore

Every crypto wallet monitor I've used has the same flaw. On day one it flags your weekly exchange deposit, on day two it flags it again, and by day ten you mute it. That's when the real problem shows up: a drainer, a phishing airdrop, or a transfer to an address you've never seen, and you miss it.

The monitor isn't missing data. It's missing **memory**. It never learns what "normal" means for *you*.

## What Sui Wallet Watchdog does

Watchdog is an AI agent that watches a Sui mainnet wallet:

1. **It reads the chain through Tatum.** Balances, the latest transactions (sent and received), coin metadata and the live SUI/USD price.
2. **It finds anything unusual.** Deterministic detectors look for large outflows (absolute, or relative to the wallet's own median), first-time counterparties, unsolicited unknown tokens (the classic airdrop-phishing setup), calls to never-seen contracts, failed transactions, high gas and bursts of outgoing transactions.
3. **It asks you.** Each flag has two buttons, **✓ Expected** and **⚠ Suspicious**, plus an optional note like "that's my Binance deposit address".
4. **It remembers.** Your answer becomes a memory on **Walrus Memory**, encrypted and stored on Walrus mainnet.
5. **It gets better.** On the next scan the agent recalls the relevant memories, hands them to an LLM with the new candidates, and decides what still deserves your attention. It cites the exact memories it used.

The UI includes a **Before / after memory** panel. On the left is every alert a memory-less watchdog would raise. On the right is what Watchdog decided after recalling your history. Items it has newly learned to ignore get a *learned* badge, and the header shows how many memories it learned from.

## How it uses Tatum

All onchain reads go through Tatum's Sui mainnet gateway with a single API key:

- **Sui gateway (GraphQL)** at `https://sui-mainnet.gateway.tatum.io/graphql`, authenticated with the `x-api-key` header. Sui has deprecated JSON-RPC, and Tatum's discovery endpoint (`/_methods`) lists GraphQL as the Sui mainnet interface, so the agent uses it for:
  - `address.balances` for every coin the wallet holds,
  - `transactions(filter: { affectedAddress })` for recent transactions, including balance changes, gas and Move calls,
  - `coinMetadata` for decimals and symbols, batched into **one** request with GraphQL aliases.
- **Tatum Data API**: `GET /v4/data/rate/symbol?symbol=SUI&basePair=USD` converts balances and outflows to dollars, so a reason reads "Sent 250 SUI (~$210)…".

Two production details mattered. Tatum's free tier is rate limited, so the client spaces out requests and retries `429`s with backoff. The gateway also prunes old history and returns an error naming its lowest retained checkpoint; the client reads that number, caches it, and bounds later queries with `afterCheckpoint`.

## How it uses Walrus Memory

Walrus Memory (the `@mysten-incubation/memwal` SDK) is the agent's long-term memory:

- **Writes:** `remember(text, namespace)` returns a job id right away, and `waitForRememberJob(jobId)` waits until the relayer has embedded the memory, SEAL-encrypted it and uploaded it to Walrus. The UI then shows the **blob id**. The starter profile is written in one call with `rememberBulk` and `waitForRememberJobs`.
- **Reads:** `recall({ query, namespace, limit })` does semantic search. Each scan sends one broad query ("labels and preferences for this wallet") plus one targeted query per suspicious subject ("large outflow involving 0xe5…"), then de-duplicates by blob id.
- **Scoping:** each watched wallet gets its own namespace, so memories never leak between wallets.

Each memory has two parts. The first is a plain-English sentence, which embeds well. The second is a tagged JSON line, which lets a deterministic rules engine act on the memory too:

```
User marked "large outflow" involving 0xe5e5…e5e5 on wallet 0xd3d3…d3d3 as EXPECTED. Note: my exchange deposit address
[watchdog:v1] {"type":"label","verdict":"expected","kind":"large_outflow","subject":"0xe5…", ...}
```

That rules engine does two jobs. It's the fallback when no LLM is configured, and it's a **guardrail**: once you've marked a pattern *suspicious*, the model can never suppress it, however persuasive the transaction data looks.

Beyond per-alert labels, a seed script writes a **12-memory starter security profile**: standing preferences such as "transfers under 5 SUI are routine", "unsolicited tokens are phishing", "a burst of transactions means a leaked key", "I swap on Cetus and DeepBook", and "any outflow above 1,000 SUI is always high severity". The LLM applies these by meaning, not by string match.

## How it learned over time

Here is a real run on the demo wallet:

| Scan | Memories recalled | Alerts without memory | Alerts with memory | What changed |
|---|---|---|---|---|
| 1 | 0 | 6 | 6 | Everything is new. The agent knows nothing about you yet. |
| *(label)* | | | | 120 SUI to `0xe5…` → **Expected** ("my exchange deposit address"); 250 SUI to `0x66…` → **Suspicious** |
| 2 | 2 | 6 | 5 | The exchange deposit is **suppressed** with a 🧠 citation; the stranger transfer is **escalated to high** with your reason attached. |
| *(seed profile + labels)* | | | | Starter profile plus more labels: 14+ memories on Walrus mainnet |
| 3 | 14+ | 6 | fewer, and sharper | The phishing airdrop is escalated by the "unsolicited tokens" preference; routine patterns stay quiet. |

The baseline detectors never change. The memories are the only thing that changes the agent's behaviour. That's the point of the project: the product gets sharper the more you use it, and that knowledge lives in portable, encrypted memory on Walrus, not inside one app's database.

## Architecture

Next.js (App Router, TypeScript) with API route handlers, deployable to Vercel:

```
observe (Tatum) → detect (deterministic baseline) → recall (Walrus Memory) → decide (LLM + guardrail) → learn (Walrus Memory)
```

- The LLM layer is provider-agnostic: anything that speaks the OpenAI Chat Completions format works, and output is validated with zod.
- Each integration has an offline twin (the SDK's `MemWalMock`, public Sui GraphQL, rules-only triage), so the full learning loop is covered by unit tests with no keys.

## What's next

- Scheduled scans with push or Telegram alerts.
- Shared "community memories" for known scam packages, kept separate from a user's private memory.
- Tatum webhooks for real-time monitoring instead of polling.

**Repo:** `<GITHUB_URL>` · **Live demo:** `<DEMO_URL>` · Built with [Tatum](https://tatum.io) and [Walrus Memory](https://memory.walrus.xyz). #TotalRecall @Tatum_io @WalrusFoundation
