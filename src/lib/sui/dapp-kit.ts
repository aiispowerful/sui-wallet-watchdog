"use client";
import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

/** Mainnet-only dApp Kit for Connect / signPersonalMessage (no gas). */
export const dAppKit = createDAppKit({
  networks: ["mainnet"],
  defaultNetwork: "mainnet",
  autoConnect: true,
  // Skip Slush registration during SSR/prerender (it fetches metadata). The client bundle re-runs this module with document defined.
  slushWalletConfig: typeof document === "undefined" ? null : { appName: "Sui Wallet Watchdog" },
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: "https://fullnode.mainnet.sui.io:443" }),
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
