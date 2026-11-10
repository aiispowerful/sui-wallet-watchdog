# Security model

## What is public

`POST /api/scan` stays public. On-chain Sui activity is already public, and the watchdog's job as a demo is to let anyone try a scan.

## What is not

Writing labels (`/api/label`) or preferences (`/api/preference`), and reading `/api/memories`, require proof of ownership of that address:

1. **Session.** Sign in with Sui: the server issues a nonce, the wallet signs a personal message (`signPersonalMessage`, no gas) that includes the site domain, address, nonce, issued-at and expiry. The server verifies the signature with `@mysten/sui`'s `verifyPersonalMessageSignature` (Ed25519, and also zkLogin / multisig / passkey / secp schemes that helper supports). A successful sign-in sets an httpOnly, `Secure`, `SameSite=Lax` session cookie: a stateless HMAC-signed token (`SESSION_SECRET`) bound to that address, valid for about 12 hours. Sign-out clears the cookie.
2. **Per-action approval.** Each label (expected or suspicious) and each preference write requires a *new* personal-message signature over a human-readable sentence built from the request body (kind, subject, tx digest, verdict, note, nonce, expiry). The server rebuilds that sentence, requires an exact match with the signed text, and checks that the signature address equals the session address equals the body address. Only then does it write to Walrus Memory. The signature is stored on the memory as `proof` so judges can see the authorization artifact.

## Stateless nonces (serverless tradeoff)

Nonces are HMAC-signed tokens with a 5-minute expiry, a purpose (`login` / `label` / `preference`), and (for actions) the bound address. They do **not** live in a shared store, so they work across Netlify serverless instances.

The tradeoff: without a replay cache, a captured *unused* nonce can be submitted again until it expires. Login replay only issues another session for the same address. Action replay could write a duplicate memory. The signature must still come from the owner, the TTL is short, and we accept this over running Redis on the free plan.

## Unauthenticated scans

If you scan a real address without a session for that address, memory still influences flag vs suppress (so the "before / after memory" demo remains honest), but:

- `memoriesUsed` is emptied (`memoryRedacted: true`, `memoriesUsedCount` keeps the count)
- note text is stripped from reasons and the LLM summary
- blob id refs on each result are left in place so the UI can show "suppressed by memory" without showing what the owner wrote

## Cookie and CSRF

The session cookie is httpOnly (not readable by JavaScript), `Secure` on HTTPS, and `SameSite=Lax` (not sent on cross-site POSTs). Action endpoints also require a fresh wallet signature, which a cross-site attacker cannot produce.

## First load and address privacy

The landing form never pre-fills a wallet address. `WATCH_ADDRESS` is not included in `/api/status`. A typed address is not written to `localStorage`, `sessionStorage`, or the URL, so a reload clears it unless the user is connected or signed in.

If autoconnect or a session cookie restores an address, the UI asks **Continue as 0x…?** before filling the field or showing results. **Clear & disconnect** signs out, disconnects the wallet, and clears the form.

## Mobile and the Slush app

On a phone browser there is no wallet-standard extension, so choosing a generic "Slush" row would only start the Slush *web* wallet (a `my.slush.app` popup), not the installed app.

When we detect a mobile browser with no injected wallet, the picker shows a primary **Open in Slush app** link. That is the official universal link `https://my.slush.app/browse/<dapp-url>` ([Slush deep linking docs](https://sdk.mystenlabs.com/slush-wallet/deep-linking)), which opens this site in Slush's in-app browser when the app is installed. A **Get Slush** link points at the official App Store or Play Store listing. The web-wallet option stays available, labeled **Slush web wallet (sign in with Google/passkey)**.

Inside Slush's in-app browser the wallet is injected via Wallet Standard, so the picker lists it and `signPersonalMessage` uses that provider. The Slush web-wallet metadata is served from `/slush-wallet-metadata.json` because `https://api.slush.app/api/wallet/metadata` is CORS-blocked from this origin.
