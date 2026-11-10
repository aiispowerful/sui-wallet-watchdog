import type { ReactNode } from "react";
import type { Severity } from "@/lib/types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "sky" | "violet" }) {
  const tones = {
    slate: "bg-slate-800 text-slate-300 ring-slate-700",
    green: "bg-emerald-950 text-emerald-300 ring-emerald-800",
    amber: "bg-amber-950 text-amber-300 ring-amber-800",
    red: "bg-rose-950 text-rose-300 ring-rose-800",
    sky: "bg-sky-950 text-sky-300 ring-sky-800",
    violet: "bg-violet-950 text-violet-300 ring-violet-800",
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}>{children}</span>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone = severity === "high" ? "red" : severity === "medium" ? "amber" : "slate";
  return <Badge tone={tone}>{severity}</Badge>;
}

export function Stat({ label, value, hint, tone = "text-slate-100" }: { label: string; value: ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
      <div className="text-xs uppercase tracking-wide break-words text-slate-500">{label}</div>
      <div className={`mt-1 break-words text-xl font-semibold sm:text-2xl ${tone}`}>{value}</div>
      {hint && <div className="mt-1 break-words text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function short(s?: string, n = 6) {
  if (!s) return "";
  return s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-4)}` : s;
}
