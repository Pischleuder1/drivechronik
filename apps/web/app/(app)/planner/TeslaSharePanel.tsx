"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ListOrdered,
  Navigation,
  QrCode,
  Share2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { buttonClasses } from "../../../components/ui/Button";
import { Panel } from "../../../components/ui/Panel";

interface Coords {
  lat: number;
  lon: number;
}

interface ChargingStop extends Coords {
  name: string;
}

interface ShareStop extends Coords {
  label: string;
  kind: "waypoint" | "charging";
  routeIndex: number;
}

const MAX_ROUTE_WAYPOINTS = 9;

interface NamedRoutePoint extends Coords {
  label: string;
  kind: "start" | "waypoint" | "charging" | "destination";
}

interface RouteSegment {
  origin: NamedRoutePoint;
  destination: NamedRoutePoint;
  waypoints: NamedRoutePoint[];
}

function buildRouteSegments(points: NamedRoutePoint[]): RouteSegment[] {
  const segments: RouteSegment[] = [];
  let cursor = 0;

  while (cursor < points.length - 1) {
    const destinationIndex = Math.min(
      cursor + MAX_ROUTE_WAYPOINTS + 1,
      points.length - 1,
    );

    const origin = points[cursor];
    const destination = points[destinationIndex];

    if (!origin || !destination) break;

    segments.push({
      origin,
      destination,
      waypoints: points.slice(cursor + 1, destinationIndex),
    });

    cursor = destinationIndex;
  }

  return segments;
}

function distanceSquared(a: Coords, b: Coords): number {
  const latScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const dLat = a.lat - b.lat;
  const dLon = (a.lon - b.lon) * latScale;

  return dLat * dLat + dLon * dLon;
}

