import type {
  ChargingSite,
  PlannedChargingStop,
} from "./types";

export interface ChargingPlanInput {
  startSoc: number;
  capacityKwh: number;
  routeDistanceKm: number;
  energyKwh: number;

  /** Gewünschte Reserve am Ziel. */
  targetArrivalSoc: number;

  /**
   * SoC, unter den wir bei der Ankunft an einem Ladestopp möglichst
   * nicht fallen wollen.
   */
  minimumStopArrivalSoc: number;
}

export interface ChargingRequirement {
  chargingNeeded: boolean;
  arrivalSocWithoutCharging: number;
  requiredEnergyKwh: number;
}

export function calculateChargingRequirement(
  input: ChargingPlanInput,
): ChargingRequirement {
  const {
    startSoc,
    capacityKwh,
    energyKwh,
    targetArrivalSoc,
  } = input;

  const arrivalSocWithoutCharging =
    startSoc - (energyKwh / capacityKwh) * 100;

  const requiredArrivalEnergyKwh =
    (targetArrivalSoc / 100) * capacityKwh;

  const availableStartEnergyKwh =
    (startSoc / 100) * capacityKwh;

  const requiredEnergyKwh = Math.max(
    0,
    energyKwh + requiredArrivalEnergyKwh - availableStartEnergyKwh,
  );

  return {
    chargingNeeded: requiredEnergyKwh > 0.01,
    arrivalSocWithoutCharging,
    requiredEnergyKwh,
  };
}

/**
 * Grobe Ladezeit für die erste Planerversion.
 *
 * Die tatsächliche Tesla-Ladekurve wird später aus realen DriveChronik-
 * Ladevorgängen gelernt. Bis dahin rechnen wir bewusst konservativ mit
 * einer durchschnittlich nutzbaren Ladeleistung.
 */
export function estimateChargingMinutes(
  energyKwh: number,
  sitePowerKw: number | null,
): number {
  if (energyKwh <= 0) return 0;

  const advertisedPowerKw =
    sitePowerKw != null && sitePowerKw > 0 ? sitePowerKw : 150;

  // Eine Nennleistung von z. B. 250 kW liegt nicht über den gesamten
  // Ladevorgang an. Für die MVP-Prognose begrenzen wir den realistischen
  // Durchschnitt konservativ.
  const averagePowerKw = Math.min(advertisedPowerKw, 120);

  return Math.ceil((energyKwh / averagePowerKw) * 60);
}

export function buildChargingStop(
  site: ChargingSite,
  routeDistanceKm: number,
  arrivalSoc: number,
  departureSoc: number,
  capacityKwh: number,
): PlannedChargingStop {
  const energyAddedKwh =
    Math.max(0, departureSoc - arrivalSoc) / 100 * capacityKwh;

  return {
    site,
    routeDistanceKm,
    arrivalSoc,
    departureSoc,
    energyAddedKwh,
    chargingMinutes: estimateChargingMinutes(
      energyAddedKwh,
      site.powerKw,
    ),
    estimatedCostEur:
      site.pricePerKwhEur != null
        ? energyAddedKwh * site.pricePerKwhEur
        : null,
  };
}

export interface ChargingStopSelection {
  stop: PlannedChargingStop | null;
  chargingNeeded: boolean;
  targetArrivalSoc: number;
}

interface RouteSitePosition {
  site: ChargingSite;
  routeDistanceKm: number;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(a));
}

function locateSiteAlongRoute(
  site: ChargingSite,
  geometry: [number, number][],
): RouteSitePosition | null {
  if (geometry.length < 2) return null;

  let bestIndex = -1;
  let bestDistanceKm = Number.POSITIVE_INFINITY;

  for (let i = 0; i < geometry.length; i += 1) {
    const point = geometry[i]!;

    const distanceKm = haversineKm(
      site.lat,
      site.lon,
      point[0],
      point[1],
    );

    if (distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
      bestIndex = i;
    }
  }

  if (bestIndex < 0) return null;

  let routeDistanceKm = 0;

  for (let i = 1; i <= bestIndex; i += 1) {
    const previous = geometry[i - 1]!;
    const current = geometry[i]!;

    routeDistanceKm += haversineKm(
      previous[0],
      previous[1],
      current[0],
      current[1],
    );
  }

  return {
    site,
    routeDistanceKm,
  };
}

