/**
 * Tick de telemetría: central de generación (plant_state) + medidores de coops (readings).
 * Reutilizado por scripts/simulate.ts (local) y app/api/tick (route).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const NOISE = 0.06;
const SPIKE_PROB_PLANT = 0.025;
const SPIKE_PROB_METER = 0.015;

export function dispatchFactor(date: Date): number {
  const localHour =
    ((date.getUTCHours() - 3 + 24) % 24) + date.getUTCMinutes() / 60;
  const dow = (date.getUTCDay() + (date.getUTCHours() < 3 ? -1 : 0) + 7) % 7;
  const m = 0.30 * Math.exp(-Math.pow((localHour - 9) / 2.2, 2));
  const e = 0.40 * Math.exp(-Math.pow((localHour - 20) / 2.5, 2));
  const base = 0.55;
  const wk = dow === 0 || dow === 6 ? 0.93 : 1.0;
  return Math.max(0.35, Math.min(1.0, (base + m + e) * wk));
}

type Plant = {
  id: string;
  capacity_mw: number;
};

type Meter = {
  id: string;
  customer_id: string;
  capacity_kw: number;
};

type Customer = {
  id: string;
  short_name: string;
  cammesa_peak_capacity_mw: number;
};

export async function tickPlant(
  supabase: SupabaseClient,
  plant: Plant,
  ts: string,
  factor: number,
) {
  const cap = Number(plant.capacity_mw);
  const spike = Math.random() < SPIKE_PROB_PLANT;

  const mw_active = Math.max(5, cap * factor + (Math.random() - 0.5) * 2);
  const mw_reactive = mw_active * 0.2 + (Math.random() - 0.5) * 1.5;
  const freq_hz = 50 + (Math.random() - 0.5) * 0.08;
  const voltage_kv = 132 + (Math.random() - 0.5) * 0.6;
  const gas_m3h = mw_active * 280 + (Math.random() - 0.5) * 400;
  const eff_pct = 34 + factor * 7 + (Math.random() - 0.5) * 1.0 + (spike ? -2 : 0);
  const turbine_temp_c =
    480 + factor * 100 + (Math.random() - 0.5) * 6 + (spike ? 35 : 0);
  const vibration_mms = 2.5 + (Math.random() - 0.5) * 0.7 + (spike ? 4 : 0);
  const fuelTank = (cap / 120) * 5_000_000;
  const fuel_stock_m3 =
    fuelTank * 0.6 +
    fuelTank * 0.3 *
      Math.abs(Math.sin((Date.now() / 86_400_000 / 7) * Math.PI));
  const setpoint_mw = Math.round(cap * factor);

  await supabase.from("plant_state").upsert(
    {
      unit_id: plant.id,
      ts,
      mw_active: round(mw_active, 2),
      mw_reactive: round(mw_reactive, 2),
      freq_hz: round(freq_hz, 3),
      voltage_kv: round(voltage_kv, 2),
      gas_m3h: round(gas_m3h, 0),
      eff_pct: round(eff_pct, 2),
      turbine_temp_c: round(turbine_temp_c, 1),
      vibration_mms: round(vibration_mms, 2),
      fuel_stock_m3: round(fuel_stock_m3, 0),
      is_available: true,
      setpoint_mw,
    },
    { onConflict: "unit_id,ts" },
  );

  const alerts: { type: string; severity: "info" | "warning" | "critical"; message: string }[] = [];
  if (vibration_mms > 6) {
    alerts.push({
      type: "vibration_high",
      severity: vibration_mms > 7.5 ? "critical" : "warning",
      message: `Vibración ${vibration_mms.toFixed(2)} mm/s en cojinete A · sobre umbral 6.0`,
    });
  }
  if (turbine_temp_c > 590) {
    alerts.push({
      type: "temperature_anomaly",
      severity: turbine_temp_c > 615 ? "critical" : "warning",
      message: `Temperatura turbina ${turbine_temp_c.toFixed(0)} °C · sobre umbral 590`,
    });
  }
  if (alerts.length > 0) {
    await supabase.from("technical_alerts").insert(
      alerts.map((a) => ({ ...a, unit_id: plant.id })),
    );
  }

  return { mw_active: round(mw_active, 2) };
}

export async function tickCoops(
  supabase: SupabaseClient,
  meters: Meter[],
  customers: Customer[],
  ts: string,
  factor: number,
) {
  const spikeMeterIdx =
    Math.random() < SPIKE_PROB_METER
      ? Math.floor(Math.random() * meters.length)
      : -1;

  const readings = meters.map((m, idx) => {
    const noise = 1 - NOISE + Math.random() * NOISE * 2;
    const spike = idx === spikeMeterIdx ? 1.6 + Math.random() * 0.4 : 1;
    const power_kw = Math.max(50, m.capacity_kw * factor * noise * spike);
    const voltage = 220 + (Math.random() - 0.5) * 6;
    return {
      meter_id: m.id,
      ts,
      power_kw: round(power_kw, 2),
      voltage: round(voltage, 1),
      current: round((power_kw / 220) * 1000, 1),
    };
  });

  await supabase.from("readings").upsert(readings, {
    onConflict: "meter_id,ts",
  });

  // Demanda agregada por coop
  const demandByCoop = new Map<string, number>();
  for (let i = 0; i < readings.length; i++) {
    const m = meters[i];
    demandByCoop.set(
      m.customer_id,
      (demandByCoop.get(m.customer_id) ?? 0) + readings[i].power_kw,
    );
  }

  // Alertas CAMMESA
  const alertRows: {
    customer_id: string;
    type: string;
    severity: "warning" | "critical";
    message: string;
  }[] = [];
  for (const c of customers) {
    const kw = demandByCoop.get(c.id) ?? 0;
    const mw = kw / 1000;
    const cupo = Number(c.cammesa_peak_capacity_mw);
    const pct = (mw / cupo) * 100;
    if (pct > 100) {
      alertRows.push({
        customer_id: c.id,
        type: "cammesa_threshold",
        severity: pct > 115 ? "critical" : "warning",
        message: `Pico ${mw.toFixed(1)} MW supera cupo CAMMESA (${cupo} MW · ${pct.toFixed(0)}%)`,
      });
    }
  }
  if (alertRows.length > 0) {
    await supabase.from("customer_alerts").insert(alertRows);
  }

  return {
    demand_by_coop: demandByCoop,
    alerts_fired: alertRows.length,
    meters_count: meters.length,
  };
}

export async function tickAll(supabase: SupabaseClient) {
  const [{ data: plants }, { data: meters }, { data: customers }] =
    await Promise.all([
      supabase.from("generation_units").select("id, capacity_mw"),
      supabase.from("meters").select("id, customer_id, capacity_kw"),
      supabase
        .from("customers")
        .select("id, short_name, cammesa_peak_capacity_mw"),
    ]);

  const now = new Date();
  now.setMilliseconds(0);
  const ts = now.toISOString();
  const factor = dispatchFactor(now);

  const plantResults = [];
  for (const p of (plants ?? []) as Plant[]) {
    plantResults.push(await tickPlant(supabase, p, ts, factor));
  }
  const coopRes = await tickCoops(
    supabase,
    (meters ?? []) as Meter[],
    (customers ?? []) as Customer[],
    ts,
    factor,
  );

  return { ts, factor, plant: plantResults, coops: coopRes };
}

function round(n: number, d: number) {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}
