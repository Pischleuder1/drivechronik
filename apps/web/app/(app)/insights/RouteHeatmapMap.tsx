"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

import type { RouteHeatmapSegment } from "../../../lib/routeHeatmapLogic";

interface VisualSegment {
  segment: RouteHeatmapSegment;
  smoothedCount: number;
  intensity: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const COLOR_STOPS: Array<{
  position: number;
  color: Rgb;
}> = [
  {
    position: 0,
    color: { r: 37, g: 99, b: 235 },
  }, // blue-600

  {
    position: 0.34,
    color: { r: 34, g: 197, b: 94 },
  }, // green-500

  {
    position: 0.68,
    color: { r: 245, g: 158, b: 11 },
  }, // amber-500

  {
    position: 1,
    color: { r: 220, g: 38, b: 38 },
  }, // red-600
];

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function median(
  values: number[],
): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort(
    (a, b) => a - b,
  );

  const middle = Math.floor(
    sorted.length / 2,
  );

  if (sorted.length % 2 === 1) {
    return sorted[middle]!;
  }

  return (
    sorted[middle - 1]! +
    sorted[middle]!
  ) / 2;
}

/**
 * Der Key wird in routeHeatmapLogic aus
 *
 *   gridA|gridB
 *
 * aufgebaut. Damit können wir direkt ermitteln,
 * welche Segmente aneinander angrenzen.
 */
function endpointKeys(
  segment: RouteHeatmapSegment,
): [string, string] {
  const separator =
    segment.key.indexOf("|");

  if (separator < 0) {
    /*
     * Defensive Fallbacks für eventuell später
     * anders erzeugte Segmente.
     */
    return [
      `${segment.fromLat}:${segment.fromLon}`,
      `${segment.toLat}:${segment.toLon}`,
    ];
  }

  return [
    segment.key.slice(0, separator),
    segment.key.slice(separator + 1),
  ];
}

function buildSmoothedCounts(
  segments: RouteHeatmapSegment[],
): number[] {
  const endpointIndex =
    new Map<string, number[]>();

  segments.forEach(
    (segment, index) => {
      const [from, to] =
        endpointKeys(segment);

      for (const endpoint of [
        from,
        to,
      ]) {
        const entries =
          endpointIndex.get(endpoint);

        if (entries) {
          entries.push(index);
        } else {
          endpointIndex.set(
            endpoint,
            [index],
          );
        }
      }
    },
  );

  return segments.map(
    (segment, index) => {
      const [from, to] =
        endpointKeys(segment);

      const neighbourIndices =
        new Set<number>([
          ...(endpointIndex.get(from) ??
            []),
          ...(endpointIndex.get(to) ??
            []),
        ]);

      neighbourIndices.delete(index);

      if (
        neighbourIndices.size === 0
      ) {
        return segment.driveCount;
      }

      const localValues = [
        segment.driveCount,
        ...[...neighbourIndices].map(
          (neighbourIndex) =>
            segments[neighbourIndex]!
              .driveCount,
        ),
      ];

      /*
       * Median statt Mittelwert:
       *
       * An Kreuzungen soll eine sehr stark
       * befahrene Querstraße nicht automatisch
       * alle abzweigenden Nebenstrecken rot färben.
       */
      const localMedian =
        median(localValues);

      /*
       * Der echte Wert bleibt dominant.
       * Der Nachbarschaftsmedian beruhigt nur
       * das visuelle Blau-Grün-Gelb-Flackern.
       */
      return (
        segment.driveCount * 0.65 +
        localMedian * 0.35
      );
    },
  );
}

function heatIntensity(
  count: number,
  highReference: number,
): number {
  if (count <= 1) {
    return 0;
  }

  /*
   * Wurzel-Skalierung als Mittelweg:
   *
   * - linear war bei großen Maximalwerten zu blau
   * - logarithmisch färbte zu viele Abschnitte rot
   *
   * Eine einmalige Nutzung bleibt sicher blau.
   * Erst wiederholt gefahrene Strecken wandern
   * sichtbar Richtung grün, gelb und rot.
   */
  const denominator =
    Math.max(1, highReference - 1);

  const relative = clamp(
    (count - 1) / denominator,
    0,
    1,
  );

  return Math.sqrt(relative);
}

function interpolate(
  a: number,
  b: number,
  ratio: number,
): number {
  return Math.round(
    a + (b - a) * ratio,
  );
}

