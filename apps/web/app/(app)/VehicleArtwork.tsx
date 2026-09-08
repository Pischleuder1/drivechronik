import { CarFront } from "lucide-react";

export type VehicleArtworkVariant =
  | "model-y-juniper"
  | "model-y"
  | "tesla"
  | "unknown";

function normalizeModel(model: string | null): string {
  return (model ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Tesla/Fahrzeug-Modelljahr aus der 10. Stelle der VIN.
 *
 * Wir verwenden hier bewusst nur die für DriveChronik aktuell
 * relevanten neueren Modelljahre. Die Erkennung kann später
 * erweitert werden.
 */
export function vehicleModelYearFromVin(vin: string | null): number | null {
  if (!vin || vin.length < 10) return null;

  const code = vin.trim().toUpperCase()[9];

  const years: Record<string, number> = {
    R: 2024,
    S: 2025,
    T: 2026,
    V: 2027,
    W: 2028,
    X: 2029,
    Y: 2030,
  };

  return years[code] ?? null;
}

export function resolveVehicleArtworkVariant({
  vin,
  model,
}: {
  vin: string | null;
  model: string | null;
}): VehicleArtworkVariant {
  const normalizedModel = normalizeModel(model);
  const modelYear = vehicleModelYearFromVin(vin);

  const isModelY =
    normalizedModel === "Y" ||
    normalizedModel === "MODELY";

  /*
   * Ab Modelljahr 2026 kann ein Model Y in unserem aktuellen
   * Einsatzbereich sicher als neue Juniper-Generation behandelt
   * werden.
   *
   * Modelljahr 2025 behandeln wir zunächst bewusst nicht automatisch
   * als Juniper, da hier Alt- und Neugeneration vorkommen können.
   */
  if (isModelY && modelYear != null && modelYear >= 2026) {
    return "model-y-juniper";
  }

  if (isModelY) {
    return "model-y";
  }

  if (normalizedModel.length > 0) {
    return "tesla";
  }

  return "unknown";
}

export function VehicleArtwork({
  vin,
  model,
  trimBadging,
}: {
  vin: string | null;
  model: string | null;
  trimBadging: string | null;
}) {
  const variant = resolveVehicleArtworkVariant({ vin, model });

  return (
    <div
      className="relative hidden items-center justify-center lg:flex"
      data-vehicle-artwork={variant}
      data-vehicle-trim={trimBadging ?? undefined}
    >
      <div
        aria-hidden
        className="absolute h-44 w-44 rounded-full bg-neutral-100/80 dark:bg-neutral-800/70"
      />

      <div
        aria-hidden
        className="absolute h-32 w-32 rounded-full border border-neutral-200/80 dark:border-neutral-700"
      />

      <CarFront
        aria-hidden
        size={112}
        strokeWidth={1.15}
        className="relative text-neutral-500 dark:text-neutral-300"
      />
    </div>
  );
}
