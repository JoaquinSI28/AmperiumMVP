"use client";

import {
  AreaChart,
  CartesianGrid,
  Legend,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  date: string;
  efficiency: number;
};

export function EfficiencyChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          width={44}
          domain={['dataMin - 1', 'dataMax + 1']}
          tickFormatter={(v) => `${Math.round(v)}%`}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => `Mes: ${v}`}
          formatter={(value) => [
            `${Number(value).toFixed(1)}%`,
            "Eficiencia Térmica",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
          iconType="line"
        />
        <Area
          name="Eficiencia Térmica"
          type="monotone"
          dataKey="efficiency"
          stroke="#10b981"
          fillOpacity={1}
          fill="url(#colorEff)"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
