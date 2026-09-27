"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { DriveTrack } from "../../lib/dashboard";
import type { DashboardRangeBoundaryPoint } from "./DashboardRangeMap";

const DashboardMap = dynamic(
  () => import("./DashboardMap").then((module) => module.DashboardMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 sm:h-[340px]" />
    ),
  },
);

const DashboardRangeMap = dynamic(
  () =>
    import("./DashboardRangeMap").then(
      (module) => module.DashboardRangeMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 sm:h-[340px]" />
    ),
  },
);

export interface DashboardMapLoaderProps {
  tracks: DriveTrack[];
  car: {
    lat: number;
    lon: number;
    displayName: string;
    placeName: string | null;
  } | null;
}

interface RangeSuccessResponse {
  ok: true;
  vehicleId: number;
  origin: {
    lat: number;
    lon: number;
  };
  soc: number;
  ratedRangeKm: number;
  reserveSoc: number;
  rangeBudgetKm: number;
  boundary: DashboardRangeBoundaryPoint[];
  osrmIsDefault: boolean | null;
}

type MapMode = "drives" | "range";

export function DashboardMapLoader({
  tracks,
  car,
}: DashboardMapLoaderProps) {
  const router = useRouter();
  const t = useTranslations("dashboard.recentDrives");

  const [mode, setMode] = useState<MapMode>("drives");
  const [range, setRange] = useState<RangeSuccessResponse | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState(false);

  async function loadRange() {
    if (rangeLoading || range) return;

    setRangeLoading(true);
    setRangeError(false);

    try {
      const response = await fetch("/api/dashboard/range", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("range request failed");
      }

      const data: unknown = await response.json();

      if (
        typeof data !== "object" ||
        data === null ||
        !("ok" in data) ||
        data.ok !== true
      ) {
        throw new Error("invalid range response");
      }

      setRange(data as RangeSuccessResponse);
    } catch {
      setRangeError(true);
    } finally {
      setRangeLoading(false);
    }
  }

  async function selectMode(nextMode: MapMode) {
    setMode(nextMode);

    if (nextMode === "range" && !range) {
      await loadRange();
    }
  }

  function retryRange() {
    setRange(null);
    setRangeError(false);
    void loadRange();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
          role="group"
          aria-label={t("mapModeAria")}
        >
          <button
            type="button"
            onClick={() => void selectMode("drives")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "drives"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            {t("mapModeDrives")}
          </button>

          <button
            type="button"
            onClick={() => void selectMode("range")}
            disabled={car == null}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === "range"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            {t("mapModeRange")}
          </button>
        </div>

        {mode === "range" && range && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            <span>
              {t("rangeBudget", {
                range: Math.round(range.rangeBudgetKm),
              })}
            </span>
            <span>
              {t("rangeReserve", {
                reserve: range.reserveSoc,
              })}
            </span>
            <span>
              {t("rangeSoc", {
                soc: Math.round(range.soc),
              })}
            </span>
          </div>
        )}
      </div>

      {mode === "drives" ? (
        tracks.length > 0 || car != null ? (
          <DashboardMap
            tracks={tracks}
            car={car}
            onSelectDrive={(driveId) => router.push(`/drives/${driveId}`)}
          />
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-neutral-300 px-4 text-center text-sm text-neutral-400 dark:border-neutral-700 dark:text-neutral-500 sm:h-[340px]">
            {t("mapEmpty")}
          </div>
        )
      ) : rangeLoading ? (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 px-4 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-400 sm:h-[340px]">
          {t("rangeLoading")}
        </div>
      ) : rangeError ? (
        <div className="flex h-[300px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 px-4 text-center dark:border-neutral-700 sm:h-[340px]">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("rangeError")}
          </p>

          <button
            type="button"
            onClick={retryRange}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {t("rangeRetry")}
          </button>
        </div>
      ) : range ? (
        <>
          <DashboardRangeMap
            origin={range.origin}
            boundary={range.boundary}
            displayName={car?.displayName ?? t("rangeVehicle")}
          />

          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            {t("rangeHint")}
          </p>
        </>
      ) : null}
    </div>
  );
}
