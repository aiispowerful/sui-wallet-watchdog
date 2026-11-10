# Demo video script (target 2:30)

**Setup before recording:** keys in `.env.local`, `npm run seed -- demo` already run (12 memories on mainnet), browser at the app with the zoom at 110%. Have the Walrus Memory dashboard open in a second tab.

| # | Time | Shot (screen) | Voice-over |
|---|---|---|---|
| 1 | 0:00–0:15 | App header with the three green or violet badges (Tatum, Walrus Memory mainnet, LLM). | "Wallet monitors cry wolf. After the tenth alert about your own exchange deposit, you mute it, and then you miss the drainer. This is Sui Wallet Watchdog, an agent that remembers what you've told it." |
| 2 | 0:15–0:35 | Type `demo` (or a real address) and click **Scan**. Show the stats row and the Wallet card with USD values. | "It reads balances and recent transactions from Sui mainnet through Tatum's Sui gateway, and prices them with Tatum's Data API. Deterministic detectors find six things worth a look: a 250 SUI transfer to a stranger, a phishing airdrop, a failed mint, and so on." |
| 3 | 0:35–0:55 | Hover the **Before / after memory** panel and the "Learned from N memories" stat. Open the right-hand memory panel. | "Before deciding anything, it recalls memories from Walrus Memory. These are encrypted on Walrus mainnet: my starter security profile, like 'unsolicited tokens are phishing' or 'transfers under 5 SUI are routine'." |
| 4 | 0:55–1:25 | On the 120 SUI exchange outflow card, type "my exchange deposit address" and click **✓ Expected**. Zoom in on the "Remembered … blob 0x…" line. On the 250 SUI stranger card click **⚠ Suspicious**. | "Now I teach it. This 120 SUI transfer is my exchange deposit, so it's expected. The 250 SUI to an address I've never seen, I didn't do that, so it's suspicious. Each answer is written to Walrus Memory, and here's the blob id." |
| 5 | 1:25–1:55 | Click **Re-scan**. Show the before/after panel: one row struck through with **learned**, and the stranger row now **high**. Expand *Suppressed by memory* to show the 🧠 citation. | "Re-scan. The deposit is suppressed, and the agent cites the exact memory it used. The suspicious transfer is escalated to high, and the model can't override that because a guardrail keeps anything you call suspicious flagged." |
| 6 | 1:55–2:15 | In the memory panel, type `150` in "Ignore SUI outflows below…", click **Remember this**, and re-scan. Show the count drop. | "Standing preferences work the same way. One sentence, stored on Walrus, and the agent gets quieter about what's normal for me and stricter about what isn't." |
| 7 | 2:15–2:30 | Terminal: `npm test` (green) and `npm run check` (all ✔). End on the README architecture diagram. | "Tatum for onchain data, Walrus Memory for what it learns, and an LLM that reasons with your history. The repo, blog post and setup are linked below." |

**B-roll / captions:** show `Without memory: 6 → With Walrus Memory: 4` as an on-screen caption during shot 5.

**Fallback if the LLM key isn't available:** everything above still works in rules-only mode; the reasons will be the template text instead of LLM prose.
