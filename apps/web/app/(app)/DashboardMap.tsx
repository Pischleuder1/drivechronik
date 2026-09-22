"use client";

import { useEffect, useRef } from "react";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

import type { DriveTrack } from "../../lib/dashboard";

export interface DashboardMapProps {
  tracks: DriveTrack[];

  car: {
    lat: number;
    lon: number;
    displayName: string;
    placeName: string | null;
  } | null;

  onSelectDrive: (driveId: number) => void;
}

function carIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#171717;border:2px solid white;box-shadow:0 0 0 3px rgba(23,23,23,0.25);"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const ROUTE_COLORS = [
  "#dc2626", // 1 rot
  "#2563eb", // 2 blau
  "#171717", // 3 schwarz
  "#737373", // 4 grau
  "#7c3aed", // 5 violett
];

function routeColor(index: number): string {
  return ROUTE_COLORS[index] ?? "#737373";
}

function routeNumberIcon(number: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:flex;
      align-items:center;
      justify-content:center;
      width:22px;
      height:22px;
      border-radius:9999px;
      background:${color};
      color:white;
      border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
      font-size:11px;
      font-weight:600;
      line-height:1;
    ">${number}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function endCircleIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:block;
      width:12px;
      height:12px;
      border-radius:9999px;
      background:${color};
      border:2px solid white;
      box-shadow:0 0 0 1px rgba(0,0,0,0.35);
    "></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function startCircleIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:block;
      width:12px;
      height:12px;
      border-radius:9999px;
      background:white;
      border:3px solid ${color};
      box-shadow:0 0 0 1px rgba(0,0,0,0.25);
    "></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function routeMidpoint(points: L.LatLngTuple[]): L.LatLngTuple {
  return points[Math.floor((points.length - 1) / 2)]!;
}

const CAR_ICON = carIcon();

/**
 * Dashboard overview of the five most recent drives.
 *
 * 1 = newest drive, then 2–5 in descending age.
 * Each drive has its own color, a numbered marker on the route and
 * a small same-colored circle at the real destination.
 */
export function DashboardMap({
  tracks,
  car,
  onSelectDrive,
}: DashboardMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (tracks.length === 0) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    // tracks kommen newest-first.
    // Ältere zuerst zeichnen, damit die neueste Route oben liegt.
    const [newest, ...older] = tracks;

    for (const [olderIndex, track] of older.entries()) {
      const latLngs: L.LatLngTuple[] = track.points.map((p) => [
        p[0],
        p[1],
      ]);

      if (latLngs.length < 2) continue;

      // olderIndex 0 = Fahrt 2 = blau
      const driveNumber = olderIndex + 2;
      const color = routeColor(olderIndex + 1);

      const line = L.polyline(latLngs, {
        color,
        weight: 3,
        opacity: 0.9,
      }).addTo(map);

      line.on("click", () => onSelectDrive(track.driveId));
      line.on("mouseover", () => line.setStyle({ opacity: 1 }));
      line.on("mouseout", () => line.setStyle({ opacity: 0.9 }));

      // Nummer auf der Route
      const routeMarker = L.marker(routeMidpoint(latLngs), {
        icon: routeNumberIcon(driveNumber, color),
      }).addTo(map);

      routeMarker.on("click", () => onSelectDrive(track.driveId));

      // Start = hohler Kreis, Ziel = gefüllter Kreis
      const start = latLngs[0]!;
      const end = latLngs[latLngs.length - 1]!;

      const startMarker = L.marker(start, {
        icon: startCircleIcon(color),
      }).addTo(map);

      startMarker.on("click", () => onSelectDrive(track.driveId));

      const endMarker = L.marker(end, {
        icon: endCircleIcon(color),
      }).addTo(map);

      endMarker.on("click", () => onSelectDrive(track.driveId));

      bounds.extend(line.getBounds());
    }

    if (newest && newest.points.length >= 2) {
      const latLngs: L.LatLngTuple[] = newest.points.map((p) => [
        p[0],
        p[1],
      ]);

      // Fahrt 1 = rot
      const color = routeColor(0);

      const line = L.polyline(latLngs, {
        color,
        weight: 4,
        opacity: 0.95,
      }).addTo(map);

      line.on("click", () => onSelectDrive(newest.driveId));

      // Nummer auf der Route
      const routeMarker = L.marker(routeMidpoint(latLngs), {
        icon: routeNumberIcon(1, color),
      }).addTo(map);

      routeMarker.on("click", () => onSelectDrive(newest.driveId));

      // Start = hohler Kreis, Ziel = gefüllter Kreis
      const start = latLngs[0]!;
      const end = latLngs[latLngs.length - 1]!;

      const startMarker = L.marker(start, {
        icon: startCircleIcon(color),
      }).addTo(map);

      startMarker.on("click", () => onSelectDrive(newest.driveId));

      const endMarker = L.marker(end, {
        icon: endCircleIcon(color),
      }).addTo(map);

      endMarker.on("click", () => onSelectDrive(newest.driveId));

      bounds.extend(line.getBounds());
    }

    if (car) {
      const marker = L.marker([car.lat, car.lon], {
        icon: CAR_ICON,
      }).addTo(map);

      const label = car.placeName
        ? `${car.displayName} · ${car.placeName}`
        : car.displayName;

      marker.bindTooltip(label);
      bounds.extend([car.lat, car.lon]);
    }

    const fit = () => {
      map.invalidateSize();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [24, 24],
        });
      } else {
        map.setView([47.3769, 8.5417], 12);
      }
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

    // Leaflet wird für diesen Daten-Fingerprint neu gemountet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[300px] w-full rounded-lg border border-neutral-300 dark:border-neutral-700 sm:h-[340px]"
    />
  );
}
