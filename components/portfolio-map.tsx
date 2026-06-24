"use client";

import dynamic from "next/dynamic";
import type { PlantMarker, CoopMarker } from "./portfolio-map.impl";

const Map = dynamic(() => import("./portfolio-map.impl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[340px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-500">
      Cargando mapa…
    </div>
  ),
});

export function PortfolioMap(props: {
  plant: PlantMarker;
  coops: CoopMarker[];
  selectedCoop?: string;
  height?: number;
}) {
  return <Map {...props} />;
}
