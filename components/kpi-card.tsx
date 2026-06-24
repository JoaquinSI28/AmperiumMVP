import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "amber" | "cyan" | "red" | "green" | "zinc";

export function KpiCard({
  label,
  value,
  unit,
  hint,
  tone = "zinc",
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: Tone;
  trend?: "up" | "down" | "flat";
}) {
  const tones: Record<Tone, string> = {
    amber: "text-amber-400",
    cyan: "text-cyan-300",
    red: "text-red-400",
    green: "text-green-400",
    zinc: "text-zinc-100",
  };
  const trendIcon =
    trend === "up" ? "▲" : trend === "down" ? "▼" : trend === "flat" ? "■" : null;
  return (
    <Card>
      <CardBody className="py-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={cn("font-mono text-3xl font-semibold tabular-nums", tones[tone])}>
            {value}
          </span>
          {unit && <span className="text-sm text-zinc-500">{unit}</span>}
          {trendIcon && (
            <span className={cn("text-xs", tones[tone])}>{trendIcon}</span>
          )}
        </div>
        {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
      </CardBody>
    </Card>
  );
}
