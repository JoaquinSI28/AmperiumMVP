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

type Point = { ts: string; mw_active: number; setpoint_mw: number };

export function LiveMwChart({
  initial,
  capacityMw = 120,
  pollMs = 8000,
  height = 320,
  unitId,
}: {
  initial: Point[];
  capacityMw?: number;
  pollMs?: number;
  height?: number;
  unitId?: string;
}) {
  const [data, setData] = useState<Point[]>(initial);
  const [live, setLive] = useState(false);
  const lastTsRef = useRef<string | undefined>(initial.at(-1)?.ts);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function refetch() {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      let query = supabase
        .from("plant_state")
        .select("ts, mw_active, setpoint_mw")
        .gte("ts", since)
        .order("ts");
      if (unitId) query = query.eq("unit_id", unitId);
      const { data: rows } = await query;
      if (!rows || cancelled) return;
      const next: Point[] = rows.map((r: { ts: string; mw_active: number | string; setpoint_mw: number | string | null }) => ({
        ts: r.ts,
        mw_active: Number(r.mw_active),
        setpoint_mw: Number(r.setpoint_mw ?? 0),
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
  }, [pollMs, unitId]);

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            live
              ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]"
              : "bg-zinc-700"
          }`}
        />
        {live ? "Telemetría · tick" : "Telemetría activa"}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mwGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
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
            domain={[0, capacityMw]}
            tickFormatter={(v) => `${v}`}
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
            formatter={(value, key) => [
              `${Number(value).toFixed(2)} MW`,
              key === "mw_active" ? "Potencia activa" : "Consigna",
            ]}
          />
          <ReferenceLine
            y={capacityMw}
            stroke="#71717a"
            strokeDasharray="2 4"
            label={{
              value: `Capacidad nominal · ${capacityMw} MW`,
              fill: "#71717a",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
          <Area
            type="monotone"
            dataKey="mw_active"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#mwGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
