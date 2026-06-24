/**
 * Datos ficticios para demo cuando Supabase está vacío.
 */

export const MOCK_PLANT = {
  id: "plant-001",
  name: "Central Térmica AMPERIUM Tandil Sur",
  short_name: "Tandil Sur",
  location: "Tandil, Provincia de Buenos Aires",
  lat: -37.322,
  lng: -59.133,
  capacity_mw: 30,
};

export const MOCK_CUSTOMERS = [
  {
    id: "coop-tandil",
    slug: "tandil",
    name: "Cooperativa Eléctrica de Tandil",
    short_name: "Coop. Tandil",
    location: "Tandil, Buenos Aires",
    lat: -37.327,
    lng: -59.143,
    cammesa_peak_capacity_mw: 12,
    contract_monthly_usd: 4500,
    contracted_at: "2024-03-15",
  },
  {
    id: "coop-olavarria",
    slug: "olavarria",
    name: "Cooperativa Eléctrica de Olavarría",
    short_name: "Coop. Olavarría",
    location: "Olavarría, Buenos Aires",
    lat: -36.893,
    lng: -60.322,
    cammesa_peak_capacity_mw: 8,
    contract_monthly_usd: 3200,
    contracted_at: "2024-06-01",
  },
  {
    id: "coop-azul",
    slug: "azul",
    name: "Cooperativa Eléctrica de Azul",
    short_name: "Coop. Azul",
    location: "Azul, Buenos Aires",
    lat: -36.783,
    lng: -59.858,
    cammesa_peak_capacity_mw: 6,
    contract_monthly_usd: 2800,
    contracted_at: "2025-01-10",
  },
];

/** Genera 30 días de resumen diario ficticio */
export function generateMockDailySummary() {
  const days: {
    date: string;
    mwh_generated: number;
    revenue_ars: number;
    spot_price_avg_usd_mwh: number;
    availability_pct: number;
    avg_eff_pct: number;
    peak_mw: number;
    hours_online: number;
    gas_consumed_m3: number;
  }[] = [];

  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const baseMwh = 400 + Math.sin(i * 0.5) * 80 + (i % 7 < 2 ? -60 : 0);
    const spotPrice = 42 + Math.sin(i * 0.3) * 8;
    const revenueArs = baseMwh * spotPrice * 1100;
    const peak = 22 + Math.sin(i * 0.4) * 5;

    days.push({
      date: dateStr,
      mwh_generated: Math.round(baseMwh * 10) / 10,
      revenue_ars: Math.round(revenueArs),
      spot_price_avg_usd_mwh: Math.round(spotPrice * 10) / 10,
      availability_pct: 95 + Math.sin(i * 0.7) * 4,
      avg_eff_pct: 38 + Math.sin(i * 0.6) * 3,
      peak_mw: Math.round(peak * 10) / 10,
      hours_online: 20 + Math.floor(Math.sin(i * 0.5) * 4),
      gas_consumed_m3: Math.round(baseMwh * 280),
    });
  }
  return days;
}

/** Genera datos de sincronización oferta/demanda (2 horas) */
export function generateMockSyncData() {
  const points: { ts: string; generation_mw: number; demand_mw: number }[] = [];
  const now = new Date();

  for (let m = 120; m >= 0; m -= 2) {
    const t = new Date(now.getTime() - m * 60 * 1000);
    const ts = t.toISOString();
    const base = 18 + Math.sin(m * 0.05) * 4;
    points.push({
      ts,
      generation_mw: Math.round((base + 2 + Math.sin(m * 0.08) * 1.5) * 100) / 100,
      demand_mw: Math.round((base + Math.sin(m * 0.06) * 1.2) * 100) / 100,
    });
  }
  return points;
}

/** Genera datos de meters ficticios para una cooperativa */
export function generateMockMeters(coopId: string) {
  const zones: Record<string, string[]> = {
    "coop-tandil": ["Centro", "Norte", "Industrial", "Residencial Sur", "Parque", "Aeropuerto"],
    "coop-olavarria": ["Centro", "Sierra Chica", "Industrial", "Hinojo"],
    "coop-azul": ["Centro", "Cacharí", "Chillar"],
  };
  const coopZones = zones[coopId] ?? ["Centro", "Norte", "Sur"];
  return coopZones.map((zone, i) => ({
    id: `${coopId}-meter-${i}`,
    serial: `SM-${coopId.slice(-3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
    label: zone,
    capacity_kw: 800 + i * 200,
    installed_at: `2024-${String((i % 12) + 1).padStart(2, "0")}-15`,
  }));
}

/** Genera alertas ficticias */
export function generateMockAlerts(coopId: string) {
  const msgs: { msg: string; type: string; sev: "info" | "warning" | "critical" }[] = [
    { msg: "Demanda pico superó 90% del cupo CAMMESA", type: "demand_peak", sev: "warning" },
    { msg: "Medidor SM-003 sin comunicación por 15 min", type: "comm_loss", sev: "critical" },
    { msg: "Variación de tensión detectada en zona Norte", type: "voltage", sev: "warning" },
    { msg: "Lectura validada correctamente", type: "validation", sev: "info" },
    { msg: "Reconexión automática completada", type: "reconnect", sev: "info" },
  ];
  const now = new Date();
  return msgs.map((m, i) => ({
    id: `${coopId}-alert-${i}`,
    type: m.type,
    severity: m.sev,
    message: m.msg,
    created_at: new Date(now.getTime() - i * 3600 * 1000 * 6).toISOString(),
    acknowledged_at: i > 2 ? new Date(now.getTime() - i * 3600 * 1000 * 3).toISOString() : null,
  }));
}

/** Genera proyecciones mensuales */
export function generateProjectionData(capacityMw: number, seed: number) {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const currentMonth = new Date().getMonth();
  const base = capacityMw * 720 * 0.4;

  return months.map((month, i) => {
    const seasonality = (i === 0 || i === 1 || i === 11 || i === 5 || i === 6) ? 1.2 : 0.9;
    const varPrev = 1 + ((seed + i) % 15 - 7) / 100;
    const varCurr = 1 + ((seed * 2 + i) % 15 - 7) / 100;
    const prevYear = base * seasonality * varPrev;
    const currBase = prevYear * 1.03;

    return {
      month,
      previousYear: Math.round(prevYear),
      currentYear: i <= currentMonth ? Math.round(currBase * varCurr) : null,
      projected: i >= currentMonth ? Math.round(currBase * varCurr) : null,
    };
  });
}
