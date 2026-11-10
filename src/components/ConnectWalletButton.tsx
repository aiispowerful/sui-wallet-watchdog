"use client";

import { useCurrentAccount, useDAppKit, useWalletConnection, useWallets } from "@mysten/dapp-kit-react";
import { useEffect, useId, useMemo, useState } from "react";
import { walletErrorMessage } from "@/lib/auth/wallet-error";
import { short } from "./ui";

const SLUSH_INSTALL = "https://slush.app";

function walletKey(wallet: { name: string; id?: string }): string {
  return wallet.id ?? wallet.name;
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

  const sorted = useMemo(() => {
    return [...wallets].sort((a, b) => {
      const as = a.name.toLowerCase() === "slush" ? 0 : 1;
      const bs = b.name.toLowerCase() === "slush" ? 0 : 1;
      return as - bs || a.name.localeCompare(b.name);
    });
  }, [wallets]);

  const hasSlush = sorted.some((w) => w.name.toLowerCase() === "slush");

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
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-600">
          Connected {short(account.address, 4)}
        </span>
        <button
          type="button"
          onClick={() => void kit.disconnectWallet().catch(() => undefined)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
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
        className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-white"
      >
        Connect Wallet
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-lg font-semibold text-slate-50">
                {sorted.length > 0 ? "Connect a wallet" : "No wallets installed"}
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
            {sorted.length === 0 ? (
              <p className="text-sm text-slate-300">Install a wallet to get started on Sui. Slush works as a browser extension or a web wallet.</p>
            ) : (
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
                      <span className="flex-1 font-medium">{wallet.name}</span>
                      {busy === walletKey(wallet) ? <span className="text-xs text-slate-400">Check your wallet…</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!hasSlush && (
              <a
                href={SLUSH_INSTALL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex text-sm text-sky-400 underline-offset-2 hover:underline"
              >
                Install Slush
              </a>
            )}
            {hasSlush && (
              <p className="mt-3 text-xs text-slate-500">Slush is listed above (extension or Slush web wallet).</p>
            )}
            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
