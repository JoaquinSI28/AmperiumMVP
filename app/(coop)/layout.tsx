import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function CoopLayout({
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
    .select(
      "display_name, role, customer:customers(name, short_name, location)",
    )
    .eq("id", user.id)
    .single<{
      display_name: string;
      role: "operator" | "director" | "coop_operator";
      customer: { name: string; short_name: string; location: string } | null;
    }>();

  if (!profile) redirect("/login");
  if (profile.role !== "coop_operator") redirect("/operation");

  const coopName = profile.customer?.name ?? "Cooperativa";
  const coopLocation = profile.customer?.location ?? "—";

  return (
    <AppShell
      orgName={coopName}
      orgLocation={coopLocation}
      userName={profile.display_name}
      roleLabel="Operador SaaS · AMPERIUM"
      accent="cyan"
      navItems={[
        { href: "/coop", label: "Dashboard" },
        { href: "/coop/forecast", label: "Predicción" },
        { href: "/coop?view=meters", label: "Medidores" },
        { href: "/coop?view=alerts", label: "Alertas" },
      ]}
    >
      {children}
    </AppShell>
  );
}
