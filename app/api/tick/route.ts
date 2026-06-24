/**
 * Endpoint llamado por Vercel Cron cada minuto.
 * Inserta un tick de telemetría usando la service_role key.
 *
 * Vercel autentica las crons internas con el header `Authorization: Bearer $CRON_SECRET`.
 * Si CRON_SECRET no está seteado, queda público para que también lo podamos disparar manual.
 */
import { createClient } from "@supabase/supabase-js";
import { tickAll } from "@/lib/simulator/tick";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "missing supabase env vars" },
      { status: 500 },
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const result = await tickAll(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
