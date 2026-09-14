"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface PlannerMapChargingSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  stalls: number | null;
  network: "tesla" | "ionity" | "enbw" | "fastned" | "other";
  powerKw: number | null;
}

export interface PlannerMapProps {
  /** Route-Polyline als [lat, lon]-Tupel. */
  geometry: [number, number][];
  waypoints: Array<{ lat: number; lon: number }>;

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

function waypointIcon(number: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html:
      "<div style='width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:#2563eb;color:white;border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.4);font-family:Arial,sans-serif;font-size:13px;font-weight:700;'>" +
      String(number) +
      "</div>",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

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

function fastChargerIcon(color: string): L.DivIcon {
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
          font-size:17px;
          font-weight:700;
          line-height:1;
          transform:rotate(45deg);
        ">⚡</span>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -27],
  });
}

const FAST_CHARGER_ICON = fastChargerIcon("#2563eb");
const RECOMMENDED_FAST_CHARGER_ICON = fastChargerIcon("#f59e0b");

/*
 * Alte Inline-Definition wird entfernt.
 */


export function PlannerMap({
  geometry,
  waypoints,
  chargingSites,
  recommendedChargingStops,
}: PlannerMapProps) {
  const t = useTranslations("planner");
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

    waypoints.forEach((waypoint, index) => {
      L.marker([waypoint.lat, waypoint.lon], {
        icon: waypointIcon(index + 1),
        title: "Zwischenziel " + String(index + 1),
        zIndexOffset: 500,
      })
        .addTo(map)
        .bindPopup(
          "<strong>Zwischenziel " + String(index + 1) + "</strong>",
        );
    });

    // Auf der Gesamtübersicht bleiben Tesla-Supercharger und empfohlene
    // Ladestopps immer sichtbar. Die zahlreichen übrigen HPCs werden erst
    // beim Hineinzoomen eingeblendet.
    const hpcLayer = L.layerGroup();

    for (const site of chargingSites) {
      const stallsText =
        site.stalls != null
          ? `${site.stalls} Ladepunkte`
          : "Anzahl Ladepunkte unbekannt";

      const isRecommended =
        recommendedChargingStops.some((stop) => stop.id === site.id);

      const isTesla = site.network === "tesla";

      const icon = isTesla
        ? isRecommended
          ? RECOMMENDED_SUPERCHARGER_ICON
          : TESLA_SUPERCHARGER_ICON
        : isRecommended
          ? RECOMMENDED_FAST_CHARGER_ICON
          : FAST_CHARGER_ICON;

      const marker = L.marker([site.lat, site.lon], {
        icon,
        title: site.name,
        zIndexOffset: isRecommended ? 1000 : isTesla ? 300 : 0,
      }).bindPopup(`
          <div style="min-width:180px">
            ${
              isRecommended
                ? `<strong>${escapeHtml(t("map.recommendedChargingStop"))}</strong><br>`
                : isTesla
                  ? "<strong>Tesla Supercharger</strong><br>"
                  : `<strong>${escapeHtml(t("map.fastCharger"))}</strong><br>`
            }
            ${escapeHtml(site.name)}<br>
            <span style="color:#666">
              ${escapeHtml(stallsText)}
              ${
                site.powerKw != null
                  ? ` · ${escapeHtml(t("map.upTo"))} ${Math.round(site.powerKw)} kW`
                  : ""
              }
            </span>
          </div>
        `);

      if (isTesla || isRecommended) {
        marker.addTo(map);
      } else {
        marker.addTo(hpcLayer);
      }
    }

    const updateHpcVisibility = () => {
      const showHpc = map.getZoom() >= 9;

      if (showHpc && !map.hasLayer(hpcLayer)) {
        hpcLayer.addTo(map);
      } else if (!showHpc && map.hasLayer(hpcLayer)) {
        map.removeLayer(hpcLayer);
      }
    };

    map.on("zoomend", updateHpcVisibility);

    const fit = () => {
      map.invalidateSize();
      map.fitBounds(polyline.getBounds(), {
        padding: [24, 24],
      });
      updateHpcVisibility();
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
      map.off("zoomend", updateHpcVisibility);
      map.remove();
      mapRef.current = null;
    };

  }, [geometry, waypoints, chargingSites, recommendedChargingStops, t]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 sm:h-[360px]"
    />
  );
}
