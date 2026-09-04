"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface PlannerMapChargingSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  stalls: number | null;
}

export interface PlannerMapProps {
  /** Route-Polyline als [lat, lon]-Tupel. */
  geometry: [number, number][];

  /** Tesla-Supercharger im Routenkorridor. */
  chargingSites: PlannerMapChargingSite[];

  /** Vom Planer ausgewählter Ladestopp. */
  recommendedChargingStops: PlannerMapChargingSite[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

/**
 * Roter Supercharger-Pin mit stilisiertem Tesla-T.
 * Kein externes Bild erforderlich.
 */
function superchargerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:30px;
        height:30px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:50% 50% 50% 8%;
        background:${color};
        border:2px solid white;
        box-shadow:0 1px 5px rgba(0,0,0,0.4);
        transform:rotate(-45deg);
      ">
        <span style="
          color:white;
          font-family:Arial,sans-serif;
          font-size:18px;
          font-weight:700;
          line-height:1;
          transform:rotate(45deg);
        ">T</span>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -27],
  });
}

const TESLA_SUPERCHARGER_ICON = superchargerIcon("#e82127");
const RECOMMENDED_SUPERCHARGER_ICON = superchargerIcon("#f59e0b");

/*
 * Alte Inline-Definition wird entfernt.
 */


export function PlannerMap({
  geometry,
  chargingSites,
  recommendedChargingStops,
}: PlannerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (geometry.length < 2) return;

    const latLngs: L.LatLngTuple[] = geometry.map((p) => [p[0], p[1]]);

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const polyline = L.polyline(latLngs, {
      color: "#2563eb",
      weight: 4,
      opacity: 0.85,
    }).addTo(map);

    L.marker(latLngs[0]!, {
      icon: START_ICON,
      title: "Start",
    }).addTo(map);

    L.marker(latLngs[latLngs.length - 1]!, {
      icon: END_ICON,
      title: "Ziel",
    }).addTo(map);

    for (const site of chargingSites) {
      const stallsText =
        site.stalls != null
          ? `${site.stalls} Ladepunkte`
          : "Anzahl Ladepunkte unbekannt";

      const isRecommended =
        recommendedChargingStops.some((stop) => stop.id === site.id);

      L.marker([site.lat, site.lon], {
        icon: isRecommended
          ? RECOMMENDED_SUPERCHARGER_ICON
          : TESLA_SUPERCHARGER_ICON,
        title: site.name,
        zIndexOffset: isRecommended ? 1000 : 0,
      })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px">
            ${
              isRecommended
                ? "<strong>Empfohlener Ladestopp</strong><br>"
                : "<strong>Tesla Supercharger</strong><br>"
            }
            ${escapeHtml(site.name)}<br>
            <span style="color:#666">
              ${escapeHtml(stallsText)}
            </span>
          </div>
        `);
    }

    const fit = () => {
      map.invalidateSize();
      map.fitBounds(polyline.getBounds(), {
        padding: [24, 24],
      });
    };

    fit();

    const ro = new ResizeObserver(() => {
      const el = containerRef.current;

      if (el && el.clientHeight > 0) {
        fit();
        ro.disconnect();
      }
    });

    if (containerRef.current) {
      ro.observe(containerRef.current);
    }

    map.on("click", () => {
      map.scrollWheelZoom.enable();
    });

    mapRef.current = map;

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };

  }, [geometry, chargingSites, recommendedChargingStops]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 sm:h-[360px]"
    />
  );
}
