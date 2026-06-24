"use client";

import dynamic from "next/dynamic";
import type { MeterMarker } from "./coop-meters-map.impl";

const Map = dynamic(() => import("./coop-meters-map.impl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-500">
      Cargando mapa…
    </div>
  ),
});

export function CoopMetersMap(props: {
  meters: MeterMarker[];
  height?: number;
}) {
  return <Map {...props} />;
}
