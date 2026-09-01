"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import { useTranslations } from "next-intl";

import type { Vehicle } from "../../../lib/queries";

/**
 * Fahrzeug-Umschalter für Insights und Unterseiten.
 * Behält die aktuelle Route sowie vorhandene Query-Parameter
 * wie z. B. das gewählte Jahr bei.
 */
export function InsightsVehicleSwitcher({
  vehicles,
  current,
}: {
  vehicles: Vehicle[];
  current: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("insights");

  function switchVehicle(vehicleId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("vehicle", vehicleId);

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      aria-label={t("vehicleSwitcherLabel")}
      value={current}
      onChange={(event) => switchVehicle(event.target.value)}
      className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
    >
      {vehicles.map((vehicle) => (
        <option key={vehicle.id} value={vehicle.id}>
          {vehicle.displayName}
        </option>
      ))}
    </select>
  );
}
