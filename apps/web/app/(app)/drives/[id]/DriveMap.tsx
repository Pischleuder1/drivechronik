"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { RoutePointTuple } from "../../../../lib/driveRoute";
import type { TrafficEvent } from "../../../../lib/traffic/types";

export interface DriveMapProps {
  points: RoutePointTuple[];
  activePointIndex?: number | null;
  trafficEvents?: TrafficEvent[];
}

function markerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.4);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const START_ICON = markerIcon("#16a34a");
const END_ICON = markerIcon("#dc2626");

function speedColor(speedKmh: number | null): string {
  if (speedKmh == null) return "#94a3b8";
  if (speedKmh <= 30) return "#2563eb";
  if (speedKmh <= 60) return "#06b6d4";
  if (speedKmh <= 100) return "#22c55e";
  if (speedKmh <= 130) return "#f59e0b";
  return "#ef4444";
}

function segmentSpeed(
  from: RoutePointTuple,
  to: RoutePointTuple,
): number | null {
  const a = from[3];
  const b = to[3];

  if (a != null && b != null) return (a + b) / 2;
  if (a != null) return a;
  if (b != null) return b;

  return null;
}

function trafficColor(type: TrafficEvent["type"]): string {
  switch (type) {
    case "closure":
      return "#dc2626";
    case "warning":
      return "#f59e0b";
    case "roadwork":
    default:
      return "#f97316";
  }
}

function trafficSymbol(type: TrafficEvent["type"]): string {
  switch (type) {
    case "closure":
      return "×";
    case "warning":
      return "!";
    case "roadwork":
    default:
      return "◆";
  }
}

function trafficIcon(type: TrafficEvent["type"]): L.DivIcon {
  const color = trafficColor(type);
  const symbol = trafficSymbol(type);

  return L.divIcon({
    className: "",
    html: `
      <span
        style="
          display:flex;
          align-items:center;
          justify-content:center;
          width:24px;
          height:24px;
          border-radius:9999px;
          background:${color};
          color:white;
          border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          font-size:13px;
          font-weight:800;
          line-height:1;
        "
      >${symbol}</span>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function DriveMap({
  points,
  activePointIndex = null,
  trafficEvents = [],
}: DriveMapProps) {
  const t = useTranslations("drives");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const activeMarkerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (points.length < 2) return;

    const latLngs: L.LatLngTuple[] = points.map((p) => [p[0], p[1]]);

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // Dunkle Kontur unter der Route.
    L.polyline(latLngs, {
      color: "#0f172a",
      weight: 8,
      opacity: 0.38,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Route segmentweise nach Geschwindigkeit einfärben.
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1]!;
      const current = points[i]!;

      L.polyline(
        [
          [previous[0], previous[1]],
          [current[0], current[1]],
        ],
        {
          color: speedColor(segmentSpeed(previous, current)),
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        },
      ).addTo(map);
    }

    L.marker(latLngs[0]!, {
      icon: START_ICON,
      zIndexOffset: 900,
    }).addTo(map);

    L.marker(latLngs[latLngs.length - 1]!, {
      icon: END_ICON,
      zIndexOffset: 900,
    }).addTo(map);

    // Aktuelle Verkehrsmeldungen entlang der Strecke.
    for (const event of trafficEvents) {
      const marker = L.marker(
        [event.lat, event.lon],
        {
          icon: trafficIcon(event.type),
          zIndexOffset:
            event.type === "closure"
              ? 850
              : event.type === "warning"
                ? 800
                : 750,
        },
      ).addTo(map);

      // DOM-basiertes Tooltip statt ungeprüftes HTML aus der API.
      const tooltip = document.createElement("div");

      const heading = document.createElement("div");
      heading.style.fontWeight = "600";
      heading.textContent =
        `${event.motorway} · ${t(`traffic.type.${event.type}`)}`;

      const title = document.createElement("div");
      title.style.marginTop = "2px";
      title.textContent = event.title;

      const distance = document.createElement("div");
      distance.style.marginTop = "3px";
      distance.style.fontSize = "11px";
      distance.style.opacity = "0.75";
      distance.textContent =
        `${event.routeDistanceKm.toFixed(1)} km`;

      tooltip.append(heading, title, distance);

      marker.bindTooltip(tooltip, {
        direction: "top",
        offset: [0, -10],
        opacity: 0.96,
      });
    }

    map.fitBounds(L.latLngBounds(latLngs), {
      padding: [28, 28],
    });

    map.on("click", () => map.scrollWheelZoom.enable());

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      activeMarkerRef.current = null;
    };

    // Die Props stammen aus der serverseitig geladenen Detailseite und ändern
    // sich während dieser Ansicht nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronisierter Chart-Cursor.
  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    if (
      activePointIndex == null ||
      activePointIndex < 0 ||
      activePointIndex >= points.length
    ) {
      if (activeMarkerRef.current) {
        activeMarkerRef.current.remove();
        activeMarkerRef.current = null;
      }

      return;
    }

    const point = points[activePointIndex];
    if (!point) return;

    const latLng: L.LatLngExpression = [point[0], point[1]];

    if (!activeMarkerRef.current) {
      activeMarkerRef.current = L.circleMarker(latLng, {
        radius: 7,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
        opacity: 1,
        interactive: false,
      }).addTo(map);
    } else {
      activeMarkerRef.current.setLatLng(latLng);
    }

    activeMarkerRef.current.bringToFront();
  }, [activePointIndex, points]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral-300 shadow-sm dark:border-neutral-700">
      <div
        ref={containerRef}
        className="h-[255px] w-full sm:h-[300px]"
      />

      <div className="pointer-events-none absolute right-2 top-2 z-[800] min-w-[136px] rounded-lg border border-white/20 bg-slate-950/85 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium">
            {t("map.speed")}
          </span>

          <span className="text-[9px] text-slate-300">
            km/h
          </span>
        </div>

        <div
          className="h-[5px] w-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #2563eb 0%, #06b6d4 25%, #22c55e 50%, #f59e0b 75%, #ef4444 100%)",
          }}
        />

        <div className="mt-0.5 flex justify-between text-[8px] tabular-nums text-slate-300">
          <span>0</span>
          <span>30</span>
          <span>60</span>
          <span>100</span>
          <span>130+</span>
        </div>
      </div>
    </div>
  );
}