function heatColor(
  intensity: number,
): string {
  const value = clamp(
    intensity,
    0,
    1,
  );

  for (
    let index = 1;
    index < COLOR_STOPS.length;
    index += 1
  ) {
    const lower =
      COLOR_STOPS[index - 1]!;
    const upper =
      COLOR_STOPS[index]!;

    if (
      value <= upper.position
    ) {
      const span =
        upper.position -
        lower.position;

      const ratio =
        span > 0
          ? (value -
              lower.position) /
            span
          : 0;

      return `rgb(${interpolate(
        lower.color.r,
        upper.color.r,
        ratio,
      )}, ${interpolate(
        lower.color.g,
        upper.color.g,
        ratio,
      )}, ${interpolate(
        lower.color.b,
        upper.color.b,
        ratio,
      )})`;
    }
  }

  const last =
    COLOR_STOPS[
      COLOR_STOPS.length - 1
    ]!.color;

  return `rgb(${last.r}, ${last.g}, ${last.b})`;
}

function prepareVisualSegments(
  segments: RouteHeatmapSegment[],
  maxDriveCount: number,
): VisualSegment[] {
  if (segments.length === 0) {
    return [];
  }

  const smoothedCounts =
    buildSmoothedCounts(segments);

  /*
   * Die echte maximale Nutzung bleibt der
   * Referenzpunkt für "rot".
   *
   * Durch die Wurzel-Skalierung werden mittlere
   * Nutzungen trotzdem deutlich hervorgehoben,
   * ohne dass fast die ganze Karte rot wird.
   */
  const highReference =
    Math.max(2, maxDriveCount);

  return segments
    .map((segment, index) => {
      const smoothedCount =
        smoothedCounts[index]!;

      return {
        segment,
        smoothedCount,
        intensity:
          heatIntensity(
            smoothedCount,
            highReference,
          ),
      };
    })
    /*
     * Seltene Abschnitte zuerst zeichnen.
     * Häufig gefahrene Strecken liegen danach
     * sichtbar darüber.
     */
    .sort(
      (a, b) =>
        a.intensity -
          b.intensity ||
        a.segment.key.localeCompare(
          b.segment.key,
        ),
    );
}

export function RouteHeatmapMap({
  segments,
  maxDriveCount,
  drivesLabel,
}: {
  segments: RouteHeatmapSegment[];
  maxDriveCount: number;
  drivesLabel: string;
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const mapRef =
    useRef<L.Map | null>(null);

  useEffect(() => {
    if (
      !containerRef.current ||
      mapRef.current ||
      segments.length === 0
    ) {
      return;
    }

    const map = L.map(
      containerRef.current,
      {
        scrollWheelZoom: false,
        zoomControl: true,
        preferCanvas: true,
      },
    );

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          "&copy; OpenStreetMap contributors",
      },
    ).addTo(map);

    const renderer = L.canvas({
      padding: 0.5,
    });

    const bounds =
      L.latLngBounds([]);

    const visualSegments =
      prepareVisualSegments(
        segments,
        maxDriveCount,
      );

    for (const item of visualSegments) {
      const { segment, intensity } =
        item;

      const from: L.LatLngTuple = [
        segment.fromLat,
        segment.fromLon,
      ];

      const to: L.LatLngTuple = [
        segment.toLat,
        segment.toLon,
      ];

      bounds.extend(from);
      bounds.extend(to);

      /*
       * Seltene Linien bleiben dünner und
       * etwas transparenter.
       *
       * Häufige Linien werden zunehmend
       * kräftiger, ohne die Karte zu
       * überdecken.
       */
      const weight =
        2.2 +
        Math.sqrt(intensity) *
          3.8;

      const opacity =
        0.48 +
        intensity * 0.44;

      L.polyline([from, to], {
        renderer,

        color:
          heatColor(intensity),

        weight,
        opacity,

        /*
         * "round" erzeugte bei sehr kurzen
         * Rastersegmenten den gepunkteten
         * Eindruck. Butt-Caps schließen
         * benachbarte Segmente ruhiger an.
         */
        lineCap: "butt",
        lineJoin: "round",

        interactive: true,
      })
        .bindTooltip(
          `${segment.driveCount} ${drivesLabel}`,
          {
            sticky: true,
          },
        )
        .addTo(map);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [26, 26],
        maxZoom: 14,
      });
    }

    map.on("click", () =>
      map.scrollWheelZoom.enable(),
    );

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [
    drivesLabel,
    maxDriveCount,
    segments,
  ]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full rounded-xl border border-neutral-300 dark:border-neutral-700 lg:h-[560px]"
    />
  );
}
