import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single<{ display_name: string; role: "operator" | "director" | "coop_operator" }>();

  if (!profile) redirect("/login");
  if (profile.role === "coop_operator") redirect("/coop");

  const navItems = [
    ...(profile.role === "director"
      ? [{ href: "/executive", label: "Resumen ejecutivo" }]
      : []),
    { href: "/operation", label: "Operación" },
  ];

  return (
    <AppShell
      orgName="AMPERIUM · Central Térmica"
      orgLocation="Tandil Sur · Provincia de Buenos Aires"
      userName={profile.display_name}
      roleLabel={profile.role === "director" ? "Dirección General" : "Operador de turno"}
      accent="amber"
      navItems={navItems}
    >
      {children}
    </AppShell>
  );
}
