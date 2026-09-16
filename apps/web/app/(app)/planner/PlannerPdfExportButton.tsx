"use client";

import { useState } from "react";
import { toJpeg } from "html-to-image";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PlanResult } from "../../../lib/actions/planner";
import { buttonClasses } from "../../../components/ui/Button";

export function PlannerPdfExportButton({
  plan,
  startLabel,
  waypointLabels,
  destinationLabel,
}: {
  plan: PlanResult | null;
  startLabel: string;
  waypointLabels: string[];
  destinationLabel: string;
}) {
  const t = useTranslations("planner");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportPdf() {
    if (!plan) return;

    setExporting(true);
    setError(null);

    try {
      const selectedRoute =
        plan.routeOptions.find(
          (option) => option.id === plan.selectedRouteOptionId,
        ) ?? plan.routeOptions[0];

      const totalChargingMinutes =
        plan.recommendedChargingStops.reduce(
          (sum, stop) => sum + stop.chargingMinutes,
          0,
        );

      let mapImageDataUrl: string | null = null;

      const mapElement =
        document.querySelector<HTMLElement>(
          '[data-planner-map-export="true"]',
        );

      if (mapElement) {
        try {
          // Noch nicht fertig geladene Leaflet-Kacheln kurz abwarten.
          const tiles = Array.from(
            mapElement.querySelectorAll<HTMLImageElement>(
              "img.leaflet-tile",
            ),
          );

          const tileLoad = Promise.all(
            tiles.map(
              (tile) =>
                new Promise<void>((resolve) => {
                  if (tile.complete) {
                    resolve();
                    return;
                  }

                  const done = () => resolve();

                  tile.addEventListener("load", done, {
                    once: true,
                  });
                  tile.addEventListener("error", done, {
                    once: true,
                  });
                }),
            ),
          );

          await Promise.race([
            tileLoad,
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 1500);
            }),
          ]);

          mapImageDataUrl = await toJpeg(mapElement, {
            quality: 0.88,
            pixelRatio: 1.25,
            backgroundColor: "#ffffff",
            cacheBust: true,
            filter: (node) => {
              const element = node as HTMLElement;

              // Zoomtasten nicht mit in die PDF-Karte übernehmen.
              return !element.classList?.contains(
                "leaflet-control-zoom",
              );
            },
          });
        } catch (mapError) {
          console.warn(
            "Planner map capture failed; using schematic fallback.",
            mapError,
          );
        }
      }

      const response = await fetch("/api/export/planner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeLabel: selectedRoute?.label ?? "",
          startLabel,
          waypointLabels,
          destinationLabel,

          distanceKm: plan.distanceKm,
          durationSeconds: plan.durationSeconds,
          totalChargingMinutes,
          totalTravelSeconds:
            plan.durationSeconds + totalChargingMinutes * 60,

          avgSpeedKmh: plan.avgSpeedKmh,
          energyKwh: plan.energyKwh,
          whPerKm: plan.whPerKm,

          arrivalSoc: plan.arrivalSoc,
          plannedArrivalSoc: plan.plannedArrivalSoc,
          targetArrivalSoc: plan.targetArrivalSoc,

          chargingSiteCount: plan.chargingSiteCount,
          chargingPlanComplete: plan.chargingPlanComplete,

          geometry: plan.geometry,
          mapImageDataUrl,
          ferrySegments: selectedRoute?.ferrySegments ?? [],

          recommendedChargingStops:
            plan.recommendedChargingStops.map((stop) => ({
              id: stop.id,
              name: stop.name,
              lat: stop.lat,
              lon: stop.lon,
              routeDistanceKm: stop.routeDistanceKm,
              arrivalSoc: stop.arrivalSoc,
              departureSoc: stop.departureSoc,
              energyAddedKwh: stop.energyAddedKwh,
              chargingMinutes: stop.chargingMinutes,
            })),
        }),
      });

      if (!response.ok) {
        throw new Error();
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const disposition =
        response.headers.get("content-disposition");
      const match =
        disposition?.match(/filename="([^"]+)"/i);

      const link = document.createElement("a");
      link.href = url;
      link.download =
        match?.[1] ?? "drivechronik-route.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
    } catch {
      setError(t("pdfExport.error"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void exportPdf()}
        disabled={!plan || exporting}
        className={buttonClasses(
          "secondary",
          "md",
          "!border-red-600 !bg-red-600 !text-white hover:!border-red-700 hover:!bg-red-700 dark:!border-red-500 dark:!bg-red-600 dark:!text-white dark:hover:!border-red-600 dark:hover:!bg-red-700 disabled:!border-red-300 disabled:!bg-red-300 disabled:!text-white disabled:opacity-60",
        )}
      >
        <Download aria-hidden size={16} />
        {exporting
          ? t("pdfExport.creating")
          : t("pdfExport.button")}
      </button>

      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
