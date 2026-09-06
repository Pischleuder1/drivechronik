import type {
  ChargingSite,
  PlannedChargingStop,
} from "./types";

export interface ChargingPlanInput {
  startSoc: number;
  capacityKwh: number;
  routeDistanceKm: number;
  energyKwh: number;

  /** Abschnitte der Route ohne Fahrenergieverbrauch, z. B. Fähren. */
  nonDrivingSegmentsKm?: Array<{
    startKm: number;
    endKm: number;
  }>;

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
  /** Erster empfohlener Stopp; bleibt für bestehende UI kompatibel. */
  stop: PlannedChargingStop | null;
  /** Alle automatisch geplanten Ladestopps in Fahrtrichtung. */
  stops: PlannedChargingStop[];
  chargingNeeded: boolean;
  /** false = Route konnte mit den verfügbaren Ladeorten nicht vollständig geplant werden. */
  planningComplete: boolean;
  plannedArrivalSoc: number | null;
  targetArrivalSoc: number;
}

interface RouteSitePosition {
  site: ChargingSite;
  routeDistanceKm: number;
  offRouteDistanceKm: number;
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
  routeDistanceKm: number,
): RouteSitePosition[] {
  if (geometry.length < 2) return [];

  const cumulativeKm: number[] = [0];
  for (let i = 1; i < geometry.length; i += 1) {
    const previous = geometry[i - 1]!;
    const current = geometry[i]!;
    cumulativeKm.push(
      cumulativeKm[i - 1]! +
        haversineKm(
          previous[0],
          previous[1],
          current[0],
          current[1],
        ),
    );
  }

  // Die Geometrie ist für die Karte ausgedünnt und ihre kumulierte
  // Haversine-Länge kann daher von der echten OSRM-Routendistanz abweichen.
  // Ladeorte und nonDrivingSegments müssen aber dieselbe Kilometerachse
  // verwenden. Deshalb skalieren wir die Geometrie auf routeDistanceKm.
  const geometryDistanceKm =
    cumulativeKm[cumulativeKm.length - 1] ?? 0;

  const routeDistanceScale =
    geometryDistanceKm > 0
      ? routeDistanceKm / geometryDistanceKm
      : 1;

  const routeCumulativeKm = cumulativeKm.map(
    (distanceKm) => distanceKm * routeDistanceScale,
  );

  const distancesKm = geometry.map((point) =>
    haversineKm(site.lat, site.lon, point[0], point[1]),
  );

  const bestDistanceKm = Math.min(...distancesKm);

  // Durch Downsampling liegt der rechnerisch nächste Routenpunkt nicht
  // zwingend exakt am Ladeort. Punkte bis 1 km über dem besten Treffer
  // werden deshalb derselben möglichen Vorbeifahrt zugeordnet.
  const matchThresholdKm = bestDistanceKm + 1;

  const candidateIndexes = distancesKm
    .map((distanceKm, index) => ({ distanceKm, index }))
    .filter(({ distanceKm }) => distanceKm <= matchThresholdKm);

  if (candidateIndexes.length === 0) return [];

  // Benachbarte Treffer gehören zur selben Vorbeifahrt. Erst wenn entlang
  // der Route mindestens 5 km dazwischenliegen, behandeln wir den Treffer
  // als weitere mögliche Passage derselben Ladestation.
  const groups: Array<Array<{ distanceKm: number; index: number }>> = [];

  for (const candidate of candidateIndexes) {
    const currentGroup = groups[groups.length - 1];
    if (!currentGroup) {
      groups.push([candidate]);
      continue;
    }

    const previousCandidate = currentGroup[currentGroup.length - 1]!;
    const routeGapKm =
      routeCumulativeKm[candidate.index]! -
      routeCumulativeKm[previousCandidate.index]!;

    if (routeGapKm > 5) {
      groups.push([candidate]);
    } else {
      currentGroup.push(candidate);
    }
  }

  return groups.map((group) => {
    const best = group.reduce((currentBest, candidate) =>
      candidate.distanceKm < currentBest.distanceKm
        ? candidate
        : currentBest,
    );

    return {
      site,
      routeDistanceKm: routeCumulativeKm[best.index]!,
      offRouteDistanceKm: best.distanceKm,
    };
  });
}

/**
 * Plant automatisch einen oder mehrere sinnvolle Ladestopps.
 *
 * Strategie:
 * - Zielreserve 20 %
 * - mindestens 10 % bei Ankunft am Supercharger
 * - nur erreichbare Stationen
 * - möglichst spät laden, um mit niedrigem SoC am Schnelllader anzukommen
 *
 * Mehrere Ladestopps werden automatisch in Fahrtrichtung geplant.
 */
