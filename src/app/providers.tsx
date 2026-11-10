"use client";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { dAppKit } from "@/lib/sui/dapp-kit";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>
    </QueryClientProvider>
  );
}
