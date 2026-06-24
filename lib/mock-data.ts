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

/**
 * Genera resumen diario para N días.
 * range: "now" = 30d, "1y" = 365d, "5y" = 1825d, "10y" = 3650d
 */
export function generateMockDailySummary(range: string = "now") {
  const dayCount = range === "10y" ? 3650 : range === "5y" ? 1825 : range === "1y" ? 365 : 30;
  const days: {
    date: string; mwh_generated: number; revenue_ars: number;
    spot_price_avg_usd_mwh: number; availability_pct: number;
    avg_eff_pct: number; peak_mw: number; hours_online: number; gas_consumed_m3: number;
  }[] = [];

  const now = new Date();
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);

    // Estacionalidad anual (picos en verano dic-feb e invierno jun-jul para Argentina)
    const seasonal = Math.sin((dayOfYear / 365) * Math.PI * 2 - 1.2) * 0.15;
    // Tendencia de crecimiento interanual (~3% por año)
    const yearOffset = (dayCount - i) / 365;
    const growth = 1 + yearOffset * 0.03;
    // Variación día de semana (fines de semana bajan)
    const dow = d.getDay();
    const weekendFactor = (dow === 0 || dow === 6) ? 0.82 : 1.0;
    // Ruido determinístico
    const noise = Math.sin(i * 0.73) * 0.08 + Math.cos(i * 1.37) * 0.05;

    const baseMwh = 380 * growth * (1 + seasonal) * weekendFactor * (1 + noise);
    const spotPrice = (42 + Math.sin(dayOfYear * 0.017) * 10 + Math.sin(i * 0.31) * 5) * growth;
    const revenueArs = baseMwh * spotPrice * 1100;
    const peak = (22 + Math.sin(dayOfYear * 0.017) * 4) * growth * weekendFactor;

    days.push({
      date: dateStr,
      mwh_generated: Math.round(baseMwh * 10) / 10,
      revenue_ars: Math.round(revenueArs),
      spot_price_avg_usd_mwh: Math.round(spotPrice * 10) / 10,
      availability_pct: Math.min(99.9, 95 + Math.sin(i * 0.7) * 4),
      avg_eff_pct: 38 + Math.sin(i * 0.6) * 3,
      peak_mw: Math.round(peak * 10) / 10,
      hours_online: Math.min(24, Math.max(16, 20 + Math.floor(Math.sin(i * 0.5) * 4))),
      gas_consumed_m3: Math.round(baseMwh * 280),
    });
  }
  return days;
}

/**
 * Genera datos de sincronización oferta/demanda (2 horas, cada 2 min = 61 puntos).
 * Simula una curva de generación que sigue a la demanda con un pequeño delta.
 */
export function generateMockSyncData() {
  const points: { ts: string; generation_mw: number; demand_mw: number }[] = [];
  const now = new Date();

  for (let m = 120; m >= 0; m -= 2) {
    const t = new Date(now.getTime() - m * 60 * 1000);
    const ts = t.toISOString();
    const hour = t.getHours() + t.getMinutes() / 60;

    // Curva de demanda realista: baja en la madrugada, sube en la mañana, pico 13-15h, baja de noche
    const demandBase = 14 + 6 * Math.sin((hour - 6) * Math.PI / 12) + 2 * Math.sin((hour - 2) * Math.PI / 6);
    const demandNoise = Math.sin(m * 0.15) * 0.8 + Math.cos(m * 0.23) * 0.4;
    const demand = Math.max(8, demandBase + demandNoise);

    // Generación sigue la demanda con un margen positivo y leve delay
    const genDelta = 1.5 + Math.sin(m * 0.1) * 0.8;
    const generation = demand + genDelta;

    points.push({
      ts,
      generation_mw: Math.round(generation * 100) / 100,
      demand_mw: Math.round(demand * 100) / 100,
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
