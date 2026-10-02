"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { RoutePointTuple } from "../../../../lib/driveRoute";

export interface DriveMapProps {
  points: RoutePointTuple[];
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

/**
 * Read-only Leaflet view of one recorded drive.
 *
 * Each route segment is coloured by the recorded speed:
 * blue -> cyan -> green -> amber -> red.
 *
 * The dark underlay keeps the track readable independently of the map tiles.
 */
export function DriveMap({ points }: DriveMapProps) {
  const t = useTranslations("drives");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

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

    // Dunkle Kontur unter der farbigen Route für bessere Lesbarkeit.
    L.polyline(latLngs, {
      color: "#0f172a",
      weight: 8,
      opacity: 0.38,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Einzelne Segmente nach Geschwindigkeit einfärben.
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

    L.marker(latLngs[0]!, { icon: START_ICON }).addTo(map);
    L.marker(latLngs[latLngs.length - 1]!, { icon: END_ICON }).addTo(map);

    map.fitBounds(L.latLngBounds(latLngs), {
      padding: [28, 28],
    });

    // Scroll-Zoom erst nach bewusstem Klick in die Karte aktivieren.
    map.on("click", () => map.scrollWheelZoom.enable());

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // points stammen von der serverseitig geladenen Fahrt und ändern sich
    // während der Lebensdauer dieser Detailansicht nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral-300 shadow-sm dark:border-neutral-700">
      <div
        ref={containerRef}
        className="h-[320px] w-full sm:h-[380px]"
      />

      <div className="pointer-events-none absolute right-3 top-3 z-[800] min-w-[164px] rounded-xl border border-white/20 bg-slate-950/85 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium">
            {t("map.speed")}
          </span>
          <span className="text-[10px] text-slate-300">km/h</span>
        </div>

        <div
          className="h-1.5 w-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #2563eb 0%, #06b6d4 25%, #22c55e 50%, #f59e0b 75%, #ef4444 100%)",
          }}
        />

        <div className="mt-1 flex justify-between text-[9px] tabular-nums text-slate-300">
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
