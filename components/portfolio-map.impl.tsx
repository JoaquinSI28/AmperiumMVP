"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";

export type PlantMarker = {
  name: string;
  short_name: string;
  location: string;
  lat: number;
  lng: number;
  capacity_mw: number;
  current_mw: number;
};

export type CoopMarker = {
  slug: string;
  name: string;
  short_name: string;
  location: string;
  lat: number;
  lng: number;
  cammesa_peak_capacity_mw: number;
  current_mw: number;
  meter_count: number;
  open_alerts: number;
};

export default function PortfolioMapImpl({
  plant,
  coops,
  selectedCoop,
  height = 340,
}: {
  plant: PlantMarker;
  coops: CoopMarker[];
  selectedCoop?: string;
  height?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function selectCoop(slug: string) {
    const next = new URLSearchParams(params.toString());
    if (next.get("coop") === slug) {
      next.delete("coop");
    } else {
      next.set("coop", slug);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  const all = [
    { lat: plant.lat, lng: plant.lng },
    ...coops.map((c) => ({ lat: c.lat, lng: c.lng })),
  ];
  const center: [number, number] = [
    all.reduce((a, p) => a + p.lat, 0) / all.length,
    all.reduce((a, p) => a + p.lng, 0) / all.length,
  ];

  return (
    <div
      className="overflow-hidden rounded-xl border border-zinc-800"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={7}
        style={{ height: "100%", width: "100%", background: "#09090b" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="&copy; OpenStreetMap · CartoDB Dark Matter"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Marker AMPERIUM (central) — ámbar grande */}
        <CircleMarker
          center={[plant.lat, plant.lng]}
          radius={16}
          pathOptions={{
            color: "#f59e0b",
            fillColor: "#f59e0b",
            fillOpacity: 0.85,
            weight: 3,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1} sticky>
            <div style={{ fontSize: 11 }}>
              <strong>{plant.short_name}</strong>
              <br />
              Generación · {plant.current_mw.toFixed(1)} / {plant.capacity_mw} MW
            </div>
          </Tooltip>
          <Popup>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              <strong style={{ fontSize: 13 }}>{plant.name}</strong>
              <br />
              {plant.location}
              <br />
              <span style={{ color: "#52525b" }}>Capacidad nominal</span>{" "}
              <strong>{plant.capacity_mw} MW</strong>
              <br />
              <span style={{ color: "#52525b" }}>Inyección actual</span>{" "}
              <strong>{plant.current_mw.toFixed(2)} MW</strong>
              <br />
              <em style={{ color: "#a1a1aa", fontSize: 11 }}>
                Inyecta al MEM / SADI
              </em>
            </div>
          </Popup>
        </CircleMarker>

        {/* Markers de cooperativas cliente del SaaS — cian */}
        {coops.map((c) => {
          const isSel = c.slug === selectedCoop;
          const load = (c.current_mw / c.cammesa_peak_capacity_mw) * 100;
          const color =
            load > 100 ? "#ef4444" : load > 85 ? "#f59e0b" : "#22d3ee";
          return (
            <CircleMarker
              key={c.slug}
              center={[c.lat, c.lng]}
              radius={isSel ? 13 : 10}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: isSel ? 0.85 : 0.55,
                weight: isSel ? 3 : 2,
              }}
              eventHandlers={{ click: () => selectCoop(c.slug) }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1} sticky>
                <div style={{ fontSize: 11 }}>
                  <strong>{c.short_name}</strong>
                  <br />
                  Demanda {c.current_mw.toFixed(1)} / {c.cammesa_peak_capacity_mw} MW
                </div>
              </Tooltip>
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  <strong style={{ fontSize: 13 }}>{c.name}</strong>
                  <br />
                  {c.location}
                  <br />
                  <span style={{ color: "#52525b" }}>Demanda actual</span>{" "}
                  <strong>{c.current_mw.toFixed(2)} MW</strong>
                  <br />
                  <span style={{ color: "#52525b" }}>Cupo CAMMESA</span>{" "}
                  <strong>{c.cammesa_peak_capacity_mw} MW</strong>{" "}
                  ({load.toFixed(0)}%)
                  <br />
                  <span style={{ color: "#52525b" }}>Smart meters</span>{" "}
                  <strong>{c.meter_count}</strong>
                  <br />
                  {c.open_alerts > 0 && (
                    <>
                      <span style={{ color: "#f59e0b" }}>
                        ⚠ {c.open_alerts} alertas activas
                      </span>
                      <br />
                    </>
                  )}
                  <button
                    onClick={() => selectCoop(c.slug)}
                    style={{
                      marginTop: 8,
                      padding: "4px 10px",
                      background: "#f59e0b",
                      color: "#09090b",
                      border: 0,
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {isSel ? "Ver vista global" : "Ver detalle SaaS"}
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
