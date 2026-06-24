"use client";

import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { date: string; mwh: number; peak_mw: number };

export function DailyBars({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) =>
            new Date(v).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "short",
            })
          }
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={20}
        />
        <YAxis
          yAxisId="mwh"
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(v) => v.toLocaleString("es-AR")}
        />
        <YAxis
          yAxisId="peak"
          orientation="right"
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) =>
            new Date(v as string).toLocaleDateString("es-AR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })
          }
          formatter={(value, key) => [
            key === "mwh"
              ? `${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MWh`
              : `${Number(value).toFixed(1)} MW`,
            key === "mwh" ? "Energía generada" : "Pico de potencia",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
          iconType="rect"
          formatter={(v) => (v === "mwh" ? "Energía (MWh)" : "Pico (MW)")}
        />
        <Bar
          yAxisId="mwh"
          dataKey="mwh"
          fill="#f59e0b"
          fillOpacity={0.85}
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="peak"
          type="monotone"
          dataKey="peak_mw"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={{ fill: "#22d3ee", r: 3 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
