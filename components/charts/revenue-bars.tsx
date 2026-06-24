"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { date: string; revenue_musd: number; revenue_ars: number };

export function RevenueBars({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.4} />
          </linearGradient>
        </defs>
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
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => `${v.toFixed(0)}M`}
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
          formatter={(value, _key, item) => {
            const ars = (item as unknown as { payload: Row }).payload.revenue_ars;
            return [
              `USD ${(Number(value)).toFixed(2)} M · ARS ${(ars / 1_000_000).toFixed(1)} M`,
              "Ingresos",
            ];
          }}
        />
        <Bar dataKey="revenue_musd" fill="url(#revGrad)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
