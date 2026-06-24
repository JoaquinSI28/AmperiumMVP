import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { LiveCoopChart } from "@/components/charts/live-coop-chart";
import { CoopMetersMap } from "@/components/coop-meters-map";
import { fmtKW, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  name: string;
  short_name: string;
  location: string;
  cammesa_peak_capacity_mw: number;
};

type Meter = {
  id: string;
  serial: string;
  label: string;
  lat: number | null;
  lng: number | null;
  capacity_kw: number;
  installed_at: string;
};

type Alert = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  created_at: string;
  acknowledged_at: string | null;
};

export default async function CoopDashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const supabase = await createClient();
  const { view } = await searchParams;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, short_name, location, cammesa_peak_capacity_mw")
    .single<Customer>();

  if (!customer) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-zinc-400">
        Tu cuenta no tiene una cooperativa asociada.
      </div>
    );
  }

  const [
    { data: demand },
    { data: top },
    { data: openAlerts },
    { data: allAlerts },
    { data: meters },
    { count: meterCount },
  ] = await Promise.all([
    supabase.rpc("my_coop_demand_window", { p_minutes: 60 }),
    supabase.rpc("my_coop_top_meters", { p_minutes: 15, p_limit: 5 }),
    supabase
      .from("customer_alerts")
      .select("id, type, severity, message, created_at, acknowledged_at")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_alerts")
      .select("id, type, severity, message, created_at, acknowledged_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("meters")
      .select("id, serial, label, lat, lng, capacity_kw, installed_at")
      .order("serial"),
    supabase.from("meters").select("id", { count: "exact", head: true }),
  ]);

  const series = ((demand ?? []) as { ts: string; demand_mw: number | string }[]).map(
    (r) => ({ ts: r.ts, demand_mw: Number(r.demand_mw) }),
  );
  const meterList = (meters ?? []) as Meter[];
  const open = (openAlerts ?? []) as Alert[];
  const allAlertList = (allAlerts ?? []) as Alert[];
  const topMeters = ((top ?? []) as {
    meter_id: string;
    serial: string;
    label: string;
    avg_kw: number | string;
    capacity_kw: number | string;
  }[]).map((r) => ({
    meter_id: r.meter_id,
    serial: r.serial,
    label: r.label,
    avg_kw: Number(r.avg_kw),
    capacity_kw: Number(r.capacity_kw),
  }));

  const cupo = Number(customer.cammesa_peak_capacity_mw);
  const currentMw = series.at(-1)?.demand_mw ?? 0;
  const cupoPct = cupo > 0 ? (currentMw / cupo) * 100 : 0;
  const peakMw = Math.max(...series.map((p) => p.demand_mw), 0);
  const cupoTone: "red" | "amber" | "green" =
    cupoPct > 100 ? "red" : cupoPct > 85 ? "amber" : "green";

  // Latest reading per meter para el mapa
  const meterMarkers = meterList
    .filter((m) => m.lat !== null && m.lng !== null)
    .map((m) => {
      const avg = topMeters.find((t) => t.meter_id === m.id)?.avg_kw;
      return {
        id: m.id,
        serial: m.serial,
        label: m.label,
        lat: m.lat as number,
        lng: m.lng as number,
        capacity_kw: Number(m.capacity_kw),
        // Si no está en top, usamos la capacidad por dispatch_factor aproximado
        current_kw: avg ?? Number(m.capacity_kw) * 0.65,
      };
    });

  // VIEW: meters
  if (view === "meters") {
    const totalCapacity = meterList.reduce((a, m) => a + Number(m.capacity_kw), 0);
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Infraestructura SaaS · {customer.short_name}
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Smart meters desplegados</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {meterList.length} medidores · capacidad instalada{" "}
            <span className="font-mono text-zinc-200">
              {(totalCapacity / 1000).toFixed(1)} MW
            </span>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ubicación geográfica</CardTitle>
          </CardHeader>
          <CardBody>
            <CoopMetersMap meters={meterMarkers} height={400} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listado de alimentadores</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Serial</th>
                  <th className="px-5 py-2.5 text-left font-medium">Zona</th>
                  <th className="px-5 py-2.5 text-left font-medium">Coords</th>
                  <th className="px-5 py-2.5 text-right font-medium">Capacidad</th>
                  <th className="px-5 py-2.5 text-right font-medium">Instalado</th>
                </tr>
              </thead>
              <tbody>
                {meterList.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-900 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-cyan-300">
                      {m.serial}
                    </td>
                    <td className="px-5 py-3 text-zinc-200">{m.label}</td>
                    <td className="px-5 py-3 font-mono text-[11px] text-zinc-500">
                      {m.lat && m.lng
                        ? `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">
                      {fmtKW(Number(m.capacity_kw))} kW
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-500">
                      {new Date(m.installed_at).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    );
  }

  // VIEW: alerts
  if (view === "alerts") {
    const openOnly = allAlertList.filter((a) => !a.acknowledged_at);
    const closed = allAlertList.filter((a) => a.acknowledged_at);
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Eventos CAMMESA · {customer.short_name}
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Alertas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {openOnly.length} abiertas · {closed.length} resueltas
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Abiertas</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {openOnly.length === 0 && (
              <p className="text-sm text-zinc-500">Sin alertas activas.</p>
            )}
            {openOnly.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico resueltas</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {closed.map((a) => (
              <AlertRow key={a.id} alert={a} resolved />
            ))}
          </CardBody>
        </Card>
      </div>
    );
  }

  // DEFAULT VIEW: dashboard
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Plataforma SaaS · AMPERIUM EnergyTech
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Gestión activa de demanda</h1>
          <p className="mt-1 text-xs text-zinc-500">
            {customer.location} · cupo contratado CAMMESA {cupo} MW
          </p>
        </div>
        <Badge tone="cyan">tiempo real</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Demanda actual"
          value={currentMw.toFixed(2)}
          unit="MW"
          tone="cyan"
          hint={`Pico última hora ${peakMw.toFixed(1)} MW`}
        />
        <KpiCard
          label="Cupo CAMMESA"
          value={fmtPct(cupoPct)}
          unit="%"
          tone={cupoTone}
          hint={`${currentMw.toFixed(1)} / ${cupo} MW`}
        />
        <KpiCard
          label="Smart meters"
          value={String(meterCount ?? 0)}
          tone="zinc"
          hint="Activos en la red"
        />
        <KpiCard
          label="Alertas abiertas"
          value={String(open.length)}
          tone={open.length > 0 ? "amber" : "green"}
          hint={open.length > 0 ? "Requieren atención" : "Todo en orden"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Demanda agregada · última hora</CardTitle>
        </CardHeader>
        <CardBody>
          <LiveCoopChart initial={series} cupoMw={cupo} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Top 5 alimentadores (últimos 15 min)</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Serial</th>
                  <th className="px-5 py-2.5 text-left font-medium">Zona</th>
                  <th className="px-5 py-2.5 text-right font-medium">Consumo</th>
                  <th className="px-5 py-2.5 text-right font-medium">Carga</th>
                </tr>
              </thead>
              <tbody>
                {topMeters.map((m) => {
                  const load = (m.avg_kw / m.capacity_kw) * 100;
                  return (
                    <tr key={m.meter_id} className="border-b border-zinc-900 last:border-0">
                      <td className="px-5 py-3 font-mono text-xs text-cyan-300">
                        {m.serial}
                      </td>
                      <td className="px-5 py-3 text-zinc-300">{m.label}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {fmtKW(m.avg_kw)} kW
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`text-xs ${load > 80 ? "text-amber-400" : "text-zinc-400"}`}
                          >
                            {load.toFixed(0)}%
                          </span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={`h-full ${load > 80 ? "bg-amber-500" : "bg-cyan-500"}`}
                              style={{ width: `${Math.min(load, 100)}%` }}
                            />
                          </div>
                        </div>
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
            <CardTitle>Alertas CAMMESA activas</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {open.length === 0 && (
              <p className="text-sm text-zinc-500">
                Sin alertas. Operación dentro de cupo.
              </p>
            )}
            {open.slice(0, 5).map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
              >
                <div
                  className={`mt-0.5 h-2 w-2 rounded-full ${
                    a.severity === "critical"
                      ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                      : a.severity === "warning"
                        ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                        : "bg-cyan-500"
                  }`}
                />
                <div className="flex-1 text-sm">
                  <div className="font-medium text-zinc-200">{a.message}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {new Date(a.created_at).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    <span className="font-mono">{a.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mapa de medidores</CardTitle>
        </CardHeader>
        <CardBody>
          <CoopMetersMap meters={meterMarkers} height={300} />
        </CardBody>
      </Card>
    </div>
  );
}

function AlertRow({ alert, resolved }: { alert: Alert; resolved?: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        resolved
          ? "border-zinc-900 bg-zinc-950/40 opacity-60"
          : "border-zinc-800 bg-zinc-950/30"
      }`}
    >
      <Badge
        tone={
          alert.severity === "critical"
            ? "red"
            : alert.severity === "warning"
              ? "amber"
              : "cyan"
        }
      >
        {alert.severity.toUpperCase()}
      </Badge>
      <div className="flex-1">
        <div className="text-sm font-medium text-zinc-200">{alert.message}</div>
        <div className="mt-1 text-[11px] text-zinc-500">
          {new Date(alert.created_at).toLocaleString("es-AR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          <span className="font-mono">{alert.type}</span>
          {alert.acknowledged_at && " · resuelto"}
        </div>
      </div>
    </div>
  );
}
