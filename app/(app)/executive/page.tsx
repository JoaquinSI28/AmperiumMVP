import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { DailyBars } from "@/components/charts/daily-bars";
import { RevenueBars } from "@/components/charts/revenue-bars";
import { SyncChart } from "@/components/charts/sync-chart";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { PortfolioMap } from "@/components/portfolio-map";
import { Badge } from "@/components/ui/badge";
import { fmtKW } from "@/lib/utils";
import {
  MOCK_PLANT, MOCK_CUSTOMERS, generateMockDailySummary,
  generateMockSyncData, generateMockMeters, generateMockAlerts,
  generateProjectionData, generateEfficiencyData,
} from "@/lib/mock-data";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { EfficiencyChart } from "@/components/charts/efficiency-chart";

export const dynamic = "force-dynamic";

type Plant = { id: string; name: string; short_name: string; location: string; lat: number; lng: number; capacity_mw: number };
type Customer = { id: string; slug: string; name: string; short_name: string; location: string; lat: number; lng: number; cammesa_peak_capacity_mw: number; contract_monthly_usd: number; contracted_at: string | null };
type Daily = { date: string; mwh_generated: number; revenue_ars: number; spot_price_avg_usd_mwh: number; availability_pct: number; avg_eff_pct: number; peak_mw: number; hours_online: number; gas_consumed_m3: number };

const USD_ARS = 1100;

