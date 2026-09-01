"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

export interface YearlyDestinationMapPoint {
  key: string;
  label: string;
  visitCount: number;
  distanceKm: number;
  lat: number;
  lon: number;
}

export interface YearlyDestinationMapProps {
  points: YearlyDestinationMapPoint[];
  locale: string;
  visitsLabel: string;
  distanceLabel: string;
}

export function YearlyDestinationMap({
  points,
  locale,
  visitsLabel,
  distanceLabel,
}: YearlyDestinationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || points.length === 0) {
      return;
    }

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const maxVisits = Math.max(
      ...points.map((point) => point.visitCount),
      1,
    );

    const bounds = L.latLngBounds([]);

    const numberFormatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });

    for (const point of points) {
      const position: L.LatLngTuple = [point.lat, point.lon];
      bounds.extend(position);

      const relativeVisits = point.visitCount / maxVisits;

      const marker = L.circleMarker(position, {
        radius: 7 + Math.sqrt(relativeVisits) * 14,
        color: "#171717",
        weight: 2,
        fillColor: "#171717",
        fillOpacity: 0.22 + relativeVisits * 0.58,
      });

      const popup = document.createElement("div");

      const title = document.createElement("div");
      title.style.fontWeight = "600";
      title.style.marginBottom = "4px";
      title.textContent = point.label;

      const details = document.createElement("div");
      details.style.fontSize = "12px";
      details.textContent =
        `${visitsLabel}: ${point.visitCount} · ` +
        `${distanceLabel}: ${numberFormatter.format(point.distanceKm)} km`;

      popup.append(title, details);

      marker.bindPopup(popup);
      marker.addTo(map);
    }

    if (points.length === 1) {
      map.setView(bounds.getCenter(), 13);
    } else {
      map.fitBounds(bounds, {
        padding: [28, 28],
        maxZoom: 13,
      });
    }

    map.on("click", () => map.scrollWheelZoom.enable());

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [distanceLabel, locale, points, visitsLabel]);

  return (
    <div
      ref={containerRef}
      className="h-72 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 sm:h-96"
    />
  );
}
