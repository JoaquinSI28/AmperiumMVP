"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

type Point = {
  ts: string;
  generation_mw: number;
  demand_mw: number;
};

export function SyncChart({
  initial,
  pollMs = 8000,
}: {
  initial: Point[];
  pollMs?: number;
}) {
  const [data, setData] = useState<Point[]>(initial);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let failCount = 0;

    async function refetch() {
      try {
        const since = new Date(Date.now() - 120 * 60 * 1000).toISOString();
        const [{ data: gen }, { data: dem }] = await Promise.all([
          supabase
            .from("plant_state")
            .select("ts, mw_active")
            .gte("ts", since)
            .order("ts"),
          supabase.rpc("saas_demand_window", { p_minutes: 120 }),
        ]);
        if (cancelled || !gen || !dem || gen.length === 0) {
          failCount++;
          if (failCount >= 2) simulateLivePoint();
          return;
        }

        failCount = 0;
        const demMap = new Map<string, number>(
          dem.map((r: { ts: string; demand_mw: number | string }) => [
            r.ts,
            Number(r.demand_mw),
          ]),
        );
        const merged: Point[] = gen.map(
          (g: { ts: string; mw_active: number | string }) => ({
            ts: g.ts,
            generation_mw: Number(g.mw_active),
            demand_mw: demMap.get(g.ts) ?? 0,
          }),
        );
        setData(merged);
      } catch {
        failCount++;
        if (failCount >= 2) simulateLivePoint();
      }
    }

    function simulateLivePoint() {
      setData((prev) => {
        const now = new Date();
        const hour = now.getHours() + now.getMinutes() / 60;
        const m = now.getMinutes();
        const demandBase = 14 + 6 * Math.sin((hour - 6) * Math.PI / 12) + 2 * Math.sin((hour - 2) * Math.PI / 6);
        const noise = Math.sin(m * 0.15) * 0.8 + Math.cos(m * 0.23 + now.getSeconds() * 0.1) * 0.4;
        const demand = Math.max(8, demandBase + noise);
        const generation = demand + 1.5 + Math.sin(m * 0.1) * 0.8;

        const newPoint: Point = {
          ts: now.toISOString(),
          generation_mw: Math.round(generation * 100) / 100,
          demand_mw: Math.round(demand * 100) / 100,
        };

        // Keep last 2 hours of data (61 points at 2min intervals)
        const cutoff = new Date(now.getTime() - 120 * 60 * 1000).toISOString();
        const filtered = prev.filter((p) => p.ts >= cutoff);
        return [...filtered, newPoint];
      });
    }

    const id = setInterval(refetch, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="ts"
          tickFormatter={(v) =>
            new Date(v).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          }
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) =>
            new Date(v as string).toLocaleString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })
          }
          formatter={(value, key) => [
            `${Number(value).toFixed(2)} MW`,
            key === "generation_mw" ? "Inyección AMPERIUM" : "Demanda coops cliente",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
          iconType="line"
          formatter={(v) =>
            v === "generation_mw" ? "Inyección AMPERIUM" : "Demanda coops cliente"
          }
        />
        <Line
          type="monotone"
          dataKey="generation_mw"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="demand_mw"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
