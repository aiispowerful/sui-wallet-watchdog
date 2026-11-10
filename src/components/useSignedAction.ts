"use client";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { walletErrorMessage } from "@/lib/auth/wallet-error";

export async function requestSignature(opts: {
  purpose: "label" | "preference";
  address: string;
  buildMessage: (nonce: string, expiresAt: string) => string;
  kit: { signPersonalMessage: (args: { message: Uint8Array }) => Promise<{ signature: string }> };
}): Promise<{ nonce: string; message: string; signature: string }> {
  const nonceRes = await fetch("/api/auth/nonce", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose: opts.purpose, address: opts.address }),
  });
  const issued = await nonceRes.json();
  if (!nonceRes.ok) throw new Error(issued.error ?? "Could not start the wallet approval.");
  const message = opts.buildMessage(issued.nonce, issued.expiresAt);
  const { signature } = await opts.kit.signPersonalMessage({ message: new TextEncoder().encode(message) });
  return { nonce: issued.nonce, message, signature };
}

export function useSignedAction() {
  const account = useCurrentAccount();
  const kit = useDAppKit();
  return { account, kit, requestSignature: (opts: Omit<Parameters<typeof requestSignature>[0], "kit">) => requestSignature({ ...opts, kit }) };
}

export { walletErrorMessage };