function nearestRouteIndex(
  point: Coords,
  geometry: [number, number][],
): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  geometry.forEach(([lat, lon], index) => {
    const distance = distanceSquared(point, { lat, lon });

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function mapsPlaceUrl(point: Coords): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${point.lat},${point.lon}`);

  return url.toString();
}

function mapsRouteUrl(
  origin: Coords,
  destination: Coords,
  stops: Coords[],
): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set(
    "origin",
    `${origin.lat},${origin.lon}`,
  );
  url.searchParams.set(
    "destination",
    `${destination.lat},${destination.lon}`,
  );

  if (stops.length > 0) {
    url.searchParams.set(
      "waypoints",
      stops.map((stop) => `${stop.lat},${stop.lon}`).join("|"),
    );
  }

  return url.toString();
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below — clipboard API may be unavailable on plain HTTP.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    return copied;
  } catch {
    return false;
  }
}

export function TeslaSharePanel({
  geometry,
  waypoints,
  startLabel,
  waypointLabels,
  destinationLabel,
  chargingStops,
}: {
  geometry: [number, number][];
  waypoints: Coords[];
  startLabel: string;
  waypointLabels: string[];
  destinationLabel: string;
  chargingStops: ChargingStop[];
}) {
  const t = useTranslations("planner.teslaShare");
  const [status, setStatus] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [handoffIndex, setHandoffIndex] = useState(0);
  const [routePartIndex, setRoutePartIndex] = useState(0);

  useEffect(() => {
    if (!status) return;

    const timer = window.setTimeout(() => {
      setStatus(null);
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [status]);

  const start = useMemo<Coords | null>(() => {
    const first = geometry[0];
    return first ? { lat: first[0], lon: first[1] } : null;
  }, [geometry]);

  const destination = useMemo<Coords | null>(() => {
    const last = geometry.at(-1);
    return last ? { lat: last[0], lon: last[1] } : null;
  }, [geometry]);

  const orderedStops = useMemo<ShareStop[]>(() => {
    if (geometry.length === 0) return [];

    const manualStops: ShareStop[] = waypoints.map((point, index) => ({
      ...point,
      label:
        waypointLabels[index] ||
        t("manualWaypoint", { index: index + 1 }),
      kind: "waypoint",
      routeIndex: nearestRouteIndex(point, geometry),
    }));

    const chargeStops: ShareStop[] = chargingStops.map((stop) => ({
      lat: stop.lat,
      lon: stop.lon,
      label: stop.name,
      kind: "charging",
      routeIndex: nearestRouteIndex(stop, geometry),
    }));

    return [...manualStops, ...chargeStops].sort(
      (a, b) => a.routeIndex - b.routeIndex,
    );
  }, [chargingStops, geometry, t, waypointLabels, waypoints]);

  if (!start || !destination) return null;

  const handoffTargets: NamedRoutePoint[] = [
    ...orderedStops.map((stop) => ({
      lat: stop.lat,
      lon: stop.lon,
      label: stop.label,
      kind: stop.kind,
    })),
    {
      ...destination,
      label: destinationLabel || t("destination"),
      kind: "destination",
    },
  ];

  const safeHandoffIndex = Math.min(
    handoffIndex,
    Math.max(0, handoffTargets.length - 1),
  );

  const nextTarget = handoffTargets[safeHandoffIndex];

  const routePoints: NamedRoutePoint[] = [
    {
      ...start,
      label: startLabel || t("start"),
      kind: "start",
    },
    ...orderedStops.map((stop) => ({
      lat: stop.lat,
      lon: stop.lon,
      label: stop.label,
      kind: stop.kind,
    })),
    {
      ...destination,
      label: destinationLabel || t("destination"),
      kind: "destination",
    },
  ];

  const routeSegments = buildRouteSegments(routePoints);

  const safeRoutePartIndex = Math.min(
    routePartIndex,
    Math.max(0, routeSegments.length - 1),
  );

  const selectedRouteSegment = routeSegments[safeRoutePartIndex];

  if (!nextTarget || !selectedRouteSegment) return null;

  const routeUrls = routeSegments.map((segment) =>
    mapsRouteUrl(
      segment.origin,
      segment.destination,
      segment.waypoints,
    ),
  );

  const routeUrl = routeUrls[safeRoutePartIndex];

  const selectedRouteSequence = [
    selectedRouteSegment.origin,
    ...selectedRouteSegment.waypoints,
    selectedRouteSegment.destination,
  ];

  const stopList = [
    `${t("start")}: ${startLabel || t("start")} — ${start.lat.toFixed(6)}, ${start.lon.toFixed(6)}`,
    ...orderedStops.map(
      (stop, index) =>
        `${index + 1}. ${
          stop.kind === "charging"
            ? `${t("chargingStop")}: ${stop.label}`
            : stop.label
        } — ${stop.lat.toFixed(6)}, ${stop.lon.toFixed(6)}`,
    ),
    `${t("destination")}: ${destinationLabel || t("destination")} — ${destination.lat.toFixed(6)}, ${destination.lon.toFixed(6)}`,
  ].join("\n");

  async function shareTarget(stop: Coords & { label: string }) {
    setStatus(null);

    const url = mapsPlaceUrl(stop);

    if (navigator.share) {
      try {
        await navigator.share({
          title: t("shareTitle"),
          text: stop.label,
          url,
        });
        setStatus(t("shared"));
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    const copied = await copyText(url);
    setStatus(copied ? t("linkCopied") : t("shareFailed"));
  }

  async function copyTarget(stop: Coords & { label: string }) {
    const copied = await copyText(
      `${stop.lat.toFixed(6)},${stop.lon.toFixed(6)}`,
    );

    setStatus(copied ? t("targetCopied") : t("shareFailed"));
  }

  function advanceHandoff() {
    setStatus(null);
    setHandoffIndex((current) =>
      Math.min(current + 1, handoffTargets.length - 1),
    );
  }

  async function shareRoute() {
    setStatus(null);

    if (navigator.share) {
      try {
        await navigator.share({
          title: t("shareTitle"),
          text:
            routeSegments.length > 1
              ? `${t("routeShareText")} · ${t("routePart", {
                  current: safeRoutePartIndex + 1,
                  total: routeSegments.length,
                })}`
              : t("routeShareText"),
          url: routeUrl,
        });
        setStatus(t("shared"));
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    const copied = await copyText(routeUrl);
    setStatus(copied ? t("linkCopied") : t("shareFailed"));
  }

  async function copyStops() {
    const routeLinks = routeUrls
      .map((url, index) =>
        routeUrls.length > 1
          ? `${t("routePart", {
              current: index + 1,
              total: routeUrls.length,
            })}: ${url}`
          : url,
      )
      .join("\n");

    const copied = await copyText(
      `${t("shareTitle")}\n\n${stopList}\n\n${routeLinks}`,
    );

    setStatus(copied ? t("stopsCopied") : t("shareFailed"));
  }

  return (
    <Panel
      title={t("title")}
      subtitle={t("description")}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void shareTarget(nextTarget)}
          className={buttonClasses("primary", "md")}
        >
          <Navigation aria-hidden size={16} />
          {t("sendTesla")}
        </button>

        <button
          type="button"
          onClick={() => setShowHandoff((current) => !current)}
          className={buttonClasses("secondary", "md")}
          aria-expanded={showHandoff}
        >
          <ListOrdered aria-hidden size={16} />
          {showHandoff ? t("hideHandoff") : t("handoffMode")}
        </button>

        <button
          type="button"
          onClick={() => void shareRoute()}
          className={buttonClasses("secondary", "md")}
        >
          <Share2 aria-hidden size={16} />
          {t("shareRoute")}
        </button>

        <button
          type="button"
          onClick={() => setShowQr((current) => !current)}
          className={buttonClasses("secondary", "md")}
          aria-expanded={showQr}
        >
          <QrCode aria-hidden size={16} />
          {showQr ? t("hideQr") : t("openOnPhone")}
        </button>

        <button
          type="button"
          onClick={() => void copyStops()}
          className={buttonClasses("secondary", "md")}
        >
          <Copy aria-hidden size={16} />
          {t("copyStops")}
        </button>
      </div>

      {status && (
        <div
          role="status"
          className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          ✓ {status}
        </div>
      )}

      {routeSegments.length > 1 && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t("routeSplitTitle")}
          </p>

          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            {t("routeSplitHint", {
              count: orderedStops.length,
              max: MAX_ROUTE_WAYPOINTS,
              parts: routeSegments.length,
            })}
          </p>

          <p className="mt-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            {selectedRouteSegment.origin.label}
            {" → "}
            {selectedRouteSegment.destination.label}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={safeRoutePartIndex === 0}
              onClick={() =>
                setRoutePartIndex((current) => Math.max(0, current - 1))
              }
              className={buttonClasses("secondary", "sm")}
            >
              <ChevronLeft aria-hidden size={14} />
              {t("previousPart")}
            </button>

            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {t("routePart", {
                current: safeRoutePartIndex + 1,
                total: routeSegments.length,
              })}
            </span>

            <button
              type="button"
              disabled={safeRoutePartIndex >= routeSegments.length - 1}
              onClick={() =>
                setRoutePartIndex((current) =>
                  Math.min(routeSegments.length - 1, current + 1),
                )
              }
              className={buttonClasses("secondary", "sm")}
            >
              {t("nextPart")}
              <ChevronRight aria-hidden size={14} />
            </button>
          </div>
        </div>
      )}

      {showQr && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-2xl bg-white p-3 shadow-sm">
              <QRCodeSVG
                value={routeUrl}
                size={196}
                level="M"
              />
            </div>

            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t("qrTitle")}
              </p>

              <p className="mt-1 max-w-md text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {t("qrDescription")}
              </p>

              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                {selectedRouteSequence
                  .map((point) => point.label)
                  .join(" → ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {showHandoff && (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t("handoffTitle")}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {t("handoffDescription", { max: MAX_ROUTE_WAYPOINTS })}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-blue-300 bg-white p-4 dark:border-blue-800 dark:bg-neutral-900">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">
              {t("currentTarget")} ·{" "}
              {t("targetProgress", {
                current: safeHandoffIndex + 1,
                total: handoffTargets.length,
              })}
            </p>

            <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {nextTarget.label}
            </p>

            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {nextTarget.lat.toFixed(6)}, {nextTarget.lon.toFixed(6)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void shareTarget(nextTarget)}
                className={buttonClasses("primary", "sm")}
              >
                <Share2 aria-hidden size={14} />
                {t("shareCurrent")}
              </button>

              <button
                type="button"
                onClick={() => void copyTarget(nextTarget)}
                className={buttonClasses("secondary", "sm")}
              >
                <Copy aria-hidden size={14} />
                {t("copyTarget")}
              </button>

              <button
                type="button"
                disabled={safeHandoffIndex >= handoffTargets.length - 1}
                onClick={advanceHandoff}
                className={buttonClasses("secondary", "sm")}
              >
                {safeHandoffIndex >= handoffTargets.length - 1
                  ? t("handoffDone")
                  : t("nextHandoff")}
                <ChevronRight aria-hidden size={14} />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {handoffTargets.map((target, index) => {
              const active = index === safeHandoffIndex;

              return (
                <div
                  key={`${target.kind}-${target.lat}-${target.lon}-${index}`}
                  className={
                    "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between " +
                    (active
                      ? "border-blue-400 bg-blue-100/70 dark:border-blue-700 dark:bg-blue-950/40"
                      : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900")
                  }
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {index + 1}. {target.label}
                    </p>

                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {target.kind === "charging"
                        ? t("chargingStop")
                        : target.kind === "destination"
                          ? t("destination")
                          : t("manualStop")}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void copyTarget(target)}
                      className={buttonClasses("secondary", "sm")}
                    >
                      <Copy aria-hidden size={14} />
                      {t("copyTarget")}
                    </button>

                    <button
                      type="button"
                      onClick={() => void shareTarget(target)}
                      className={buttonClasses("secondary", "sm")}
                    >
                      <Share2 aria-hidden size={14} />
                      {t("shareStop")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!showHandoff && (
        <>
          <div className="mt-4 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {t("nextTarget")}
        </p>

        <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {nextTarget.label}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("start")}
          </p>
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {startLabel || t("start")}
          </p>
        </div>
      </div>

      {orderedStops.length > 0 && (
        <ol className="mt-4 space-y-2">
          {orderedStops.map((stop, index) => (
            <li
              key={`${stop.kind}-${stop.lat}-${stop.lon}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {index + 1}. {stop.label}
                </p>

                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {stop.kind === "charging"
                    ? t("chargingStop")
                    : t("manualStop")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void shareTarget(stop)}
                className={buttonClasses("secondary", "sm", "shrink-0")}
              >
                <Share2 aria-hidden size={14} />
                {t("shareStop")}
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("destination")}
          </p>
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {destinationLabel || t("destination")}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {destination.lat.toFixed(5)}, {destination.lon.toFixed(5)}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void shareTarget({
              ...destination,
              label: destinationLabel || t("destination"),
            })
          }
          className={buttonClasses("secondary", "sm", "shrink-0")}
        >
          <Share2 aria-hidden size={14} />
          {t("shareStop")}
        </button>
      </div>
        </>
      )}

      <p className="mt-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {t("hint")}
      </p>

    </Panel>
  );
}
