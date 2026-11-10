/**
 * Slush deep links and wallet classification.
 *
 * Deep link format (official docs):
 *   https://sdk.mystenlabs.com/slush-wallet/deep-linking
 *
 * Recommended universal link (opens the native app when installed, otherwise
 * the Slush web app):
 *   https://my.slush.app/browse/https://your-dapp.com
 *
 * Official examples leave the target URL unencoded in the path (they also
 * document slush://browse/https://…, which only works if the app is installed).
 * We follow the my.slush.app form. If the dApp URL itself has a query or hash,
 * the target is encodeURIComponent'd so those characters are not parsed as part
 * of the outer URL.
 */

export const SLUSH_BROWSE_PREFIX = "https://my.slush.app/browse/";
export const SLUSH_DOWNLOAD = "https://slush.app/download";
export const SLUSH_APP_STORE = "https://apps.apple.com/us/app/slush-wallet/id6476572140";
export const SLUSH_PLAY_STORE = "https://play.google.com/store/apps/details?id=com.mystenlabs.suiwallet";

/** Wallet Standard id of the Slush *web* wallet registered by @mysten/slush-wallet. */
export const SLUSH_WEB_WALLET_ID = "com.mystenlabs.suiwallet.web";
/** Wallet Standard id of the Slush browser extension / in-app injected wallet. */
export const SLUSH_INJECTED_WALLET_ID = "com.mystenlabs.suiwallet";

const MOBILE_UA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

export function isMobileBrowser(userAgent: string): boolean {
  return MOBILE_UA.test(userAgent);
}

export function isSlushWebWallet(wallet: { id?: string | null }): boolean {
  return wallet.id === SLUSH_WEB_WALLET_ID;
}

/** True if any Wallet Standard wallet is an injected extension or in-app provider (not the Slush web wallet). */
export function hasInjectedWallet(wallets: { id?: string | null }[]): boolean {
  return wallets.some((w) => !isSlushWebWallet(w));
}

/**
 * Show the "Open in Slush app" deep-link CTA only in a standalone mobile
 * browser that has no injected wallet (extensions are not available there).
 */
export function shouldOfferSlushAppDeepLink(userAgent: string, wallets: { id?: string | null }[]): boolean {
  return isMobileBrowser(userAgent) && !hasInjectedWallet(wallets);
}

export function slushAppBrowseLink(dappUrl: string): string {
  const parsed = new URL(dappUrl);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("dApp URL must be http(s)");
  }
  const path = parsed.pathname === "/" ? "" : parsed.pathname;
  const target = `${parsed.origin}${path}${parsed.search}`;
  const encoded = parsed.search || parsed.hash ? encodeURIComponent(target) : target;
  return `${SLUSH_BROWSE_PREFIX}${encoded}`;
}

/** App Store on iOS, Play Store on Android, otherwise the official download page (both stores). */
export function slushGetAppLink(userAgent: string): string {
  if (/iphone|ipad|ipod/i.test(userAgent)) return SLUSH_APP_STORE;
  if (/android/i.test(userAgent)) return SLUSH_PLAY_STORE;
  return SLUSH_DOWNLOAD;
}

export function slushWebWalletLabel(): string {
  return "Slush web wallet (sign in with Google/passkey)";
}
