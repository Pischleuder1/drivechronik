"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Navigation, Share2 } from "lucide-react";

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
  stops: ShareStop[],
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

  const nextTarget = orderedStops[0] ?? {
    ...destination,
    label: destinationLabel || t("destination"),
    kind: "waypoint" as const,
    routeIndex: geometry.length - 1,
  };

  const routeUrl = mapsRouteUrl(start, destination, orderedStops);

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

  async function shareRoute() {
    setStatus(null);

    if (navigator.share) {
      try {
        await navigator.share({
          title: t("shareTitle"),
          text: t("routeShareText"),
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
    const copied = await copyText(
      `${t("shareTitle")}\n\n${stopList}\n\n${routeUrl}`,
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
          onClick={() => void shareRoute()}
          className={buttonClasses("secondary", "md")}
        >
          <Share2 aria-hidden size={16} />
          {t("shareRoute")}
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

      <p className="mt-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {t("hint")}
      </p>

      {status && (
        <p
          role="status"
          className="mt-2 text-xs font-medium text-neutral-700 dark:text-neutral-300"
        >
          {status}
        </p>
      )}
    </Panel>
  );
}
