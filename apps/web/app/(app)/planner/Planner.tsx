"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Navigation, TriangleAlert } from "lucide-react";
import { formatDuration } from "@drivechronik/core";
import type { PlannerPlace, PlannerStatus } from "../../../lib/planner";
import {
  planRoute,
  type PlanResult,
} from "../../../lib/actions/planner";
import type { AddressSearchResult } from "../../../lib/actions/places";
import { buttonClasses } from "../../../components/ui/Button";
import { DestinationSearch } from "./DestinationSearch";
import { PlannerMapLoader } from "./PlannerMapLoader";

export interface PlannerProps {
  vehicleId: number;
  places: PlannerPlace[];
  status: PlannerStatus | null;
  defaultSoc: number;
  defaultTempC: number;
  defaultCapacityKwh: number;
  capacityIsDerived: boolean;
  historyDriveCount: number;
  osrmIsDefault: boolean;
}

const CURRENT_VALUE = "current";

/** Mappt den fachlichen baseSource-Wert auf den camelCase-Key in messages/planner.json#baseSource. */
const BASE_SOURCE_KEYS: Record<PlanResult["baseSource"], string> = {
  "temp-bin": "tempBin",
  "history-avg": "historyAvg",
  "vehicle-efficiency": "vehicleEfficiency",
  default: "default",
};

const inputClasses =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100";
const labelClasses =
  "block text-xs font-medium text-neutral-600 dark:text-neutral-400";

interface Coords {
  lat: number;
  lon: number;
}

interface WaypointInput {
  id: number;
  mode: "place" | "address";
  placeValue: string;
  address: AddressSearchResult | null;
  query: string;
}

interface SocTone {
  /** Key unter messages/planner.json#arrivalTone — Übersetzung erfolgt beim Aufrufer. */
  labelKey: "comfortable" | "tight" | "critical";
  card: string;
  value: string;
}

/** Ampel-Farbgebung des Ankunfts-SoC: grün ≥20 %, gelb 10–20 %, rot <10 %. */
function socTone(soc: number): SocTone {
  if (soc >= 20) {
    return {
      labelKey: "comfortable",
      card: "border-green-300 bg-green-50 dark:border-green-900/60 dark:bg-green-950/30",
      value: "text-green-700 dark:text-green-400",
    };
  }
  if (soc >= 10) {
    return {
      labelKey: "tight",
      card: "border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30",
      value: "text-amber-700 dark:text-amber-400",
    };
  }
  return {
    labelKey: "critical",
    card: "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
    value: "text-red-700 dark:text-red-400",
  };
}

function formatKm(km: number): string {
  return `${km.toFixed(km < 100 ? 1 : 0)} km`;
}

function formatSignedKwh(kwh: number): string {
  const sign = kwh > 0 ? "+" : kwh < 0 ? "−" : "";
  return `${sign}${Math.abs(kwh).toFixed(1)} kWh`;
}