export default async function ExecutivePage({ searchParams }: { searchParams: Promise<{ coop?: string, range?: string }> }) {
  const supabase = await createClient();
  const { coop: coopSlug, range } = await searchParams;

  // Auth check — allow through if no user (demo mode)
  let isDemo = false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
      if (profile?.role !== "director") redirect("/operation");
    } else {
      isDemo = true;
    }
  } catch {
    isDemo = true;
  }

  // Fetch real data
  let plant: Plant | null = null;
  let customers: Customer[] = [];
  let meterCountByCoop = new Map<string, number>();
  let alertCountByCoop = new Map<string, number>();
  let demandByCoopKw = new Map<string, number>();
  let latestMwActive = 0;
  let summary: Daily[] = [];
  let syncInitial: { ts: string; generation_mw: number; demand_mw: number }[] = [];

  if (!isDemo) {
    try {
      const [{ data: p }, { data: cRaw }, { data: mAll }, { data: oAll }, { data: lDem }, { data: lState }, { data: sAll }] = await Promise.all([
        supabase.from("generation_units").select("id, name, short_name, location, lat, lng, capacity_mw").single<Plant>(),
        supabase.from("customers").select("id, slug, name, short_name, location, lat, lng, cammesa_peak_capacity_mw, contract_monthly_usd, contracted_at").order("contracted_at"),
        supabase.from("meters").select("customer_id"),
        supabase.from("customer_alerts").select("customer_id, severity, message, created_at").is("acknowledged_at", null),
        supabase.rpc("customer_latest_demand"),
        supabase.from("plant_state").select("mw_active, is_available").order("ts", { ascending: false }).limit(1).single<{ mw_active: number; is_available: boolean }>(),
        supabase.from("daily_summary").select("*").order("date", { ascending: false }),
      ]);
      if (p) plant = p;
      customers = (cRaw ?? []) as Customer[];
      for (const m of (mAll ?? []) as { customer_id: string }[]) meterCountByCoop.set(m.customer_id, (meterCountByCoop.get(m.customer_id) ?? 0) + 1);
      for (const a of (oAll ?? []) as { customer_id: string }[]) alertCountByCoop.set(a.customer_id, (alertCountByCoop.get(a.customer_id) ?? 0) + 1);
      for (const r of (lDem ?? []) as { customer_id: string; demand_kw: number | string }[]) demandByCoopKw.set(r.customer_id, Number(r.demand_kw));
      latestMwActive = Number(lState?.mw_active ?? 0);
      summary = ((sAll ?? []) as Daily[]).map((r) => ({ ...r, mwh_generated: Number(r.mwh_generated), revenue_ars: Number(r.revenue_ars), spot_price_avg_usd_mwh: Number(r.spot_price_avg_usd_mwh), availability_pct: Number(r.availability_pct), avg_eff_pct: Number(r.avg_eff_pct), peak_mw: Number(r.peak_mw), hours_online: Number(r.hours_online), gas_consumed_m3: Number(r.gas_consumed_m3) }));

      const since = new Date(Date.now() - 120 * 60 * 1000).toISOString();
      const [{ data: gW }, { data: dW }] = await Promise.all([
        supabase.from("plant_state").select("ts, mw_active").gte("ts", since).order("ts"),
        supabase.rpc("saas_demand_window", { p_minutes: 120 }),
      ]);
      const dMap = new Map<string, number>(((dW ?? []) as { ts: string; demand_mw: number | string }[]).map((r) => [r.ts, Number(r.demand_mw)]));
      syncInitial = ((gW ?? []) as { ts: string; mw_active: number | string }[]).map((g) => ({ ts: g.ts, generation_mw: Number(g.mw_active), demand_mw: dMap.get(g.ts) ?? 0 }));
    } catch { /* fallback to mock */ }
  }

  // Fallback to mock data if Supabase is empty
  const useMock = !plant || customers.length === 0 || summary.length === 0;
  if (useMock) {
    plant = MOCK_PLANT as Plant;
    customers = MOCK_CUSTOMERS as Customer[];
    summary = generateMockDailySummary(range);
    syncInitial = generateMockSyncData();
    latestMwActive = 22.4;
    // Mock demand/meters/alerts per coop
    meterCountByCoop = new Map([["coop-tandil", 6], ["coop-olavarria", 4], ["coop-azul", 3]]);
    alertCountByCoop = new Map([["coop-tandil", 2], ["coop-olavarria", 1], ["coop-azul", 0]]);
    demandByCoopKw = new Map([["coop-tandil", 8200], ["coop-olavarria", 5100], ["coop-azul", 3800]]);
  }

  const coopsMarkers = customers.map((c) => ({
    slug: c.slug, name: c.name, short_name: c.short_name, location: c.location,
    lat: c.lat, lng: c.lng, cammesa_peak_capacity_mw: Number(c.cammesa_peak_capacity_mw),
    current_mw: (demandByCoopKw.get(c.id) ?? 0) / 1000,
    meter_count: meterCountByCoop.get(c.id) ?? 0, open_alerts: alertCountByCoop.get(c.id) ?? 0,
  }));

  const plantMarker = {
    name: plant!.name, short_name: plant!.short_name, location: plant!.location,
    lat: plant!.lat, lng: plant!.lng, capacity_mw: Number(plant!.capacity_mw), current_mw: latestMwActive,
  };

  const totalMwh = summary.reduce((a, r) => a + r.mwh_generated, 0);
  const totalGenArs = summary.reduce((a, r) => a + r.revenue_ars, 0);
  const totalGenUsdM = totalGenArs / USD_ARS / 1_000_000;
  const avgSpot = summary.reduce((a, r) => a + r.spot_price_avg_usd_mwh, 0) / Math.max(summary.length, 1);
  const peakMw = Math.max(...summary.map((r) => r.peak_mw), 0);
  const avgAvail = summary.reduce((a, r) => a + r.availability_pct, 0) / Math.max(summary.length, 1);
  const mrrUsd = customers.reduce((a, c) => a + Number(c.contract_monthly_usd), 0);
  const totalMeters = customers.reduce((a, c) => a + (meterCountByCoop.get(c.id) ?? 0), 0);
  const latestDem = Array.from(demandByCoopKw.values()).reduce((a, b) => a + b, 0) / 1000;
  const syncDelta = latestMwActive - latestDem;

  const selected = coopSlug ? customers.find((c) => c.slug === coopSlug) : undefined;

  // ===== DRILL-DOWN =====
  if (selected) {
    let meterList = generateMockMeters(selected.id);
    let alertList = generateMockAlerts(selected.id);

    if (!useMock) {
      try {
        const [{ data: meters }, { data: alerts }] = await Promise.all([
          supabase.from("meters").select("id, serial, label, capacity_kw, installed_at").eq("customer_id", selected.id).order("serial"),
          supabase.from("customer_alerts").select("id, type, severity, message, created_at, acknowledged_at").eq("customer_id", selected.id).order("created_at", { ascending: false }).limit(20),
        ]);
        if (meters && meters.length > 0) meterList = meters as typeof meterList;
        if (alerts && alerts.length > 0) alertList = alerts as typeof alertList;
      } catch { /* use mock */ }
    }

    const selDemandMw = (demandByCoopKw.get(selected.id) ?? 0) / 1000;
    const cupo = Number(selected.cammesa_peak_capacity_mw);
    const pct = cupo > 0 ? (selDemandMw / cupo) * 100 : 0;
    const installedKw = meterList.reduce((a, m) => a + Number(m.capacity_kw), 0);
    const openCount = alertList.filter((a) => !a.acknowledged_at).length;
    const seed = selected.id.charCodeAt(0) + selected.id.charCodeAt(selected.id.length - 1);
    const projectionData = generateProjectionData(cupo > 0 ? cupo : 5, seed, range);

    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link href="/executive" className="text-xs uppercase tracking-[0.18em] text-zinc-500 hover:text-amber-400">← Vista global del portfolio</Link>
          <h1 className="mt-1 text-2xl font-semibold">{selected.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {selected.location} · cliente SaaS desde {selected.contracted_at ? new Date(selected.contracted_at).toLocaleDateString("es-AR") : "—"}
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle>Ubicación del cliente</CardTitle></CardHeader>
          <CardBody><PortfolioMap plant={plantMarker} coops={coopsMarkers} selectedCoop={selected.slug} height={260} /></CardBody>
        </Card>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Contrato SaaS" value={`USD ${Number(selected.contract_monthly_usd).toLocaleString("es-AR")}`} tone="green" hint="Mensual · licenciamiento" />
          <KpiCard label="Demanda actual" value={selDemandMw.toFixed(2)} unit="MW" tone="cyan" />
          <KpiCard label="Cupo CAMMESA" value={pct.toFixed(1)} unit="%" tone={pct > 100 ? "red" : pct > 85 ? "amber" : "green"} hint={`${selDemandMw.toFixed(1)} / ${cupo} MW`} />
          <KpiCard label="Smart meters" value={String(meterList.length)} tone="zinc" hint={`${(installedKw / 1000).toFixed(1)} MW instalados`} />
          <KpiCard label="Alertas abiertas" value={String(openCount)} tone={openCount > 0 ? "amber" : "green"} />
          <KpiCard label="Eventos 7d" value={String(alertList.length)} tone="zinc" hint="Total registrados" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle>Smart meters desplegados</CardTitle></CardHeader>
            <CardBody className="p-0">
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-zinc-800 bg-zinc-900 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-medium">Serial</th>
                      <th className="px-5 py-2.5 text-left font-medium">Zona</th>
                      <th className="px-5 py-2.5 text-right font-medium">Capacidad</th>
                      <th className="px-5 py-2.5 text-right font-medium">Instalado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meterList.map((m) => (
                      <tr key={m.id} className="border-b border-zinc-900 last:border-0">
                        <td className="px-5 py-3 font-mono text-xs text-cyan-300">{m.serial}</td>
                        <td className="px-5 py-3 text-zinc-200">{m.label}</td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">{fmtKW(Number(m.capacity_kw))} kW</td>
                        <td className="px-5 py-3 text-right text-zinc-500">{new Date(m.installed_at).toLocaleDateString("es-AR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Eventos CAMMESA · últimos</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              {alertList.length === 0 && <p className="text-sm text-zinc-500">Sin eventos en el período.</p>}
              {alertList.slice(0, 8).map((a) => (
                <div key={a.id} className={`rounded-lg border p-3 ${a.acknowledged_at ? "border-zinc-900 bg-zinc-950/30 opacity-60" : "border-zinc-800 bg-zinc-950/50"}`}>
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 h-2 w-2 rounded-full ${a.severity === "critical" ? "bg-red-500" : a.severity === "warning" ? "bg-amber-500" : "bg-cyan-500"}`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-200">{a.message}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        {new Date(a.created_at).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {" · "}<span className="font-mono">{a.type}</span>
                        {a.acknowledged_at && <span> · resuelto</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

      </div>
    );
  }

  // ===== VISTA GLOBAL =====
  const chronological = [...summary].reverse();
  const dailyBars = chronological.map((r) => ({ date: r.date, mwh: r.mwh_generated, peak_mw: r.peak_mw }));
  const revBars = chronological.map((r) => ({ date: r.date, revenue_musd: r.revenue_ars / USD_ARS / 1_000_000, revenue_ars: r.revenue_ars }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Dirección General · Performance consolidada</div>
          <h1 className="mt-1 text-2xl font-semibold">Resumen ejecutivo</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Modelo dual: <strong>generación al MEM</strong> + <strong>SaaS de medición inteligente</strong> a {customers.length} cooperativas cliente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <React.Suspense fallback={<div className="h-8 w-40 animate-pulse rounded-md bg-zinc-900" />}>
            <TimeRangeSelector />
          </React.Suspense>
          {useMock && <Badge tone="amber">Demo · datos ficticios</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Portfolio AMPERIUM · central + cooperativas cliente</CardTitle>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Central (inyección SADI)</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" />Cooperativa cliente (SaaS)</span>
            </div>
          </div>
        </CardHeader>
        <CardBody><PortfolioMap plant={plantMarker} coops={coopsMarkers} height={380} /></CardBody>
      </Card>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Generación · Mercado Eléctrico Mayorista</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label={`Energía generada · ${range === "10y" ? "10 años" : range === "5y" ? "5 años" : range === "1y" ? "1 año" : "30d"}`} value={(totalMwh / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} unit="GWh" tone="amber" hint={`Peak ${peakMw.toFixed(1)} MW`} />
          <KpiCard label="Ingresos MEM" value={totalGenUsdM.toFixed(2)} unit="M USD" tone="green" hint={`Spot promedio ${avgSpot.toFixed(1)} USD/MWh`} />
          <KpiCard label="Disponibilidad" value={avgAvail.toFixed(2)} unit="%" tone={avgAvail > 95 ? "green" : "amber"} hint="Promedio del período" />
          <KpiCard label="Capacidad nominal" value={String(Number(plant!.capacity_mw))} unit="MW" tone="amber" hint={`${plant!.short_name} · gas natural`} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">SaaS · Servicio complementario a distribuidoras</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="MRR licenciamiento" value={`USD ${mrrUsd.toLocaleString("es-AR")}`} tone="cyan" hint={`USD ${(mrrUsd * 12).toLocaleString("es-AR")} ARR`} />
          <KpiCard label="Cooperativas activas" value={String(customers.length)} tone="zinc" hint="Contratos plurianuales SaaS" />
          <KpiCard label="Smart meters desplegados" value={String(totalMeters)} tone="zinc" hint="Telemetría operativa" />
          <KpiCard label="Demanda gestionada" value={latestDem.toFixed(1)} unit="MW" tone="cyan" hint="Total agregado en tiempo real" />
        </div>
      </div>

      <Card glow="amber">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sincronización oferta vs demanda · diferencial AMPERIUM</CardTitle>
            <Badge tone={Math.abs(syncDelta) < 5 ? "green" : "amber"}>Δ {syncDelta >= 0 ? "+" : ""}{syncDelta.toFixed(2)} MW</Badge>
          </div>
        </CardHeader>
        <CardBody>
          <SyncChart initial={syncInitial} />
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            La curva ámbar es la inyección al SADI de la central AMPERIUM. La curva cian es la demanda
            agregada de las cooperativas cliente del SaaS.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cooperativas cliente · drill-down comercial</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {customers.map((c) => {
            const m = coopsMarkers.find((x) => x.slug === c.slug)!;
            const pctCupo = (m.current_mw / m.cammesa_peak_capacity_mw) * 100;
            return (
              <Link key={c.id} href={`/executive?coop=${c.slug}`} className="block">
                <Card className="transition-colors hover:border-cyan-500/40">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{c.short_name}</CardTitle>
                      <Badge tone={pctCupo > 100 ? "red" : pctCupo > 85 ? "amber" : "cyan"}>{pctCupo.toFixed(0)}% cupo</Badge>
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    <div className="text-xs text-zinc-400">{c.location}</div>
                    <dl className="grid grid-cols-3 gap-3 border-t border-zinc-800 pt-3 text-xs">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Demanda</dt>
                        <dd className="mt-0.5 font-mono text-lg text-cyan-300">{m.current_mw.toFixed(1)}</dd>
                        <dd className="text-[10px] text-zinc-500">MW actual</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Meters</dt>
                        <dd className="mt-0.5 font-mono text-lg text-zinc-200">{m.meter_count}</dd>
                        <dd className="text-[10px] text-zinc-500">desplegados</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-500">MRR</dt>
                        <dd className="mt-0.5 font-mono text-lg text-green-400">{(Number(c.contract_monthly_usd) / 1000).toFixed(1)}</dd>
                        <dd className="text-[10px] text-zinc-500">k USD/mes</dd>
                      </div>
                    </dl>
                    <div className="text-[11px] uppercase tracking-wider text-amber-400">Drill-down comercial →</div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Energía generada diaria · {range === "10y" ? "Últimos 10 años" : range === "5y" ? "Últimos 5 años" : range === "1y" ? "Último año" : "Últimos 30 días"}</CardTitle></CardHeader>
        <CardBody><DailyBars data={dailyBars} /></CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ingresos diarios MEM (USD millones)</CardTitle></CardHeader>
        <CardBody><RevenueBars data={revBars} /></CardBody>
      </Card>

      <Card glow="amber">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Timeline de Consumo · Proyección consolidada todas las sucursales</CardTitle>
            <Badge tone="cyan">2025 vs 2026</Badge>
          </div>
        </CardHeader>
        <CardBody>
          <ProjectionChart data={generateProjectionData(
            customers.reduce((a, c) => a + Number(c.cammesa_peak_capacity_mw), 0),
            42,
            range
          )} />
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Consumo agregado de las {customers.length} cooperativas cliente. El área gris muestra el año previo (real).
            La línea cian es el consumo real del año actual. La línea ámbar punteada proyecta el consumo esperado
            para lo que resta del año, considerando estacionalidad y una tendencia de crecimiento del 3% interanual.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Eficiencia Térmica Promedio</CardTitle>
            <Badge tone="green">Mejora continua</Badge>
          </div>
        </CardHeader>
        <CardBody>
          <EfficiencyChart data={generateEfficiencyData(range)} />
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Evolución de la eficiencia térmica de la central a lo largo del tiempo seleccionado.
            Se observan caídas estacionales en verano debido a la temperatura ambiente, y un
            crecimiento general sostenido gracias a los mantenimientos y mejoras tecnológicas.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
