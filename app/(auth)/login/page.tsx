"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type DemoUser = { email: string; label: string; role: string };

const DEMO_USERS: DemoUser[] = [
  { email: "director@amperium.demo",  label: "Dirección General",        role: "Resumen ejecutivo + portfolio" },
  { email: "operador@amperium.demo",  label: "Operador de la central",   role: "Operación turbina" },
  { email: "tandil@amperium.demo",    label: "Coop. Tandil (SaaS)",      role: "Dashboard cliente" },
  { email: "olavarria@amperium.demo", label: "Coop. Olavarría (SaaS)",   role: "Dashboard cliente" },
  { email: "azul@amperium.demo",      label: "Coop. Azul (SaaS)",        role: "Dashboard cliente" },
];

const DEMO_PASSWORD = "Amperium2026!";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_USERS[0].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur">
      <div className="mb-7 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-zinc-950 font-bold text-lg glow-amber">
          A
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight">AMPERIUM</div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Generación · MEM · SADI
          </div>
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-semibold">Sala de Control</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Plataforma de operación y despacho de la central térmica.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
            placeholder="usuario@amperium.demo"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
          Usuarios demo
        </p>
        <div className="grid grid-cols-1 gap-2">
          {DEMO_USERS.map((u) => (
            <button
              key={u.email}
              type="button"
              onClick={() => {
                setEmail(u.email);
                setPassword(DEMO_PASSWORD);
              }}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs transition-colors hover:border-amber-500/40 hover:bg-zinc-900"
            >
              <div className="font-medium text-zinc-200">{u.label}</div>
              <div className="truncate font-mono text-[10px] text-zinc-500">
                {u.email}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Accede a: {u.role}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
