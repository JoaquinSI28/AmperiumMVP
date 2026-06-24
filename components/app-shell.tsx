import Link from "next/link";

export function AppShell({
  orgName,
  orgLocation,
  userName,
  roleLabel,
  navItems,
  accent,
  children,
}: {
  orgName: string;
  orgLocation: string;
  userName: string;
  roleLabel: string;
  navItems: { href: string; label: string }[];
  accent: "amber" | "cyan";
  children: React.ReactNode;
}) {
  const accentClass =
    accent === "amber"
      ? "bg-amber-500 text-zinc-950 glow-amber"
      : "bg-cyan-500 text-zinc-950 glow-cyan";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="flex h-14 items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-md font-bold text-sm ${accentClass}`}
            >
              A
            </div>
            <span className="font-semibold tracking-tight">AMPERIUM</span>
          </Link>

          <div className="hidden h-6 w-px bg-zinc-800 sm:block" />

          <div className="hidden sm:block">
            <div className="text-sm font-medium">{orgName}</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              {orgLocation}
            </div>
          </div>

          <nav className="ml-auto flex items-center gap-1 text-sm">
            {navItems.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="rounded-md px-3 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
              >
                {it.label}
              </Link>
            ))}
          </nav>

          <div className="hidden h-6 w-px bg-zinc-800 lg:block" />

          <div className="hidden text-right lg:block">
            <div className="text-xs font-medium">{userName}</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              {roleLabel}
            </div>
          </div>

          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-6 py-6">{children}</main>

      <footer className="border-t border-zinc-900 px-6 py-3 text-[10px] uppercase tracking-wider text-zinc-600">
        AMPERIUM · Centro de monitoreo · Sistema Argentino de Interconexión
      </footer>
    </div>
  );
}
