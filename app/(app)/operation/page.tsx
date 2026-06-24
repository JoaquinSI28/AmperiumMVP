import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { LiveMwChart } from "@/components/charts/live-mw-chart";
import { MiniLine } from "@/components/charts/mini-line";

export const dynamic = "force-dynamic";

type PlantState = {
  unit_id: string;
  ts: string;
  mw_active: number;
  mw_reactive: number;
  freq_hz: number;
  voltage_kv: number;
  gas_m3h: number;
  eff_pct: number;
  turbine_temp_c: number;
  vibration_mms: number;
  fuel_stock_m3: number;
  is_available: boolean;
  setpoint_mw: number | null;
};

type Equipment = {
  id: string;
  code: string;
  name: string;
  type: string;
  hours_operated: number;
  next_inspection: string | null;
  status: "operational" | "warning" | "maintenance" | "offline";
};

type Alert = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  created_at: string;
  equipment: { code: string; name: string } | null;
};

export default async function OperationPage() {
  const supabase = await createClient();

  const { data: plant } = await supabase
    .from("generation_units")
    .select("id, name, short_name, location, capacity_mw, commissioned_at")
    .single<{
      id: string;
      name: string;
      short_name: string;
      location: string;
      capacity_mw: number;
      commissioned_at: string | null;
    }>();

  if (!plant) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-zinc-400">
        No hay una central configurada en el sistema.
      </div>
    );
  }

  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const CAPACITY_MW = Number(plant.capacity_mw);

  const [{ data: hourly }, { data: window6h }, { data: equipment }, { data: alerts }] =
    await Promise.all([
      supabase
        .from("plant_state")
        .select("ts, mw_active, setpoint_mw")
        .eq("unit_id", plant.id)
        .gte("ts", since1h)
        .order("ts"),
      supabase
        .from("plant_state")
        .select("*")
        .eq("unit_id", plant.id)
        .gte("ts", since6h)
        .order("ts"),
      supabase
        .from("equipment")
        .select("id, code, name, type, hours_operated, next_inspection, status")
        .eq("unit_id", plant.id)
        .order("code"),
      supabase
        .from("technical_alerts")
        .select(
          "id, type, severity, message, created_at, equipment:equipment(code, name)",
        )
        .eq("unit_id", plant.id)
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false }),
    ]);

  const series6h = ((window6h ?? []) as PlantState[]) ?? [];
  const initialChart = ((hourly ?? []) as {
    ts: string;
    mw_active: number | string;
    setpoint_mw: number | string | null;
  }[]).map((r) => ({
    ts: r.ts,
    mw_active: Number(r.mw_active),
    setpoint_mw: Number(r.setpoint_mw ?? 0),
  }));

  const last = series6h.at(-1);
  const equipList = (equipment ?? []) as Equipment[];
  const openAlerts = (alerts ?? []) as unknown as Alert[];

  const effSeries = series6h.map((p) => ({ ts: p.ts, value: Number(p.eff_pct) }));
  const tempSeries = series6h.map((p) => ({ ts: p.ts, value: Number(p.turbine_temp_c) }));
  const vibSeries = series6h.map((p) => ({ ts: p.ts, value: Number(p.vibration_mms) }));

  const fuelPct = last ? (Number(last.fuel_stock_m3) / 5_000_000) * 100 : 0;
  const loadPct = last ? (Number(last.mw_active) / CAPACITY_MW) * 100 : 0;
  const isOn = last?.is_available ?? false;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Sala de Control · MEM / SADI
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Operación de la central</h1>
          <p className="mt-1 text-xs text-zinc-500">
            {plant.location} · capacidad nominal {CAPACITY_MW} MW · combustible gas natural
          </p>
        </div>
        <Badge tone={isOn ? "amber" : "red"}>
          {isOn ? "● Inyectando al SADI" : "○ Fuera de servicio"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Potencia activa"
          value={last ? Number(last.mw_active).toFixed(2) : "—"}
          unit="MW"
          tone="amber"
          hint={`Carga ${loadPct.toFixed(0)}% · setpoint ${last?.setpoint_mw ?? "—"} MW`}
        />
        <KpiCard
          label="Frecuencia"
          value={last ? Number(last.freq_hz).toFixed(3) : "—"}
          unit="Hz"
          tone={
            last && Math.abs(Number(last.freq_hz) - 50) < 0.05 ? "green" : "amber"
          }
          hint="Nominal 50.000 Hz · sincronizado al SADI"
        />
        <KpiCard
          label="Tensión salida"
          value={last ? Number(last.voltage_kv).toFixed(2) : "—"}
          unit="kV"
          tone="cyan"
          hint="Nominal 132 kV · transformador elevador"
        />
        <KpiCard
          label="Eficiencia térmica"
          value={last ? Number(last.eff_pct).toFixed(2) : "—"}
          unit="%"
          tone={last && Number(last.eff_pct) > 38 ? "green" : "amber"}
          hint={`Reactiva ${last ? Number(last.mw_reactive).toFixed(1) : "—"} MVAr`}
        />
        <KpiCard
          label="Gas natural"
          value={last ? (Number(last.gas_m3h) / 1000).toFixed(1) : "—"}
          unit="× 10³ m³/h"
          tone="zinc"
          hint={`Stock ${fuelPct.toFixed(0)}% (${last ? (Number(last.fuel_stock_m3) / 1_000_000).toFixed(2) : "—"} M m³)`}
        />
        <KpiCard
          label="Temp. turbina"
          value={last ? Number(last.turbine_temp_c).toFixed(0) : "—"}
          unit="°C"
          tone={
            last && Number(last.turbine_temp_c) > 590
              ? "red"
              : last && Number(last.turbine_temp_c) > 560
                ? "amber"
                : "zinc"
          }
          hint="Entrada de turbina"
        />
        <KpiCard
          label="Vibración"
          value={last ? Number(last.vibration_mms).toFixed(2) : "—"}
          unit="mm/s"
          tone={
            last && Number(last.vibration_mms) > 6
              ? "red"
              : last && Number(last.vibration_mms) > 4.5
                ? "amber"
                : "green"
          }
          hint="Cojinete A · umbral 6.0"
        />
        <KpiCard
          label="Alarmas abiertas"
          value={String(openAlerts.length)}
          tone={openAlerts.length > 0 ? "amber" : "green"}
          hint={openAlerts.length > 0 ? "Requieren atención" : "Sin pendientes"}
        />
      </div>

      <Card glow="amber">
        <CardHeader>
          <CardTitle>Generación en tiempo real · última hora</CardTitle>
        </CardHeader>
        <CardBody>
          <LiveMwChart
            initial={initialChart}
            capacityMw={CAPACITY_MW}
            unitId={plant.id}
          />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Eficiencia térmica · 6h</CardTitle>
          </CardHeader>
          <CardBody>
            <MiniLine data={effSeries} color="#22d3ee" unit="%" yDomain={[33, 43]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Temperatura turbina · 6h</CardTitle>
          </CardHeader>
          <CardBody>
            <MiniLine data={tempSeries} color="#f59e0b" unit="°C" yDomain={[460, 610]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vibración cojinete A · 6h</CardTitle>
          </CardHeader>
          <CardBody>
            <MiniLine data={vibSeries} color="#a78bfa" unit="mm/s" yDomain={[1, 8]} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Equipos críticos</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Tag</th>
                  <th className="px-5 py-2.5 text-left font-medium">Equipo</th>
                  <th className="px-5 py-2.5 text-right font-medium">Horas op.</th>
                  <th className="px-5 py-2.5 text-right font-medium">Próx. insp.</th>
                  <th className="px-5 py-2.5 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {equipList.map((e) => {
                  const isLate = e.next_inspection
                    ? new Date(e.next_inspection) < new Date()
                    : false;
                  return (
                    <tr key={e.id} className="border-b border-zinc-900 last:border-0">
                      <td className="px-5 py-3 font-mono text-xs text-amber-300">
                        {e.code}
                      </td>
                      <td className="px-5 py-3 text-zinc-200">{e.name}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-zinc-400">
                        {Number(e.hours_operated).toLocaleString("es-AR", {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-mono tabular-nums ${isLate ? "text-amber-400" : "text-zinc-500"}`}
                      >
                        {e.next_inspection
                          ? new Date(e.next_inspection).toLocaleDateString("es-AR")
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge
                          tone={
                            e.status === "operational"
                              ? "green"
                              : e.status === "warning"
                                ? "amber"
                                : e.status === "maintenance"
                                  ? "cyan"
                                  : "red"
                          }
                        >
                          {e.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Alarmas técnicas activas</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {openAlerts.length === 0 && (
              <p className="text-sm text-zinc-500">
                Sin alarmas activas. Operación nominal.
              </p>
            )}
            {openAlerts.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 h-2 w-2 rounded-full ${
                      a.severity === "critical"
                        ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                        : a.severity === "warning"
                          ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                          : "bg-cyan-500"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-200">
                      {a.message}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-zinc-500">
                      {a.equipment && (
                        <span className="font-mono text-amber-300/80">
                          {a.equipment.code}
                        </span>
                      )}
                      <span className="font-mono">{a.type}</span>
                      <span>
                        {new Date(a.created_at).toLocaleString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
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
