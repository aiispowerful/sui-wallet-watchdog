"use client";
import { useCurrentAccount, useDAppKit, useWalletConnection } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { useCallback, useEffect, useState } from "react";
import { walletErrorMessage } from "@/lib/auth/wallet-error";
import { dAppKit } from "@/lib/sui/dapp-kit";
import { short } from "./ui";

export function WalletBar({ onSession, onUseAddress }: { onSession?: (address: string | null) => void; onUseAddress?: (address: string) => void }) {
  const account = useCurrentAccount();
  const { status } = useWalletConnection();
  const kit = useDAppKit();
  const [session, setSession] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/auth/me");
    const j = (await r.json()) as { address?: string | null };
    const addr = j.address ?? null;
    setSession(addr);
    onSession?.(addr);
  }, [onSession]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j: { address?: string | null }) => {
        if (cancelled) return;
        const addr = j.address ?? null;
        setSession(addr);
        onSession?.(addr);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [onSession]);

  async function signIn() {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "login", address: account.address }),
      });
      const issued = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(issued.error ?? "Could not start sign-in.");
      const { signature } = await kit.signPersonalMessage({ message: new TextEncoder().encode(issued.message) });
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: account.address, nonce: issued.nonce, message: issued.message, signature }),
      });
      const logged = await loginRes.json();
      if (!loginRes.ok) throw new Error(logged.error ?? "Sign-in failed.");
      await refresh();
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await kit.disconnectWallet().catch(() => undefined);
      await refresh();
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === "reconnecting" && <span className="text-xs text-slate-500">Reconnecting wallet…</span>}
        <ConnectButton instance={dAppKit} />
        {account && session === account.address && (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-800">
            Signed in {short(session, 4)}
            {onUseAddress && (
              <button type="button" className="text-emerald-200 underline-offset-2 hover:underline" onClick={() => onUseAddress(session)}>
                scan
              </button>
            )}
          </span>
        )}
        {account && session !== account.address && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void signIn()}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Check your wallet…" : "Sign in with Sui"}
          </button>
        )}
        {session && (
          <button type="button" disabled={busy} onClick={() => void signOut()} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
            Sign out
          </button>
        )}
      </div>
      {error && <p className="max-w-sm text-right text-xs text-rose-400">{error}</p>}
    </div>
  );
}
