import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Dashboard />
      <footer className="px-4 pb-8 pt-2 text-center text-xs leading-relaxed text-slate-600">
        Powered by Tatum · Walrus Memory
      </footer>
    </main>
  );
}
