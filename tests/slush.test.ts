import { describe, expect, it } from "vitest";
import {
  SLUSH_APP_STORE,
  SLUSH_BROWSE_PREFIX,
  SLUSH_INJECTED_WALLET_ID,
  SLUSH_PLAY_STORE,
  SLUSH_WEB_WALLET_ID,
  hasInjectedWallet,
  isMobileBrowser,
  isSlushWebWallet,
  shouldOfferSlushAppDeepLink,
  slushAppBrowseLink,
  slushGetAppLink,
  slushWebWalletLabel,
} from "@/lib/wallet/slush";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const web = { id: SLUSH_WEB_WALLET_ID, name: "Slush" };
const injected = { id: SLUSH_INJECTED_WALLET_ID, name: "Slush" };

describe("isMobileBrowser", () => {
  it("detects iPhone and Android phones", () => {
    expect(isMobileBrowser(IPHONE)).toBe(true);
    expect(isMobileBrowser(ANDROID)).toBe(true);
  });

  it("does not treat desktop Chrome as mobile", () => {
    expect(isMobileBrowser(DESKTOP)).toBe(false);
  });
});

describe("slushAppBrowseLink", () => {
  it("uses the official my.slush.app/browse/<url> form without encoding a simple https URL", () => {
    expect(slushAppBrowseLink("https://sui-wallet-watchdog.netlify.app")).toBe(
      "https://my.slush.app/browse/https://sui-wallet-watchdog.netlify.app",
    );
    expect(slushAppBrowseLink("https://sui-wallet-watchdog.netlify.app/")).toBe(
      "https://my.slush.app/browse/https://sui-wallet-watchdog.netlify.app",
    );
    expect(slushAppBrowseLink("https://app.turbos.finance")).toBe(`${SLUSH_BROWSE_PREFIX}https://app.turbos.finance`);
  });

  it("keeps a non-root path and encodes when the target has a query string", () => {
    expect(slushAppBrowseLink("https://example.com/app")).toBe("https://my.slush.app/browse/https://example.com/app");
    expect(slushAppBrowseLink("https://example.com/?x=1")).toBe(
      `https://my.slush.app/browse/${encodeURIComponent("https://example.com?x=1")}`,
    );
  });
});

describe("shouldOfferSlushAppDeepLink", () => {
  it("is true on a mobile browser with only the Slush web wallet (no injection)", () => {
    expect(shouldOfferSlushAppDeepLink(IPHONE, [web])).toBe(true);
    expect(shouldOfferSlushAppDeepLink(ANDROID, [])).toBe(true);
  });

  it("is false on desktop, or on mobile when a wallet is injected (in-app browser)", () => {
    expect(shouldOfferSlushAppDeepLink(DESKTOP, [web])).toBe(false);
    expect(shouldOfferSlushAppDeepLink(IPHONE, [injected])).toBe(false);
    expect(shouldOfferSlushAppDeepLink(IPHONE, [web, injected])).toBe(false);
  });
});

describe("wallet classification and store links", () => {
  it("distinguishes the web wallet from the injected app/extension wallet", () => {
    expect(isSlushWebWallet(web)).toBe(true);
    expect(isSlushWebWallet(injected)).toBe(false);
    expect(hasInjectedWallet([web])).toBe(false);
    expect(hasInjectedWallet([injected])).toBe(true);
    expect(slushWebWalletLabel()).toBe("Slush web wallet (sign in with Google/passkey)");
  });

  it("points Get Slush at the official store for the platform", () => {
    expect(slushGetAppLink(IPHONE)).toBe(SLUSH_APP_STORE);
    expect(slushGetAppLink(ANDROID)).toBe(SLUSH_PLAY_STORE);
    expect(slushGetAppLink(DESKTOP)).toBe("https://slush.app/download");
  });
});
