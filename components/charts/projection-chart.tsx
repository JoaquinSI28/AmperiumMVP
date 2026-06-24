"use client";

import {
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
} from "recharts";

type Row = {
  month: string;
  previousYear: number;
  currentYear: number | null;
  projected: number | null;
};

export function ProjectionChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(v) => v.toLocaleString("es-AR")}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, key) => [
            `${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MWh`,
            key === "previousYear"
              ? "Año previo"
              : key === "currentYear"
                ? "Año actual"
                : "Proyectado",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
          iconType="rect"
          formatter={(v) =>
            v === "previousYear"
              ? "Año previo (Real)"
              : v === "currentYear"
                ? "Año actual (YTD)"
                : "Proyección esperada"
          }
        />
        <Area
          type="monotone"
          dataKey="previousYear"
          fill="#3f3f46"
          stroke="none"
          fillOpacity={0.4}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="currentYear"
          stroke="#22d3ee"
          strokeWidth={3}
          dot={{ fill: "#22d3ee", r: 4 }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="projected"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: "#f59e0b", r: 4 }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
