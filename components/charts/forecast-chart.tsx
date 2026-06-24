"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

export type Granularity = "minute" | "hour" | "day" | "month";

type RawRow = {
  bucket_ts: string;
  power_mw: number | string;
  lower_mw: number | string;
  upper_mw: number | string;
  is_forecast: boolean;
};

type ChartPoint = {
  ts: string;
  history_mw: number | null;
  forecast_mw: number | null;
  lower_mw: number | null;
  band: number | null; // = upper - lower, lo usamos como "stacked area" sobre lower
  upper_mw: number | null;
};

type Initial = {
  rows: RawRow[];
  granularity: Granularity;
  horizon: number;
  history: number;
  cupoMw: number | null;
};

const PRESETS: {
  granularity: Granularity;
  label: string;
  shortLabel: string;
  history: number;
  horizon: number;
  horizonOptions: number[];
  fmt: (d: Date) => string;
}[] = [
  {
    granularity: "minute",
    label: "Por minuto (cada 15 min)",
    shortLabel: "Minuto",
    history: 12,
    horizon: 24,
    horizonOptions: [12, 24, 48, 96],
    fmt: (d) =>
      d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
  },
  {
    granularity: "hour",
    label: "Por hora",
    shortLabel: "Hora",
    history: 12,
    horizon: 24,
    horizonOptions: [12, 24, 48, 72, 168],
    fmt: (d) =>
      d.toLocaleString("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
      }),
  },
  {
    granularity: "day",
    label: "Por día",
    shortLabel: "Día",
    history: 14,
    horizon: 14,
    horizonOptions: [7, 14, 28],
    fmt: (d) =>
      d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
  },
  {
    granularity: "month",
    label: "Por mes",
    shortLabel: "Mes",
    history: 3,
    horizon: 3,
    horizonOptions: [1, 3, 6],
    fmt: (d) =>
      d.toLocaleDateString("es-AR", { month: "long", year: "2-digit" }),
  },
];

