"use client";

import { getWalletUniqueIdentifier } from "@mysten/dapp-kit-core";
import { useCurrentAccount, useDAppKit, useWalletConnection, useWallets } from "@mysten/dapp-kit-react";
import type { UiWallet } from "@mysten/dapp-kit-core";
import { useEffect, useId, useMemo, useState } from "react";
import { walletErrorMessage } from "@/lib/auth/wallet-error";
import {
  isSlushWebWallet,
  shouldOfferSlushAppDeepLink,
  slushAppBrowseLink,
  slushGetAppLink,
  slushWebWalletLabel,
} from "@/lib/wallet/slush";
import { short } from "./ui";

function walletRef(wallet: UiWallet): { id: string; name: string } {
  return { id: getWalletUniqueIdentifier(wallet), name: wallet.name };
}

function walletKey(wallet: UiWallet): string {
  return walletRef(wallet).id;
}

function walletLabel(wallet: UiWallet): string {
  const ref = walletRef(wallet);
  return isSlushWebWallet(ref) ? slushWebWalletLabel() : ref.name;
}

export function ConnectWalletButton() {
  const wallets = useWallets();
  const kit = useDAppKit();
  const account = useCurrentAccount();
  const { status } = useWalletConnection();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  // This button is loaded with ssr:false, so window is available on first render.
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const userAgent = typeof window !== "undefined" ? navigator.userAgent : "";

  const sorted = useMemo(() => {
    return [...wallets].sort((a, b) => {
      const ar = walletRef(a);
      const br = walletRef(b);
      const as = isSlushWebWallet(ar) ? 1 : ar.name.toLowerCase() === "slush" ? 0 : 2;
      const bs = isSlushWebWallet(br) ? 1 : br.name.toLowerCase() === "slush" ? 0 : 2;
      return as - bs || ar.name.localeCompare(br.name);
    });
  }, [wallets]);

  const showAppLink = shouldOfferSlushAppDeepLink(userAgent, wallets.map(walletRef));
  const deepLink = pageUrl ? slushAppBrowseLink(pageUrl) : "";
  const getSlushHref = userAgent ? slushGetAppLink(userAgent) : "https://slush.app/download";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (status === "reconnecting" && !account) {
    return <span className="text-xs text-slate-500">Reconnecting wallet…</span>;
  }

  if (account) {
    return (
      <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
        <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-600 sm:justify-start">
          Connected {short(account.address, 4)}
        </span>
        <button
          type="button"
          onClick={() => void kit.disconnectWallet().catch(() => undefined)}
          className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 sm:w-auto sm:py-1.5"
        >
          Disconnect
        </button>
      </div>
    );
  }

  async function connect(wallet: (typeof sorted)[number]) {
    setBusy(walletKey(wallet));
    setError(null);
    try {
      await kit.connectWallet({ wallet });
      setOpen(false);
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-white sm:w-auto sm:py-1.5"
      >
        Connect Wallet
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[min(36rem,calc(100dvh-2rem))] w-full max-w-sm min-w-0 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-lg font-semibold text-slate-50">
                {showAppLink || sorted.length > 0 ? "Connect a wallet" : "No wallets installed"}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {showAppLink && deepLink && (
              <div className="mb-4 space-y-2">
                <p className="text-sm text-slate-300">On a phone, the installed Slush app can open this site in its in-app browser, where the wallet is available to connect and sign.</p>
                <a
                  href={deepLink}
                  className="flex w-full items-center justify-center rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Open in Slush app
                </a>
                <a
                  href={getSlushHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Get Slush
                </a>
              </div>
            )}

            {sorted.length === 0 && !showAppLink ? (
              <p className="text-sm text-slate-300">Install a wallet to get started on Sui. Slush works as a browser extension, a mobile app, or a web wallet.</p>
            ) : sorted.length > 0 ? (
              <ul className="space-y-2">
                {sorted.map((wallet) => (
                  <li key={walletKey(wallet)}>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void connect(wallet)}
                      className="flex w-full items-center gap-3 rounded-xl bg-slate-800 px-3 py-2.5 text-left text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-60"
                    >
                      {wallet.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={wallet.icon} alt="" className="h-7 w-7 rounded-full" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs">⬡</span>
                      )}
                      <span className="min-w-0 flex-1 break-words font-medium">{walletLabel(wallet)}</span>
                      {busy === walletKey(wallet) ? <span className="text-xs text-slate-400">Check your wallet…</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {!showAppLink && (
              <a
                href={getSlushHref}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex text-sm text-sky-400 underline-offset-2 hover:underline"
              >
                Get Slush
              </a>
            )}
            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
