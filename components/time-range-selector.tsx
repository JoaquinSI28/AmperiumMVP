"use client";

import { useRouter, useSearchParams } from "next/navigation";

const RANGES = [
  { value: "now", label: "Tiempo real" },
  { value: "1y", label: "1 año" },
  { value: "5y", label: "5 años" },
  { value: "10y", label: "10 años" },
] as const;

export function TimeRangeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("range") ?? "now";

  function handleChange(range: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.push(`/executive?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => handleChange(r.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            current === r.value
              ? "bg-amber-500 text-zinc-950 shadow-sm"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