export function Planner({
  vehicleId,
  places,
  status,
  defaultSoc,
  defaultTempC,
  defaultCapacityKwh,
  capacityIsDerived,
  historyDriveCount,
  osrmIsDefault,
}: PlannerProps) {
  const t = useTranslations("planner");
  const hasCurrentPosition = status?.hasPosition ?? false;

  // Start: eigener Ort / aktuelle Fahrzeugposition ODER Adresssuche.
  const [startMode, setStartMode] = useState<"place" | "address">(
    hasCurrentPosition || places.length > 0 ? "place" : "address",
  );
  const [startValue, setStartValue] = useState<string>(
    hasCurrentPosition
      ? CURRENT_VALUE
      : places[0]
        ? `place:${places[0].id}`
        : "",
  );
  const [startAddress, setStartAddress] = useState<AddressSearchResult | null>(
    null,
  );
  const [startQuery, setStartQuery] = useState("");

  // Ziel: eigener Ort ODER Adresssuche.
  const [destMode, setDestMode] = useState<"place" | "address">(
    places.length > 0 ? "place" : "address",
  );
  const [destPlaceValue, setDestPlaceValue] = useState<string>(
    places[0] ? `place:${places[0].id}` : "",
  );
  const [destAddress, setDestAddress] = useState<AddressSearchResult | null>(
    null,
  );
  const [destQuery, setDestQuery] = useState("");
  const [waypoints, setWaypoints] = useState<WaypointInput[]>([]);
  const [nextWaypointId, setNextWaypointId] = useState(1);

  const [soc, setSoc] = useState(String(defaultSoc));
  const [tempC, setTempC] = useState(String(defaultTempC));
  const [capacityKwh, setCapacityKwh] = useState(String(defaultCapacityKwh));

  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [plannedWaypoints, setPlannedWaypoints] = useState<Coords[]>([]);
  const [planId, setPlanId] = useState(0);

  // Die Server-Action liefert keinen echten Zwischenstand. Deshalb zeigt
  // DriveChronik während der Berechnung nachvollziehbare Arbeitsphasen an,
  // ohne einen technisch exakten Prozentwert vorzutäuschen.
  useEffect(() => {
    if (!pending) return;

    const steps = [
      {
        afterMs: 500,
        progress: 25,
        label: "Route wird berechnet …",
      },
      {
        afterMs: 1400,
        progress: 45,
        label: "Verbrauch wird prognostiziert …",
      },
      {
        afterMs: 2600,
        progress: 68,
        label: "Schnelllader entlang der Route werden geprüft …",
      },
      {
        afterMs: 4200,
        progress: 88,
        label: "Ladeplanung wird optimiert …",
      },
    ];

    const timers = steps.map((step) =>
      window.setTimeout(() => {
        setProgress(step.progress);
        setProgressStage(step.label);
      }, step.afterMs),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pending]);

  // 100 % nach erfolgreicher Berechnung noch kurz sichtbar lassen.
  useEffect(() => {
    if (pending || progress !== 100) return;

    const timer = window.setTimeout(() => {
      setProgress(0);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [pending, progress]);

  function resolvePlaceValue(value: string): Coords | null {
    if (value === CURRENT_VALUE) {
      if (status?.lat != null && status?.lon != null) {
        return { lat: status.lat, lon: status.lon };
      }
      return null;
    }
    const id = Number(value.replace("place:", ""));
    const place = places.find((p) => p.id === id);
    return place ? { lat: place.lat, lon: place.lon } : null;
  }

  function resolveStart(): Coords | null {
    if (startMode === "place") return resolvePlaceValue(startValue);
    if (startAddress) return { lat: startAddress.lat, lon: startAddress.lon };
    return null;
  }

  function resolveDestination(): Coords | null {
    if (destMode === "place") return resolvePlaceValue(destPlaceValue);
    if (destAddress) return { lat: destAddress.lat, lon: destAddress.lon };
    return null;
  }

  function addWaypoint() {
    if (waypoints.length >= 10) return;

    setWaypoints((current) => [
      ...current,
      {
        id: nextWaypointId,
        mode: places.length > 0 ? "place" : "address",
        placeValue: places[0] ? "place:" + places[0].id : "",
        address: null,
        query: "",
      },
    ]);
    setNextWaypointId((current) => current + 1);
  }

  function updateWaypoint(id: number, patch: Partial<WaypointInput>) {
    setWaypoints((current) =>
      current.map((waypoint) =>
        waypoint.id === id ? { ...waypoint, ...patch } : waypoint,
      ),
    );
  }

  function removeWaypoint(id: number) {
    setWaypoints((current) =>
      current.filter((waypoint) => waypoint.id !== id),
    );
  }

  function moveWaypoint(id: number, direction: -1 | 1) {
    setWaypoints((current) => {
      const index = current.findIndex((waypoint) => waypoint.id === id);
      const targetIndex = index + direction;

      if (
        index < 0 ||
        targetIndex < 0 ||
        targetIndex >= current.length
      ) {
        return current;
      }

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function resolveWaypoints(): Coords[] | null {
    const resolved: Coords[] = [];

    for (const waypoint of waypoints) {
      const coords =
        waypoint.mode === "place"
          ? resolvePlaceValue(waypoint.placeValue)
          : waypoint.address
            ? { lat: waypoint.address.lat, lon: waypoint.address.lon }
            : null;

      if (!coords) return null;
      resolved.push(coords);
    }

    return resolved;
  }

  async function handleSubmit(e: React.FormEvent, routeOptionId?: string) {
    e.preventDefault();

    const start = resolveStart();
    const dest = resolveDestination();
    const resolvedWaypoints = resolveWaypoints();
    if (!start) {
      setError(t("errors.missingStart"));
      return;
    }
    if (!dest) {
      setError(
        destMode === "address"
          ? t("errors.missingDestAddress")
          : t("errors.missingDestPlace"),
      );
      return;
    }
    if (!resolvedWaypoints) {
      setError("Bitte alle Zwischenziele vollständig auswählen.");
      return;
    }

    const socNum = Number(soc);
    const tempNum = Number(tempC);
    const capNum = Number(capacityKwh);
    if (!Number.isFinite(socNum) || socNum < 0 || socNum > 100) {
      setError(t("errors.socRange"));
      return;
    }
    if (!Number.isFinite(tempNum)) {
      setError(t("errors.tempInvalid"));
      return;
    }
    if (!Number.isFinite(capNum) || capNum < 5 || capNum > 250) {
      setError(t("errors.capacityRange"));
      return;
    }

    setProgress(8);
    setProgressStage("Route wird vorbereitet …");
    setPending(true);
    setError(null);
    const res = await planRoute({
      vehicleId,
      startLat: start.lat,
      startLon: start.lon,
      destLat: dest.lat,
      destLon: dest.lon,
      waypoints: resolvedWaypoints,
      startSoc: socNum,
      tempC: tempNum,
      capacityKwh: capNum,
      routeOptionId,
    });
    if (!res.ok) {
      setPending(false);
      setProgress(0);
      setProgressStage("");
      setError(res.error);
      setPlan(null);
      return;
    }
    setPlan(res.plan);
    setPlannedWaypoints(resolvedWaypoints);
    setPlanId((n) => n + 1);
    setProgressStage("Berechnung abgeschlossen");
    setProgress(100);
    setPending(false);
  }

  async function handleRouteSelect(routeOptionId: string) {
    await handleSubmit(
      { preventDefault() {} } as React.FormEvent,
      routeOptionId,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Start */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClasses}>{t("form.start")}</span>
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStartMode("place")}
                  className={`rounded px-1.5 py-0.5 ${
                    startMode === "place"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {t("form.destModePlace")}
                </button>
                <button
                  type="button"
                  onClick={() => setStartMode("address")}
                  className={`rounded px-1.5 py-0.5 ${
                    startMode === "address"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {t("form.destModeAddress")}
                </button>
              </div>
            </div>

            <div className="mt-1">
              {startMode === "place" ? (
                <select
                  id="planner-start"
                  value={startValue}
                  onChange={(e) => setStartValue(e.target.value)}
                  className={inputClasses}
                >
                  {hasCurrentPosition && (
                    <option value={CURRENT_VALUE}>
                      {t("form.currentPosition")}
                    </option>
                  )}
                  {places.length === 0 && !hasCurrentPosition && (
                    <option value="">{t("form.noPlaces")}</option>
                  )}
                  {places.map((p) => (
                    <option key={p.id} value={`place:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <DestinationSearch
                  value={startQuery}
                  onValueChange={(v) => {
                    setStartQuery(v);
                    setStartAddress(null);
                  }}
                  onSelect={setStartAddress}
                />
              )}
            </div>
          </div>

          {/* Ziel */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClasses}>{t("form.destination")}</span>
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDestMode("place")}
                  className={`rounded px-1.5 py-0.5 ${
                    destMode === "place"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {t("form.destModePlace")}
                </button>
                <button
                  type="button"
                  onClick={() => setDestMode("address")}
                  className={`rounded px-1.5 py-0.5 ${
                    destMode === "address"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {t("form.destModeAddress")}
                </button>
              </div>
            </div>
            <div className="mt-1">
              {destMode === "place" ? (
                <select
                  aria-label={t("form.destPlaceAriaLabel")}
                  value={destPlaceValue}
                  onChange={(e) => setDestPlaceValue(e.target.value)}
                  className={inputClasses}
                >
                  {places.length === 0 && (
                    <option value="">{t("form.noPlaces")}</option>
                  )}
                  {places.map((p) => (
                    <option key={p.id} value={`place:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <DestinationSearch
                  value={destQuery}
                  onValueChange={(v) => {
                    setDestQuery(v);
                    setDestAddress(null);
                  }}
                  onSelect={setDestAddress}
                />
              )}
            </div>
          </div>

          {/* Zwischenziele */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className={labelClasses}>Zwischenziele</span>
              <button
                type="button"
                onClick={addWaypoint}
                disabled={waypoints.length >= 10}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-400 dark:hover:text-white"
              >
                + Zwischenziel hinzufügen
              </button>
            </div>

            {waypoints.length > 0 && (
              <div className="mt-2 flex flex-col gap-3">
                {waypoints.map((waypoint, index) => (
                  <div
                    key={waypoint.id}
                    className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        Zwischenziel {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveWaypoint(waypoint.id, -1)}
                          disabled={index === 0}
                          aria-label={"Zwischenziel " + (index + 1) + " nach oben"}
                          title="Nach oben"
                          className="rounded px-1.5 py-0.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-neutral-800 dark:hover:text-white"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWaypoint(waypoint.id, 1)}
                          disabled={index === waypoints.length - 1}
                          aria-label={"Zwischenziel " + (index + 1) + " nach unten"}
                          title="Nach unten"
                          className="rounded px-1.5 py-0.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-neutral-800 dark:hover:text-white"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWaypoint(waypoint.id)}
                          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>

                    <div className="mb-2 flex gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          updateWaypoint(waypoint.id, {
                            mode: "place",
                            address: null,
                            query: "",
                          })
                        }
                        className={
                          "rounded px-1.5 py-0.5 " +
                          (waypoint.mode === "place"
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white")
                        }
                      >
                        Ort
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateWaypoint(waypoint.id, {
                            mode: "address",
                          })
                        }
                        className={
                          "rounded px-1.5 py-0.5 " +
                          (waypoint.mode === "address"
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white")
                        }
                      >
                        Adresse
                      </button>
                    </div>

                    {waypoint.mode === "place" ? (
                      <select
                        value={waypoint.placeValue}
                        onChange={(e) =>
                          updateWaypoint(waypoint.id, {
                            placeValue: e.target.value,
                          })
                        }
                        className={inputClasses}
                      >
                        {places.length === 0 && (
                          <option value="">Keine Orte vorhanden</option>
                        )}
                        {places.map((place) => (
                          <option key={place.id} value={"place:" + place.id}>
                            {place.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <DestinationSearch
                        value={waypoint.query}
                        onValueChange={(value) =>
                          updateWaypoint(waypoint.id, {
                            query: value,
                            address: null,
                          })
                        }
                        onSelect={(address) =>
                          updateWaypoint(waypoint.id, { address })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start-SoC */}
          <div>
            <label htmlFor="planner-soc" className={labelClasses}>
              {t("form.startSoc")}
            </label>
            <input
              id="planner-soc"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={soc}
              onChange={(e) => setSoc(e.target.value)}
              className={`mt-1 ${inputClasses}`}
            />
          </div>

          {/* Außentemperatur */}
          <div>
            <label htmlFor="planner-temp" className={labelClasses}>
              {t("form.expectedTemp")}
            </label>
            <input
              id="planner-temp"
              type="number"
              inputMode="numeric"
              value={tempC}
              onChange={(e) => setTempC(e.target.value)}
              className={`mt-1 ${inputClasses}`}
            />
          </div>

          {/* Batteriekapazität */}
          <div className="sm:col-span-2">
            <label htmlFor="planner-capacity" className={labelClasses}>
              {t("form.batteryCapacity")}
            </label>
            <input
              id="planner-capacity"
              type="number"
              inputMode="numeric"
              min={5}
              max={250}
              value={capacityKwh}
              onChange={(e) => setCapacityKwh(e.target.value)}
              className={`mt-1 ${inputClasses}`}
            />
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              {capacityIsDerived
                ? t("form.capacityHintDerived")
                : t("form.capacityHintDefault")}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className={buttonClasses("primary", "md")}
          >
            <Navigation aria-hidden size={16} />
            {pending ? t("form.submitPending") : t("form.submit")}
          </button>
          {historyDriveCount < 30 && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {t("form.historyHint", { count: historyDriveCount })}
            </span>
          )}
        </div>

        {progress > 0 && (
          <div
            className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-950"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {progressStage}
              </span>
              <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">
                {progress} %
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label="Fortschritt der Routenberechnung"
                className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out dark:bg-blue-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          {t("form.routingPrefix")}{" "}
          {osrmIsDefault
            ? t("form.routingDefaultHint")
            : t("form.routingCustomHint")}
        </p>
      </form>

      {plan && (
        <Result
          key={planId}
          plan={plan}
          waypoints={plannedWaypoints}
          pending={pending}
          onSelectRoute={handleRouteSelect}
        />
      )}
    </div>
  );
}

function Result({
  plan,
  waypoints,
  pending,
  onSelectRoute,
}: {
  plan: PlanResult;
  waypoints: Coords[];
  pending: boolean;
  onSelectRoute: (routeOptionId: string) => Promise<void>;
}) {
  const t = useTranslations("planner");
  const selectedRoute =
    plan.routeOptions.find(
      (option) =>
        Math.abs(option.distanceKm - plan.distanceKm) < 0.1 &&
        Math.abs(option.durationSeconds - plan.durationSeconds) < 1,
    ) ?? plan.routeOptions[0];

  const selectedRouteId = selectedRoute?.id ?? "fastest";

  const arrivalRounded = Math.round(plan.arrivalSoc);
  const displaySoc = Math.max(0, arrivalRounded);
  const tone = socTone(plan.arrivalSoc);
  const toneLabel = t(`arrivalTone.${tone.labelKey}`);

  const totalChargingMinutes = plan.recommendedChargingStops.reduce(
    (sum, stop) => sum + stop.chargingMinutes,
    0,
  );

  const totalTravelSeconds =
    plan.durationSeconds + totalChargingMinutes * 60;

  return (
    <div className="flex flex-col gap-4">
      {plan.routeOptions.length > 1 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {plan.routeOptions.map((option) => {
            const selected = option.id === selectedRouteId;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (option.id === selectedRouteId || pending) return;
                  void onSelectRoute(option.id);
                }}
                disabled={pending}
                className={
                  "rounded-xl border p-3 text-left transition " +
                  (selected
                    ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900"
                    : "border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600")
                }
              >
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {option.label}
                </div>

                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatKm(option.distanceKm)} ·{" "}
                  {formatDuration(option.durationSeconds)}
                </div>

                {option.hasFerry && (
                  <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Fähre · ca.{" "}
                    {formatDuration(option.ferryDurationSeconds)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <PlannerMapLoader
        geometry={plan.geometry}
        waypoints={waypoints}
        chargingSites={plan.chargingSites}
        recommendedChargingStops={plan.recommendedChargingStops}
      />

      {selectedRoute?.hasFerry && selectedRoute.ferrySegments.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            ⛴ Fährpassage
          </div>

          <div className="flex flex-col gap-2">
            {selectedRoute.ferrySegments.map((ferry, index) => (
              <div
                key={ferry.name + index}
                className="text-sm text-amber-900 dark:text-amber-100"
              >
                <span className="font-medium">{ferry.name}</span>
                {" · "}
                {formatKm(ferry.distanceKm)}
                {" · "}
                {formatDuration(ferry.durationSeconds)}
                {" · kein Fahrverbrauch"}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label={t("result.distance")} value={formatKm(plan.distanceKm)} />
        <Metric
          label="Reisezeit ohne Laden"
          value={formatDuration(plan.durationSeconds)}
          sub="inklusive möglicher Fährpassagen"
        />
        <Metric
          label="Ladezeit"
          value={
            totalChargingMinutes > 0
              ? formatDuration(totalChargingMinutes * 60)
              : "0 min"
          }
          sub={
            plan.recommendedChargingStops.length > 0
              ? plan.recommendedChargingStops.length + " geplante Ladestopps"
              : "keine Ladestopps nötig"
          }
        />
        <Metric
          label="Gesamtreisezeit"
          value={formatDuration(totalTravelSeconds)}
          sub={
            totalChargingMinutes > 0
              ? "Fahrt, Fähre und Laden"
              : "ohne zusätzliche Pausen"
          }
        />
        <Metric
          label={t("result.avgSpeed")}
          value={`${Math.round(plan.avgSpeedKmh)} km/h`}
        />
        <Metric
          label={t("result.consumption")}
          value={`${plan.energyKwh.toFixed(1)} kWh`}
          sub={`${Math.round(plan.whPerKm)} Wh/km`}
        />
        <div
          className={"col-span-2 rounded-xl border p-3 sm:col-span-1 " + tone.card}
        >
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Ankunft ohne Laden
          </p>
          <p
            className={"mt-0.5 text-xl font-semibold tabular-nums " + tone.value}
          >
            {displaySoc} %
          </p>
          <p className={"text-xs font-medium " + tone.value}>{toneLabel}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900 sm:col-span-1">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Geplante Ankunft
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {plan.plannedArrivalSoc != null
              ? Math.max(0, Math.round(plan.plannedArrivalSoc)) + " %"
              : "–"}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            inklusive geplanter Ladestopps
          </p>
        </div>
      </div>

      {plan.arrivalSoc < 10 && !plan.chargingPlanComplete && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("result.lowArrivalHint")}
        </p>
      )}
      <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Schnelllader im 15-km-Suchkorridor
        </p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
          {plan.chargingSiteCount}
        </p>
      </div>

      {plan.recommendedChargingStops.length > 0 && (
        <div className="flex flex-col gap-3">
          {plan.recommendedChargingStops.map((stop, index) => (
            <div
              key={stop.id}
              className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    Ladestopp {index + 1}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {stop.name}
                  </p>
                </div>

                <div className="rounded-full bg-amber-500 px-3 py-1 text-sm font-semibold text-white">
                  ca. {stop.chargingMinutes} min
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric
                  label="nach Start"
                  value={Math.round(stop.routeDistanceKm) + " km"}
                />
                <Metric
                  label="Ankunft"
                  value={Math.round(stop.arrivalSoc) + " %"}
                />
                <Metric
                  label="Weiterfahrt"
                  value={Math.round(stop.departureSoc) + " %"}
                />
                <Metric
                  label="Nachladen"
                  value={stop.energyAddedKwh.toFixed(1) + " kWh"}
                />
              </div>
            </div>
          ))}

          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Berechnet für eine Zielreserve von 20 % und mindestens 10 % bei
            Ankunft am Schnelllader.
          </p>
        </div>
      )}

      {!plan.chargingPlanComplete && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          <strong>Ladeplanung nicht vollständig möglich.</strong>{" "}
          Entlang der gewählten Route wurde keine durchgängige Folge geeigneter
          Schnelllader gefunden.
        </div>
      )}

      <Assumptions plan={plan} />
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{sub}</p>
      )}
    </div>
  );
}

function Assumptions({ plan }: { plan: PlanResult }) {
  const t = useTranslations("planner");
  const baseLabel = t(`baseSource.${BASE_SOURCE_KEYS[plan.baseSource]}`);
  const baseTempHint =
    plan.tempBinCenterC != null
      ? t("assumptions.tempBinHint", {
          tempC: Math.round(plan.tempBinCenterC),
        })
      : "";

  return (
    <details className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <summary className="cursor-pointer text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {t("assumptions.summary")}
      </summary>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <Row
          term={t("assumptions.baseConsumption")}
          desc={t("assumptions.baseConsumptionDesc", {
            whPerKm: Math.round(plan.baseWhPerKm),
            source: baseLabel,
            tempHint: baseTempHint,
          })}
        />
        <Row
          term={t("assumptions.temperature")}
          desc={t("assumptions.temperatureDesc", {
            tempC: Math.round(plan.tempC),
          })}
        />
        <Row
          term={t("assumptions.elevation")}
          desc={
            plan.elevationOk
              ? t("assumptions.elevationDesc", {
                  ascent: Math.round(plan.ascentM),
                  descent: Math.round(plan.descentM),
                })
              : t("assumptions.elevationUnavailable")
          }
        />
        <Row
          term={t("assumptions.speedAdjustment")}
          desc={t("assumptions.speedAdjustmentDesc", {
            planned: Math.round(plan.avgSpeedKmh),
            reference: Math.round(plan.referenceSpeedKmh),
            factor: plan.breakdown.speedFactor.toFixed(2),
          })}
        />
        <Row
          term={t("assumptions.capacity")}
          desc={t("assumptions.capacityDesc", {
            capacity: Math.round(plan.capacityKwh),
          })}
        />
        <Row
          term={t("assumptions.routing")}
          desc={
            plan.osrmIsDefault
              ? t("assumptions.routingPublic")
              : t("assumptions.routingCustom")
          }
        />
      </dl>

      <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t("assumptions.energyBreakdown")}
        </p>
        <dl className="mt-2 flex flex-col gap-1.5 text-sm">
          <Row
            term={t("assumptions.base")}
            desc={formatSignedKwh(plan.breakdown.baseKwh)}
          />
          <Row
            term={t("assumptions.speedAdjustment")}
            desc={formatSignedKwh(plan.breakdown.speedAdjustmentKwh)}
          />
          <Row
            term={t("assumptions.ascent")}
            desc={formatSignedKwh(plan.breakdown.ascentKwh)}
          />
          <Row
            term={t("assumptions.descentRegen")}
            desc={formatSignedKwh(plan.breakdown.descentCreditKwh)}
          />
          <Row
            term={t("assumptions.total")}
            desc={`${plan.energyKwh.toFixed(1)} kWh`}
            strong
          />
        </dl>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-neutral-400 dark:text-neutral-500">
        <MapPin aria-hidden size={14} className="mt-0.5 shrink-0" />
        <span>{t("assumptions.footer")}</span>
      </p>
    </details>
  );
}

function Row({
  term,
  desc,
  strong,
}: {
  term: string;
  desc: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-neutral-500 dark:text-neutral-400">{term}</dt>
      <dd
        className={`text-right tabular-nums ${
          strong
            ? "font-semibold text-neutral-900 dark:text-neutral-100"
            : "text-neutral-700 dark:text-neutral-300"
        }`}
      >
        {desc}
      </dd>
    </div>
  );
}
