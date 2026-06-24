import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ForecastChart } from "@/components/charts/forecast-chart";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  name: string;
  short_name: string;
  location: string;
  cammesa_peak_capacity_mw: number;
};

export default async function ForecastPage() {
  const supabase = await createClient();

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

  // Pre-fetch inicial: granularidad hora, 24h adelante, 12h atrás
  const { data: initialRows } = await supabase.rpc("forecast_demand", {
    p_customer_id: null,
    p_granularity: "hour",
    p_horizon: 24,
    p_history: 12,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Inteligencia de demanda · {customer.short_name}
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Predicción de demanda</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">
            Modelo estacional con ventana semanal: para cada bucket futuro la
            predicción combina la media de las últimas 4 semanas en el mismo
            instante (día de semana, hora, minuto). La banda ámbar representa la
            incertidumbre (μ ± 1.5σ).
          </p>
        </div>
        <Badge tone="amber">Cupo CAMMESA · {customer.cammesa_peak_capacity_mw} MW</Badge>
      </div>

      <Card glow="amber">
        <CardHeader>
          <CardTitle>Forecast interactivo</CardTitle>
        </CardHeader>
        <CardBody>
          <ForecastChart
            initial={{
              rows: (initialRows ?? []) as {
                bucket_ts: string;
                power_mw: number;
                lower_mw: number;
                upper_mw: number;
                is_forecast: boolean;
              }[],
              granularity: "hour",
              horizon: 24,
              history: 12,
              cupoMw: Number(customer.cammesa_peak_capacity_mw),
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo se usa este forecast</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-zinc-400">
          <p>
            <span className="font-semibold text-zinc-200">Operación:</span>{" "}
            anticipar picos antes de que superen el cupo contratado a CAMMESA y
            evitar penalizaciones por excesos de demanda. La banda superior
            indica el peor escenario probable.
          </p>
          <p>
            <span className="font-semibold text-zinc-200">Planificación:</span>{" "}
            programar mantenimientos en horarios de baja predicha. Negociar
            ampliaciones de cupo con CAMMESA basadas en evidencia.
          </p>
          <p>
            <span className="font-semibold text-zinc-200">Coordinación con AMPERIUM:</span>{" "}
            la generadora utiliza la suma de los forecasts de todas las
            cooperativas cliente para anticipar su despacho al SADI — esta es la
            sincronización oferta-demanda diferencial del modelo.
          </p>
          <p className="text-xs text-zinc-500">
            Algoritmo: naive seasonal forecast con lag de 7 días, 4 estaciones
            promediadas. La incertidumbre crece en granularidades finas porque
            la varianza muestral es mayor. Para horizonte mayor a 1 mes los
            valores se proyectan linealmente sobre el promedio diario disponible.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