export function ForecastChart({ initial }: { initial: Initial }) {
  const [granularity, setGranularity] = useState<Granularity>(initial.granularity);
  const [horizon, setHorizon] = useState(initial.horizon);
  const [history, setHistory] = useState(initial.history);
  const [rows, setRows] = useState<RawRow[]>(initial.rows);
  const [loading, setLoading] = useState(false);

  const preset = PRESETS.find((p) => p.granularity === granularity)!;

  useEffect(() => {
    // Cuando granularity cambia, ajustar horizon/history al default
    setHorizon(preset.horizon);
    setHistory(preset.history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("forecast_demand", {
        p_customer_id: null, // null -> respeta RLS (operador coop ve solo lo suyo)
        p_granularity: granularity,
        p_horizon: horizon,
        p_history: history,
      });
      if (!cancelled && data) setRows(data as RawRow[]);
      setLoading(false);
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [granularity, horizon, history]);

  const data = useMemo<ChartPoint[]>(() => {
    const list = rows
      .map((r) => ({
        ts: r.bucket_ts,
        history_mw: !r.is_forecast ? Number(r.power_mw) : null,
        forecast_mw: r.is_forecast ? Number(r.power_mw) : null,
        lower_mw: r.is_forecast ? Number(r.lower_mw) : null,
        upper_mw: r.is_forecast ? Number(r.upper_mw) : null,
        band:
          r.is_forecast && r.upper_mw != null && r.lower_mw != null
            ? Number(r.upper_mw) - Number(r.lower_mw)
            : null,
      }))
      .sort((a, b) => a.ts.localeCompare(b.ts));

    // Punto de conexión: último histórico se duplica en el primer forecast
    const lastHistIdx = list.findLastIndex((p) => p.history_mw !== null);
    if (lastHistIdx >= 0 && lastHistIdx + 1 < list.length) {
      const h = list[lastHistIdx];
      const f = list[lastHistIdx + 1];
      f.forecast_mw = f.forecast_mw ?? h.history_mw;
      list[lastHistIdx].forecast_mw = h.history_mw;
      // Para la banda: arrancar con valor cero en el último punto del histórico
      list[lastHistIdx].lower_mw = h.history_mw;
      list[lastHistIdx].band = 0;
    }
    return list;
  }, [rows]);

  const splitTs =
    data.find((p) => p.history_mw === null && p.forecast_mw !== null)?.ts ??
    data.at(-1)?.ts;

  const peakForecast = Math.max(
    ...data
      .filter((p) => p.forecast_mw !== null)
      .map((p) => p.upper_mw ?? p.forecast_mw ?? 0),
    0,
  );
  const peakHistory = Math.max(
    ...data.filter((p) => p.history_mw !== null).map((p) => p.history_mw ?? 0),
    0,
  );
  const peakOverall = Math.max(peakForecast, peakHistory);

  return (
    <div className="space-y-4">
      {/* Selectores */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Granularidad
          </label>
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.granularity}
                onClick={() => setGranularity(p.granularity)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  granularity === p.granularity
                    ? "rounded-md bg-amber-500 text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {p.shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Horizonte ({preset.shortLabel.toLowerCase()}s adelante)
          </label>
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            {preset.horizonOptions.map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  horizon === h
                    ? "rounded-md bg-cyan-500 text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Historia visible
          </label>
          <input
            type="number"
            min={1}
            max={48}
            value={history}
            onChange={(e) => setHistory(Number(e.target.value))}
            className="w-20 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
          />
        </div>

        <div className="ml-auto text-[10px] uppercase tracking-wider text-zinc-500">
          {loading ? (
            <span className="text-amber-400">Recalculando…</span>
          ) : (
            <>Pico previsto: <span className="font-mono text-zinc-200">{peakForecast.toFixed(2)} MW</span></>
          )}
        </div>
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) => preset.fmt(new Date(v))}
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
            domain={[0, Math.ceil(peakOverall * 1.15)]}
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
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            formatter={(value, key) => {
              if (value === null) return ["", ""];
              if (key === "band") return [null, null] as unknown as [string, string];
              const label =
                key === "history_mw"
                  ? "Histórico"
                  : key === "forecast_mw"
                    ? "Predicción"
                    : key === "lower_mw"
                      ? "Banda inferior"
                      : key === "upper_mw"
                        ? "Banda superior"
                        : (key as string);
              return [`${Number(value).toFixed(2)} MW`, label];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
            iconType="line"
            formatter={(v) =>
              v === "history_mw"
                ? "Histórico"
                : v === "forecast_mw"
                  ? "Predicción"
                  : v === "upper_mw"
                    ? "Banda superior (μ + 1.5σ)"
                    : v === "lower_mw"
                      ? "Banda inferior (μ − 1.5σ)"
                      : (v as string)
            }
          />

          {splitTs && (
            <ReferenceLine
              x={splitTs}
              stroke="#71717a"
              strokeDasharray="2 4"
              label={{
                value: "ahora",
                fill: "#a1a1aa",
                fontSize: 10,
                position: "insideTopLeft",
              }}
            />
          )}

          {/* Banda de confianza apilada: primero invisible lower, luego band visible */}
          <Area
            type="monotone"
            dataKey="lower_mw"
            stackId="band"
            stroke="transparent"
            fill="transparent"
            isAnimationActive={false}
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="band"
            stackId="band"
            stroke="transparent"
            fill="#f59e0b"
            fillOpacity={0.18}
            isAnimationActive={false}
            legendType="none"
          />

          <Line
            type="monotone"
            dataKey="history_mw"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast_mw"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Tabla con primeros 8 puntos predichos */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950/50 text-[10px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Bucket</th>
              <th className="px-4 py-2 text-right font-medium">Predicción</th>
              <th className="px-4 py-2 text-right font-medium">Banda</th>
              <th className="px-4 py-2 text-right font-medium">Incertidumbre</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((p) => p.forecast_mw !== null && p.history_mw === null)
              .slice(0, 10)
              .map((p) => {
                const lo = p.lower_mw ?? 0;
                const hi = p.upper_mw ?? 0;
                const range = hi - lo;
                return (
                  <tr key={p.ts} className="border-b border-zinc-900 last:border-0">
                    <td className="px-4 py-2 text-zinc-300">
                      {preset.fmt(new Date(p.ts))}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-amber-300">
                      {p.forecast_mw?.toFixed(2)} MW
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-zinc-500">
                      {lo.toFixed(1)} – {hi.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-zinc-500">
                      ±{(range / 2).toFixed(2)} MW
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
