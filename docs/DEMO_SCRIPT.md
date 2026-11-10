# Demo video script (target 2:30)

**Setup before recording:** keys in `.env.local`, `npm run seed -- 0xYOUR_ADDRESS` already run if you want a starter profile on the wallet you'll scan, browser at the live app (https://sui-wallet-watchdog.netlify.app) with the zoom at 110%. Have a Sui wallet (Slush or another wallet-standard wallet) ready. Optionally keep the Walrus Memory dashboard open in a second tab.

| Shot | Time | What you show | What you say |
|---|---|---|---|
| 1 | 0:00–0:15 | Landing page: empty address box, Connect Wallet, and the footer line “Powered by Tatum · Walrus Memory”. | "Sui Wallet Watchdog is an agent that watches a Sui wallet, flags unusual activity, and remembers your answers on Walrus Memory so it stops crying wolf." |
| 2 | 0:15–0:40 | Click **Connect Wallet**, sign in, then **Scan**. Show the stats row filling in. | "I connect a wallet and sign in with Sui — that's a personal message, no gas. It reads balances and recent transactions through Tatum's Sui gateway, and prices them with Tatum's Data API. Deterministic detectors find anything worth a look. Then it recalls memories from Walrus and applies them." |
| 3 | 0:40–1:05 | Point at the **Before / after memory** panel, then expand *Suppressed by memory* if any items were suppressed. | "The left column is every detector hit — what you'd see with an empty memory. The right column is what the agent decided after recalling your history. Anything it has already learned to trust is suppressed, and it cites the exact Walrus Memory blob it used." |
| 4 | 1:05–1:30 | Scroll the still-flagged cards. | "What stays flagged is the stuff I haven't approved: a large outflow to a new address, an unsolicited token, a first-time contract — those still need me." |
| 5 | 1:30–1:55 | On a flagged card, type a short note and click **✓ Expected** or **⚠ Suspicious**. Show the wallet signature prompt, then the "Remembered … blob" line, then **Re-scan**. | "I can teach it live. This click asks the wallet to sign a personal message — no gas — that names the pattern and the verdict. The signed answer is written back to Walrus Memory. On the next scan the new label is applied, and a guardrail stops the model from reversing anything I've marked expected or suspicious." |
| 6 | 1:55–2:15 | Open the right-hand memory panel and, optionally, add a standing preference (that also opens a wallet prompt). | "Standing preferences work the same way: one sentence, approved by the wallet, stored on Walrus — 'transfers under 5 SUI are routine', 'I swap on Cetus and DeepBook', and so on." |
| 7 | 2:15–2:30 | Terminal: `npm test` (green) and `npm run check` (all ✔). End on the README architecture diagram. | "Tatum for onchain data, Walrus Memory for what it learns, and an LLM that reasons with your history. The repo, blog post and setup are linked below." |

**B-roll / captions:** if the scanned wallet has memory hits, show `Without memory: N → With Walrus Memory: M (K suppressed)` as an on-screen caption during shots 2–3. The test suite also walks a scripted fixture through this loop (six baseline alerts, three suppressed after labelled approvals).

**Fallback if the LLM key isn't available:** everything above still works in rules-only mode; the reasons will be the template text instead of LLM prose.

**Mobile:** on a phone, tap **Connect Wallet**, then **Open in Slush app**, so the site opens in Slush's in-app browser for sign-in and approvals.
