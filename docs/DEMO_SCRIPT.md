# Demo video script (target 2:30)

**Setup before recording:** keys in `.env.local`, `npm run seed -- demo` already run (≥10 memories on the demo v2 namespace, including labelled approvals), browser at the app with the zoom at 110%. Have the Walrus Memory dashboard open in a second tab.

| # | Time | Shot (screen) | Voice-over |
|---|---|---|---|
| 1 | 0:00–0:15 | App header with the three green or violet badges (Tatum, Walrus Memory mainnet, LLM). | "Wallet monitors cry wolf. After the tenth alert about a transfer to your own cold wallet, you mute it, and then you miss the drainer. This is Sui Wallet Watchdog, an agent that remembers what you've told it." |
| 2 | 0:15–0:40 | Type `demo` and click **Scan**. Show the stats row: Without memory 6, With Walrus Memory 3, Suppressed 3. | "It reads balances and recent transactions through Tatum's Sui gateway, and prices them with Tatum's Data API. Deterministic detectors find six things worth a look. Then it recalls your memories from Walrus, and three of those alerts disappear." |
| 3 | 0:40–1:05 | Expand *Suppressed by memory*. Point at the 120 SUI cold-wallet transfer, the trusted mint, and the failed mint, each with a 🧠 citation. | "This 120 SUI transfer is a weekly move to my own cold wallet. This NFT mint package is one I already trust, and a single failed mint is just slippage. The agent cites the exact Walrus Memory blob it used for each one." |
| 4 | 1:05–1:30 | Scroll the still-flagged cards: 250 SUI to 0x6666…, the new counterparty, and the FREECLAIM airdrop. | "What stays flagged is the stuff I haven't approved: 250 SUI to an address I've never seen, and an unsolicited FREECLAIM token — classic airdrop phishing. Those still need me." |
| 5 | 1:30–1:55 | On a flagged card, type a short note and click **✓ Expected** or **⚠ Suspicious**. Zoom in on the "Remembered … blob" line, then **Re-scan**. | "I can still teach it live. Each answer is written back to Walrus Memory. On the next scan the new label is applied, and a guardrail stops the model from reversing anything I've marked expected or suspicious." |
| 6 | 1:55–2:15 | Open the right-hand memory panel and, optionally, add a standing preference. | "Standing preferences work the same way: one sentence, stored on Walrus — 'transfers under 5 SUI are routine', 'I swap on Cetus and DeepBook', and so on." |
| 7 | 2:15–2:30 | Terminal: `npm test` (green) and `npm run check` (all ✔). End on the README architecture diagram. | "Tatum for onchain data, Walrus Memory for what it learns, and an LLM that reasons with your history. The repo, blog post and setup are linked below." |

**B-roll / captions:** show `Without memory: 6 → With Walrus Memory: 3 (3 suppressed)` as an on-screen caption during shots 2–3.

**Fallback if the LLM key isn't available:** everything above still works in rules-only mode; the reasons will be the template text instead of LLM prose.
