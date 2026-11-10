"use client";
import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

/** Mainnet-only dApp Kit for Connect / signPersonalMessage (no gas). */
export const dAppKit = createDAppKit({
  networks: ["mainnet"],
  defaultNetwork: "mainnet",
  autoConnect: true,
  // Skip Slush registration during SSR/prerender (it fetches metadata). The client bundle re-runs this module with document defined.
  // metadataApiUrl is same-origin: api.slush.app/api/wallet/metadata is CORS-blocked from this site.
  // The file matches @mysten/slush-wallet's FALLBACK_METADATA (the library still registers on fetch failure).
  slushWalletConfig: typeof document === "undefined"
    ? null
    : {
        appName: "Sui Wallet Watchdog",
        origin: "https://my.slush.app",
        metadataApiUrl: "/slush-wallet-metadata.json",
      },
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: "https://fullnode.mainnet.sui.io:443" }),
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
