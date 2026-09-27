"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Battery,
  Gauge,
  Map,
  MapPin,
  Search,
  Settings,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { DashboardRangeBoundaryPoint } from "./DashboardRangeMap";
import { ActiveVehicleSwitcher } from "../../components/ActiveVehicleSwitcher";

const DashboardRangeMap = dynamic(
  () =>
    import("./DashboardRangeMap").then(
      (module) => module.DashboardRangeMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[370px] w-full animate-pulse bg-[#071421]" />
    ),
  },
);

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

export interface MobileRangeHeroProps {
  initialVehicleId: number;
  vehicles: Array<{
    id: number;
    displayName: string;
  }>;
  displayName: string;
  model: string | null;
  trimBadging: string | null;
  soc: number | null;
  ratedRangeKm: number | null;
  placeName: string | null;
  positionAvailable: boolean;
}

export function MobileRangeHero({
  initialVehicleId,
  vehicles,
  displayName,
  model,
  trimBadging,
  soc,
  ratedRangeKm,
  placeName,
  positionAvailable,
}: MobileRangeHeroProps) {
  const t = useTranslations("dashboard.mobileMapFirst");
  const tNav = useTranslations("nav");

  const vehicleImage =
    model === "Y"
      ? {
          src: "/vehicles/modely-side.webp",
          alt: "Tesla Model Y",
        }
      : model === "3"
        ? {
            src: "/vehicles/model3-side.webp",
            alt: "Tesla Model 3",
          }
        : null;

  const [range, setRange] =
    useState<RangeSuccessResponse | null>(null);
  const [loading, setLoading] = useState(positionAvailable);
  const [error, setError] = useState(!positionAvailable);

  async function loadRange() {
    if (!positionAvailable) {
      setLoading(false);
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);

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
      setRange(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>
      <div className="relative h-[370px] overflow-hidden bg-[#071421]">
        {range ? (
          <DashboardRangeMap
            origin={range.origin}
            boundary={range.boundary}
            displayName={displayName}
            className="mobile-range-map h-[370px] w-full border-0"
            zoomControlPosition="bottomright"
          />
        ) : (
          <div className="flex h-[370px] items-center justify-center px-8 text-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
                <p className="text-sm text-slate-400">
                  {t("rangeLoading")}
                </p>
              </div>
            ) : (
              <div className="flex max-w-xs flex-col items-center gap-3">
                <p className="text-sm text-slate-400">
                  {positionAvailable
                    ? t("rangeError")
                    : t("positionUnavailable")}
                </p>

                {error && positionAvailable && (
                  <button
                    type="button"
                    onClick={() => void loadRange()}
                    className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-white"
                  >
                    {t("retry")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] h-32 bg-gradient-to-b from-[#05101d]/90 via-[#05101d]/45 to-transparent" />

        <div className="absolute inset-x-0 top-0 z-[700] flex h-[54px] items-center justify-between px-4">
          <span className="text-[18px] font-semibold tracking-tight text-white">
            DriveChronik
          </span>

          <div className="flex gap-2">
            <Link
              href="/search"
              aria-label={tNav("search")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/50 text-slate-200 backdrop-blur"
            >
              <Search aria-hidden size={17} />
            </Link>

            <Link
              href="/settings"
              aria-label={tNav("settings")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/50 text-slate-200 backdrop-blur"
            >
              <Settings aria-hidden size={17} />
            </Link>
          </div>
        </div>

        <div className="absolute inset-x-0 top-[60px] z-[700] flex justify-center px-4">
          <div className="inline-flex rounded-2xl border border-white/10 bg-[#0a1726]/90 p-1 shadow-xl backdrop-blur-xl">
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              {t("tabRange")}
            </button>

            <button
              type="button"
              disabled
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400"
            >
              {t("tabChargers")}
            </button>

            <button
              type="button"
              disabled
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400"
            >
              {t("tabTraffic")}
            </button>
          </div>
        </div>

        {range && (
          <div className="absolute bottom-[78px] left-4 z-[650]">
            <div className="rounded-xl border border-blue-400/20 bg-[#081827]/90 px-3 py-2 text-xs font-semibold tabular-nums text-blue-100 shadow-lg backdrop-blur">
              {t("reachable", {
                range: Math.round(range.rangeBudgetKm),
              })}
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] h-28 bg-gradient-to-b from-transparent to-[#071421]" />
      </div>

      <div className="relative z-[800] -mt-[58px] px-4">
        <div className="block overflow-hidden rounded-[20px] border border-neutral-200 bg-white px-3.5 py-3 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {vehicles.length > 1 ? (
                <ActiveVehicleSwitcher
                  vehicles={vehicles}
                  initialVehicleId={initialVehicleId}
                  compact
                />
              ) : (
                <p className="truncate text-[15px] font-semibold leading-tight text-neutral-950">
                  {displayName}
                </p>
              )}

              <p className="mt-1 truncate text-[10px] text-neutral-400">
                {[trimBadging, placeName ?? t("unknownLocation")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <div className="relative h-[64px] w-[142px] shrink-0">
              {vehicleImage ? (
                <Image
                  src={vehicleImage.src}
                  alt={vehicleImage.alt}
                  fill
                  sizes="142px"
                  priority
                  className="object-contain object-center"
                />
              ) : (
                <Image
                  src="/visuals/vehicle-tesla-header.png"
                  alt=""
                  fill
                  sizes="142px"
                  className="object-contain object-center opacity-70"
                />
              )}
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-3 divide-x divide-neutral-100">
            <div className="pr-2.5">
              <div className="flex items-center gap-1">
                <Battery
                  aria-hidden
                  size={12}
                  className="text-emerald-500"
                />
                <span className="text-[9px] text-neutral-400">
                  SoC
                </span>
              </div>

              <p className="mt-0.5 whitespace-nowrap text-[16px] font-semibold tabular-nums leading-tight text-neutral-950">
                {soc != null ? `${Math.round(soc)} %` : "–"}
              </p>
            </div>

            <div className="px-2.5">
              <div className="flex items-center gap-1">
                <Gauge
                  aria-hidden
                  size={12}
                  className="text-slate-500"
                />
                <span className="text-[9px] text-neutral-400">
                  Reichweite
                </span>
              </div>

              <p className="mt-0.5 whitespace-nowrap text-[16px] font-semibold tabular-nums leading-tight text-neutral-950">
                {ratedRangeKm != null
                  ? `${Math.round(ratedRangeKm)} km`
                  : "–"}
              </p>
            </div>

            <div className="pl-2.5">
              <div className="flex items-center gap-1">
                <Map
                  aria-hidden
                  size={12}
                  className="text-blue-500"
                />
                <span className="text-[9px] text-neutral-400">
                  erreichbar
                </span>
              </div>

              <p className="mt-0.5 whitespace-nowrap text-[16px] font-semibold tabular-nums leading-tight text-neutral-950">
                {range
                  ? `≈ ${Math.round(range.rangeBudgetKm)} km`
                  : "–"}
              </p>
            </div>
          </div>

          {soc != null && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, soc),
                    )}%`,
                  }}
                />
              </div>

              {range && (
                <span className="shrink-0 text-[9px] tabular-nums text-neutral-400">
                  {range.reserveSoc} % Reserve
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
