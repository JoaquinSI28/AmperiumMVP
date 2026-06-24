"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

type Point = { ts: string; value: number };

export function MiniLine({
  data,
  color = "#22d3ee",
  unit,
  height = 80,
  yDomain,
}: {
  data: Point[];
  color?: string;
  unit?: string;
  height?: number;
  yDomain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <YAxis hide domain={yDomain ?? ["auto", "auto"]} />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 6,
            fontSize: 11,
            padding: "4px 8px",
          }}
          labelFormatter={(v) =>
            new Date(v as string).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          }
          formatter={(v) => [`${Number(v).toFixed(2)}${unit ? ` ${unit}` : ""}`, ""]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.8}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
