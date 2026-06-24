import { cn } from "@/lib/utils";

type Tone = "amber" | "cyan" | "red" | "green" | "zinc";

export function Badge({
  children,
  tone = "zinc",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    red: "bg-red-500/10 text-red-400 ring-red-500/30",
    green: "bg-green-500/10 text-green-400 ring-green-500/30",
    zinc: "bg-zinc-800 text-zinc-300 ring-zinc-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
