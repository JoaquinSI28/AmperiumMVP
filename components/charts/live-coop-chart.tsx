"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

type Point = { ts: string; demand_mw: number };

export function LiveCoopChart({
  initial,
  cupoMw,
  pollMs = 8000,
  height = 320,
}: {
  initial: Point[];
  cupoMw: number;
  pollMs?: number;
  height?: number;
}) {
  const [data, setData] = useState<Point[]>(initial);
  const [live, setLive] = useState(false);
  const lastTsRef = useRef<string | undefined>(initial.at(-1)?.ts);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function refetch() {
      const { data: rows } = await supabase.rpc("my_coop_demand_window", {
        p_minutes: 60,
      });
      if (!rows || cancelled) return;
      const next = rows.map((r: { ts: string; demand_mw: number | string }) => ({
        ts: r.ts,
        demand_mw: Number(r.demand_mw),
      }));
      setData(next);
      const newest = next.at(-1)?.ts;
      if (newest && newest !== lastTsRef.current) {
        lastTsRef.current = newest;
        setLive(true);
        setTimeout(() => setLive(false), 1500);
      }
    }

    const id = setInterval(refetch, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  const peak = Math.max(...data.map((d) => d.demand_mw), cupoMw);
  const yMax = Math.ceil(peak * 1.1);

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        <span
          className={`h-1.5 w-1.5 rounded-full ${live ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "bg-zinc-700"}`}
        />
        {live ? "Lectura recibida" : "Telemetría activa"}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="coopGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            minTickGap={32}
          />
          <YAxis
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={[0, yMax]}
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
              new Date(v as string).toLocaleString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              })
            }
            formatter={(v) => [`${Number(v).toFixed(2)} MW`, "Demanda"]}
          />
          <ReferenceLine
            y={cupoMw}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: `Cupo CAMMESA · ${cupoMw} MW`,
              fill: "#f59e0b",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
          <Area
            type="monotone"
            dataKey="demand_mw"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#coopGrad)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
