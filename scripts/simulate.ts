/**
 * Simulador AMPERIUM (central + 3 coops cliente SaaS).
 * Cada tick:
 *  - inserta plant_state para la única central
 *  - inserta readings para los 45 smart meters de las cooperativas
 *
 * Uso: npm run simulate
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { tickAll } from "../lib/simulator/tick";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const INTERVAL_MS = Number(process.env.SIMULATE_INTERVAL_MS ?? 10000);

async function loop() {
  try {
    const r = await tickAll(supabase);
    const gen = r.plant[0]?.mw_active ?? 0;
    const dem =
      Array.from(r.coops.demand_by_coop.values()).reduce((a, b) => a + b, 0) / 1000;
    const delta = gen - dem;
    console.log(
      `[${new Date().toLocaleTimeString("es-AR")}]`,
      `f=${r.factor.toFixed(2)}`,
      `gen=${gen.toFixed(1)}MW`,
      `dem(coops)=${dem.toFixed(1)}MW`,
      `Δ=${delta.toFixed(2)}MW`,
      `meters=${r.coops.meters_count}`,
      r.coops.alerts_fired ? `⚠${r.coops.alerts_fired}` : "",
    );
  } catch (err) {
    console.error("[loop]", err);
  }
}

console.log(
  `AMPERIUM simulator (central + SaaS) · interval ${INTERVAL_MS}ms · ${new Date().toISOString()}`,
);
loop();
setInterval(loop, INTERVAL_MS);
