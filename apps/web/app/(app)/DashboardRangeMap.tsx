"use client";

import { useEffect, useRef } from "react";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

export interface DashboardRangeBoundaryPoint {
  lat: number;
  lon: number;
  bearingDeg: number;
  ringFactor: number;
}

export interface DashboardRangeMapProps {
  origin: {
    lat: number;
    lon: number;
  };
  boundary: DashboardRangeBoundaryPoint[];
  displayName: string;
}

function carIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#171717;border:2px solid white;box-shadow:0 0 0 3px rgba(23,23,23,0.25);"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const CAR_ICON = carIcon();

export function DashboardRangeMap({
  origin,
  boundary,
  displayName,
}: DashboardRangeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const marker = L.marker([origin.lat, origin.lon], {
      icon: CAR_ICON,
    }).addTo(map);

    marker.bindTooltip(displayName);

    const usableBoundary = boundary.filter(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lon) &&
        point.ringFactor > 0,
    );

    let polygon: L.Polygon | null = null;

    if (usableBoundary.length >= 3) {
      const latLngs: L.LatLngTuple[] = usableBoundary.map((point) => [
        point.lat,
        point.lon,
      ]);

      polygon = L.polygon(latLngs, {
        color: "#2563eb",
        weight: 2,
        opacity: 0.85,
        fillColor: "#3b82f6",
        fillOpacity: 0.16,
      }).addTo(map);
    }

    const fit = () => {
      map.invalidateSize();

      if (polygon) {
        map.fitBounds(polygon.getBounds(), {
          padding: [24, 24],
        });
      } else {
        map.setView([origin.lat, origin.lon], 9);
      }
    };

    fit();

    const observer = new ResizeObserver(() => {
      const element = containerRef.current;

      if (element && element.clientHeight > 0) {
        fit();
        observer.disconnect();
      }
    });

    observer.observe(containerRef.current);

    map.on("click", () => {
      map.scrollWheelZoom.enable();
    });

    mapRef.current = map;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [boundary, displayName, origin.lat, origin.lon]);

  return (
    <div
      ref={containerRef}
      className="h-[300px] w-full rounded-lg border border-neutral-300 dark:border-neutral-700 sm:h-[340px]"
    />
  );
}
