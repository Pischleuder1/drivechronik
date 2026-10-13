import { CarFront } from "lucide-react";

export type VehicleArtworkVariant =
  | "model-3-classic"
  | "model-3-highland"
  | "model-y-classic"
  | "model-y-juniper"
  | "model-y-unknown-generation"
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
  const normalizedVin = vin?.trim().toUpperCase() ?? "";
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalizedVin)) return null;

  const code = normalizedVin[9];

  const years: Record<string, number> = {
    L: 2020,
    M: 2021,
    N: 2022,
    P: 2023,
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
  const normalizedVin = vin?.trim().toUpperCase() ?? "";
  const validVin = /^[A-HJ-NPR-Z0-9]{17}$/.test(normalizedVin);

  const vinModel = validVin ? normalizedVin[3] : null;
  const normalizedModel = normalizeModel(model);

  const resolvedModel =
    vinModel === "3" || vinModel === "Y"
      ? vinModel
      : normalizedModel === "3" || normalizedModel === "MODEL3"
        ? "3"
        : normalizedModel === "Y" || normalizedModel === "MODELY"
          ? "Y"
          : null;

  const year = vehicleModelYearFromVin(vin);

  if (resolvedModel === "3") {
    if (year == null) return "tesla";
    return year >= 2024 ? "model-3-highland" : "model-3-classic";
  }

  if (resolvedModel === "Y") {
    if (year == null) return "model-y-unknown-generation";
    if (year <= 2024) return "model-y-classic";
    if (year >= 2026) return "model-y-juniper";
    return "model-y-unknown-generation";
  }

  return normalizedModel || validVin ? "tesla" : "unknown";
}


export function resolveVehicleImage({
  vin,
  model,
  trimBadging,
  variantOverride,
  exteriorColor,
}: {
  vin: string | null;
  model: string | null;
  trimBadging: string | null;
  variantOverride: string | null;
  exteriorColor?: string | null;
}): string | null {
  const variant = resolveVehicleArtworkVariant({ vin, model });
  const trim = (trimBadging ?? "").trim().toUpperCase();

  // Nur ausdrücklich vorhandene Farbvarianten verwenden.
  const color = exteriorColor === "stealth_grey"
    ? "stealth-grey"
    : "white";

  const juniperImage = (version: "standard" | "premium"): string => {
    if (color === "stealth-grey") {
      return `/vehicles/variants/modely-juniper-${version}-stealth-grey.webp`;
    }
    return `/vehicles/variants/modely-juniper-${version}.webp`;
  };

  switch (variant) {
    case "model-3-classic":
      return "/vehicles/variants/model3-classic.webp";

    case "model-3-highland":
      return "/vehicles/variants/model3-highland.webp";

    case "model-y-classic":
      return "/vehicles/variants/modely-classic.webp";

    case "model-y-juniper":
      if (variantOverride === "model-y-juniper-standard") {
        return juniperImage("standard");
      }
      if (variantOverride === "model-y-juniper-premium") {
        return juniperImage("premium");
      }
      if (/STANDARD/.test(trim)) {
        return juniperImage("standard");
      }
      if (/PREMIUM/.test(trim)) {
        return juniperImage("premium");
      }
      // RWD allein unterscheidet Standard und Premium nicht.
      // Bei unklarer Ausstattung keine falsche Variante darstellen.
      return null;

    default:
      return null;
  }
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
