"use client";

import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";

export type MeterMarker = {
  id: string;
  serial: string;
  label: string;
  lat: number;
  lng: number;
  capacity_kw: number;
  current_kw: number;
};

export default function CoopMetersMapImpl({
  meters,
  height = 320,
}: {
  meters: MeterMarker[];
  height?: number;
}) {
  if (meters.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-zinc-800 text-xs text-zinc-500"
        style={{ height }}
      >
        Sin medidores con coordenadas.
      </div>
    );
  }

  const center: [number, number] = [
    meters.reduce((a, m) => a + m.lat, 0) / meters.length,
    meters.reduce((a, m) => a + m.lng, 0) / meters.length,
  ];

  return (
    <div
      className="overflow-hidden rounded-xl border border-zinc-800"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "100%", width: "100%", background: "#09090b" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="&copy; OpenStreetMap · CartoDB Dark Matter"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {meters.map((m) => {
          const load = (m.current_kw / m.capacity_kw) * 100;
          const color =
            load > 90 ? "#ef4444" : load > 70 ? "#f59e0b" : "#22d3ee";
          return (
            <CircleMarker
              key={m.id}
              center={[m.lat, m.lng]}
              radius={7}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.65,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1} sticky>
                <div style={{ fontSize: 11 }}>
                  <strong>{m.serial}</strong>
                  <br />
                  {m.label} · {m.current_kw.toFixed(0)} kW
                </div>
              </Tooltip>
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  <strong>{m.serial}</strong>
                  <br />
                  {m.label}
                  <br />
                  <span style={{ color: "#52525b" }}>Capacidad</span>{" "}
                  <strong>{m.capacity_kw.toLocaleString("es-AR")} kW</strong>
                  <br />
                  <span style={{ color: "#52525b" }}>Consumo actual</span>{" "}
                  <strong>{m.current_kw.toFixed(0)} kW</strong>{" "}
                  ({load.toFixed(0)}%)
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