/**
 * Wählt für die erste Planerversion einen sinnvollen einzelnen Ladestopp.
 *
 * Strategie:
 * - Zielreserve 20 %
 * - mindestens 10 % bei Ankunft am Supercharger
 * - nur erreichbare Stationen
 * - möglichst spät laden, um mit niedrigem SoC am Schnelllader anzukommen
 *
 * Mehrere Ladestopps folgen später.
 */
export function selectChargingStop(
  sites: ChargingSite[],
  geometry: [number, number][],
  input: ChargingPlanInput,
): ChargingStopSelection {
  const requirement = calculateChargingRequirement(input);

  // Praktische Sicherheitslogik:
  //
  // >= 15 % am Ziel:
  //   komfortable Direktfahrt
  //
  // 10-15 %:
  //   Direktfahrt weiterhin möglich, aber geringe Reserve.
  //   Die UI warnt bereits entsprechend; wir erzwingen keinen Ladestopp.
  //
  // < 10 %:
  //   automatischen Ladestopp planen.
  //
  // Die gewünschte Zielreserve (z. B. 20 %) bestimmt anschließend,
  // wie weit am ausgewählten Schnelllader geladen werden soll.
  const automaticStopThresholdSoc = 10;

  if (
    requirement.arrivalSocWithoutCharging >= automaticStopThresholdSoc
  ) {
    return {
      stop: null,
      chargingNeeded: false,
      targetArrivalSoc: input.targetArrivalSoc,
    };
  }

  if (
    sites.length === 0 ||
    geometry.length < 2 ||
    input.routeDistanceKm <= 0 ||
    input.energyKwh <= 0
  ) {
    return {
      stop: null,
      chargingNeeded: true,
      targetArrivalSoc: input.targetArrivalSoc,
    };
  }

  const energyPerKm = input.energyKwh / input.routeDistanceKm;

  const candidates = sites
    .map((site) => locateSiteAlongRoute(site, geometry))
    .filter((value): value is RouteSitePosition => value !== null)
    .map(({ site, routeDistanceKm }) => {
      const energyToStopKwh = routeDistanceKm * energyPerKm;

      const arrivalSoc =
        input.startSoc -
        (energyToStopKwh / input.capacityKwh) * 100;

      return {
        site,
        routeDistanceKm,
        arrivalSoc,
      };
    })
    .filter(
      (candidate) =>
        candidate.routeDistanceKm > 5 &&
        candidate.routeDistanceKm < input.routeDistanceKm - 5 &&
        candidate.arrivalSoc >= input.minimumStopArrivalSoc,
    )
    .sort((a, b) => b.routeDistanceKm - a.routeDistanceKm);

  const selected = candidates[0];

  if (!selected) {
    return {
      stop: null,
      chargingNeeded: true,
      targetArrivalSoc: input.targetArrivalSoc,
    };
  }

  const remainingDistanceKm =
    input.routeDistanceKm - selected.routeDistanceKm;

  const remainingEnergyKwh =
    remainingDistanceKm * energyPerKm;

  const requiredDepartureEnergyKwh =
    remainingEnergyKwh +
    (input.targetArrivalSoc / 100) * input.capacityKwh;

  const departureSoc = Math.min(
    100,
    (requiredDepartureEnergyKwh / input.capacityKwh) * 100,
  );

  return {
    stop: buildChargingStop(
      selected.site,
      selected.routeDistanceKm,
      selected.arrivalSoc,
      Math.max(selected.arrivalSoc, departureSoc),
      input.capacityKwh,
    ),
    chargingNeeded: true,
    targetArrivalSoc: input.targetArrivalSoc,
  };
}
