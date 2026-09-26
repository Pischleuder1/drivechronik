"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface VehicleOption {
  id: number;
  displayName: string;
}

const COOKIE = "drivechronik_vehicle";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function ActiveVehicleSwitcher({
  vehicles,
  initialVehicleId,
  compact = false,
}: {
  vehicles: VehicleOption[];
  initialVehicleId: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [vehicleId, setVehicleId] = useState(initialVehicleId);

  function select(nextVehicleId: number) {
    if (nextVehicleId === vehicleId) return;

    setVehicleId(nextVehicleId);

    document.cookie =
      `${COOKIE}=${nextVehicleId}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;

    // Eine konkrete Reise gehört genau einem Fahrzeug. Nach einem
    // Fahrzeugwechsel wäre die bisherige Detail-/Bearbeitungs-URL daher
    // für das neue aktive Fahrzeug ungültig. Zur fahrzeugbezogenen
    // Reiseliste zurückkehren statt eine 404-Seite anzuzeigen.
    if (/^\/journeys\/\d+(?:\/edit)?$/.test(pathname)) {
      router.replace("/journeys");
      return;
    }

    router.refresh();
  }

  return (
    <select
      value={vehicleId}
      onChange={(event) => select(Number(event.target.value))}
      aria-label={t("vehicle")}
      className={
        compact
          ? "min-w-0 max-w-[145px] rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          : "mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 outline-none transition focus:border-blue-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
      }
    >
      {vehicles.map((vehicle) => (
        <option key={vehicle.id} value={vehicle.id}>
          {vehicle.displayName}
        </option>
      ))}
    </select>
  );
}
