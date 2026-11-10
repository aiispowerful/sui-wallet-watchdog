import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Dashboard />
      <footer className="pb-8 text-center text-xs text-slate-600">
        Built for Total Recall · Tatum × Walrus Memory · data via Tatum Sui RPC & Data API · memory on Walrus mainnet
      </footer>
    </main>
  );
}
