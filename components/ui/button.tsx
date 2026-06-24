import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";
  const variants: Record<Variant, string> = {
    primary:
      "bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-[0_0_18px_-6px_rgba(245,158,11,0.6)]",
    secondary:
      "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700",
    ghost: "text-zinc-300 hover:bg-zinc-800/60",
  };
  return (
    <button className={cn(base, variants[variant], className)} {...props} />
  );
}
