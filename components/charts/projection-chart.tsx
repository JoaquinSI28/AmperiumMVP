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
  date: string;
  real: number | null;
  projected: number | null;
};

export function ProjectionChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={30}
          tickFormatter={(v) => {
            const [y, m] = v.split("-");
            return `${m}/${y.slice(2)}`;
          }}
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
          labelFormatter={(v) => `Mes: ${v}`}
          formatter={(value, key) => [
            `${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MWh`,
            key === "real" ? "Consumo Histórico" : "Proyección",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
          iconType="line"
          formatter={(v) =>
            v === "real" ? "Consumo Histórico" : "Proyección (tendencia)"
          }
        />
        <Area
          type="monotone"
          dataKey="real"
          fill="#22d3ee"
          stroke="none"
          fillOpacity={0.1}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="real"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="projected"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