function drivingDistanceBetween(
  fromKm: number,
  toKm: number,
  nonDrivingSegments: Array<{ startKm: number; endKm: number }>,
): number {
  const startKm = Math.min(fromKm, toKm);
  const endKm = Math.max(fromKm, toKm);

  let nonDrivingKm = 0;

  for (const segment of nonDrivingSegments) {
    const overlapStartKm = Math.max(startKm, segment.startKm);
    const overlapEndKm = Math.min(endKm, segment.endKm);

    if (overlapEndKm > overlapStartKm) {
      nonDrivingKm += overlapEndKm - overlapStartKm;
    }
  }

  return Math.max(0, endKm - startKm - nonDrivingKm);
}

export function selectChargingStop(
  sites: ChargingSite[],
  geometry: [number, number][],
  input: ChargingPlanInput,
): ChargingStopSelection {
  const requirement = calculateChargingRequirement(input);

  // Unter 10 % prognostizierter Ziel-SoC wird automatisch geladen.
  // 10-15 % bleibt wie bisher eine direkte Fahrt mit geringer Reserve.
  const automaticStopThresholdSoc = 10;

  if (
    requirement.arrivalSocWithoutCharging >= automaticStopThresholdSoc
  ) {
    return {
      stop: null,
      stops: [],
      chargingNeeded: false,
      planningComplete: true,
      plannedArrivalSoc: requirement.arrivalSocWithoutCharging,
      targetArrivalSoc: input.targetArrivalSoc,
    };
  }

  if (
    sites.length === 0 ||
    geometry.length < 2 ||
    input.routeDistanceKm <= 0 ||
    input.energyKwh <= 0 ||
    input.capacityKwh <= 0
  ) {
    return {
      stop: null,
      stops: [],
      chargingNeeded: true,
      planningComplete: false,
      plannedArrivalSoc: null,
      targetArrivalSoc: input.targetArrivalSoc,
    };
  }

  const nonDrivingSegments = input.nonDrivingSegmentsKm ?? [];

  const totalDrivingDistanceKm = drivingDistanceBetween(
    0,
    input.routeDistanceKm,
    nonDrivingSegments,
  );

  if (totalDrivingDistanceKm <= 0) {
    return {
      stop: null,
      stops: [],
      chargingNeeded: true,
      planningComplete: false,
      plannedArrivalSoc: null,
      targetArrivalSoc: input.targetArrivalSoc,
    };
  }

  const energyPerDrivingKm = input.energyKwh / totalDrivingDistanceKm;

  // Ladeorte einmalig auf ihre Position entlang der Route projizieren.
  const positionedSites = sites
    .flatMap((site) =>
      locateSiteAlongRoute(
        site,
        geometry,
        input.routeDistanceKm,
      ),
    )
    .filter(
      ({ routeDistanceKm }) =>
        routeDistanceKm > 5 &&
        routeDistanceKm < input.routeDistanceKm - 5,
    )
    .sort((a, b) => a.routeDistanceKm - b.routeDistanceKm);

  if (positionedSites.length === 0) {
    return {
      stop: null,
      stops: [],
      chargingNeeded: true,
      planningComplete: false,
      plannedArrivalSoc: null,
      targetArrivalSoc: input.targetArrivalSoc,
    };
  }

  const stops: PlannedChargingStop[] = [];

  let currentDistanceKm = 0;
  let currentSoc = input.startSoc;

  // Für Zwischenstopps vermeiden wir bewusst das langsame Laden nahe 100 %.
  const intermediateDepartureSoc = 80;

  // Kann das Ziel mit höchstens 90 % Abfahrt-SoC direkt erreicht werden,
  // laden wir lieber etwas länger und vermeiden einen zusätzlichen Kurzstopp.
  const maximumSingleStopDepartureSoc = 90;

  // Ein Ladehalt ohne nennenswerte Nachladung ist kein echter Ladestopp.
  const minimumUsefulChargeKwh = 0.5;

  // Schutz gegen fehlerhafte Daten oder eine Endlosschleife.
  // Auf sehr langen Strecken werden entsprechend mehr Ladestopps zugelassen.
  const maximumStops = Math.min(
    30,
    Math.max(12, Math.ceil(totalDrivingDistanceKm / 100)),
  );

  for (let step = 0; step < maximumStops; step += 1) {
    const remainingDrivingDistanceKm = drivingDistanceBetween(
      currentDistanceKm,
      input.routeDistanceKm,
      nonDrivingSegments,
    );

    const remainingEnergyKwh =
      remainingDrivingDistanceKm * energyPerDrivingKm;

    const arrivalSocAtDestination =
      currentSoc -
      (remainingEnergyKwh / input.capacityKwh) * 100;

    // Sobald eine Ladeplanung erforderlich ist, planen wir bis zur Zielreserve.
    if (arrivalSocAtDestination >= input.targetArrivalSoc) {
      return {
        stop: stops[0] ?? null,
        stops,
        chargingNeeded: stops.length > 0,
        planningComplete: true,
        plannedArrivalSoc: arrivalSocAtDestination,
        targetArrivalSoc: input.targetArrivalSoc,
      };
    }

    const reachableCandidates = positionedSites
      .filter(
        ({ routeDistanceKm }) =>
          routeDistanceKm > currentDistanceKm + 2,
      )
      .map(({ site, routeDistanceKm, offRouteDistanceKm }) => {
        const segmentDrivingDistanceKm = drivingDistanceBetween(
          currentDistanceKm,
          routeDistanceKm,
          nonDrivingSegments,
        );

        const segmentEnergyKwh =
          segmentDrivingDistanceKm * energyPerDrivingKm;

        const arrivalSoc =
          currentSoc -
          (segmentEnergyKwh / input.capacityKwh) * 100;

        return {
          site,
          routeDistanceKm,
          offRouteDistanceKm,
          arrivalSoc,
        };
      })
      .filter(
        ({ arrivalSoc }) =>
          arrivalSoc >= input.minimumStopArrivalSoc,
      )
      // Möglichst spät laden, aber größere Abweichungen von der Route
      // deutlich bestrafen. Tesla wird bei ähnlich guten Ladeorten leicht
      // bevorzugt, ohne deutlich besser gelegene HPCs zu verdrängen.
      .sort((a, b) => {
        const detourPenaltyFactor = 6;
        const teslaPreferenceBonusKm = 15;

        const scoreA =
          a.routeDistanceKm -
          a.offRouteDistanceKm * detourPenaltyFactor +
          (a.site.network === "tesla" ? teslaPreferenceBonusKm : 0);

        const scoreB =
          b.routeDistanceKm -
          b.offRouteDistanceKm * detourPenaltyFactor +
          (b.site.network === "tesla" ? teslaPreferenceBonusKm : 0);

        if (scoreA !== scoreB) return scoreB - scoreA;
        if (a.offRouteDistanceKm !== b.offRouteDistanceKm) {
          return a.offRouteDistanceKm - b.offRouteDistanceKm;
        }
        return b.routeDistanceKm - a.routeDistanceKm;
      });

    const selected = reachableCandidates[0];

    if (!selected) {
      return {
        stop: stops[0] ?? null,
        stops,
        chargingNeeded: true,
        planningComplete: false,
        plannedArrivalSoc: null,
        targetArrivalSoc: input.targetArrivalSoc,
      };
    }

    const drivingDistanceAfterStopKm = drivingDistanceBetween(
      selected.routeDistanceKm,
      input.routeDistanceKm,
      nonDrivingSegments,
    );

    const energyAfterStopKwh =
      drivingDistanceAfterStopKm * energyPerDrivingKm;

    const requiredDepartureEnergyKwh =
      energyAfterStopKwh +
      (input.targetArrivalSoc / 100) * input.capacityKwh;

    const requiredDepartureSocForDestination =
      (requiredDepartureEnergyKwh / input.capacityKwh) * 100;

    // Reicht eine moderate Ladung bis zum Ziel, laden wir direkt die dafür
    // nötige Energie. Erst wenn dafür mehr als 90 % erforderlich wären,
    // bleibt es bei 80 % und einer weiteren Ladeetappe.
    const departureSoc =
      requiredDepartureSocForDestination <= maximumSingleStopDepartureSoc
        ? Math.max(
            selected.arrivalSoc,
            requiredDepartureSocForDestination,
          )
        : Math.max(
            selected.arrivalSoc,
            intermediateDepartureSoc,
          );

    const stop = buildChargingStop(
      selected.site,
      selected.routeDistanceKm,
      selected.arrivalSoc,
      Math.min(100, departureSoc),
      input.capacityKwh,
    );

    // Falls aufgrund von Rundung oder abweichenden Routendaten an diesem
    // Punkt gar nicht sinnvoll geladen werden müsste, passieren wir den
    // Ladeort lediglich und planen mit dem tatsächlichen Ankunfts-SoC weiter.
    if (stop.energyAddedKwh < minimumUsefulChargeKwh) {
      currentDistanceKm = selected.routeDistanceKm;
      currentSoc = selected.arrivalSoc;
      continue;
    }

    stops.push(stop);

    currentDistanceKm = selected.routeDistanceKm;
    currentSoc = stop.departureSoc;
  }

  return {
    stop: stops[0] ?? null,
    stops,
    chargingNeeded: true,
    planningComplete: false,
    plannedArrivalSoc: null,
    targetArrivalSoc: input.targetArrivalSoc,
  };
}
