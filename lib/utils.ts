export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function fmtMW(kw: number) {
  return (kw / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export function fmtKW(kw: number) {
  return kw.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export function fmtPct(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}
