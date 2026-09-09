import type {
  YearlyClassification,
  YearlyClassificationSummary,
  YearlyDaySummary,
  YearlyDestinationSummary,
  YearlyDrive,
  YearlyInsightsResult,
  YearlyMonthSummary,
} from "./yearlyInsightsTypes";

const CLASSIFICATIONS: YearlyClassification[] = [
  "unclassified",
  "private",
  "business",
  "commute",
];

function destinationKey(drive: YearlyDrive): string | null {
  if (drive.endPlaceId != null) {
    return `place:${drive.endPlaceId}`;
  }

  const address = drive.endAddress?.trim().toLowerCase();
  if (address) {
    return `address:${address}`;
  }

  if (drive.endLat != null && drive.endLon != null) {
    return `coord:${drive.endLat.toFixed(4)},${drive.endLon.toFixed(4)}`;
  }

  return null;
}

function destinationLabel(drive: YearlyDrive): string | null {
  const name = drive.endPlaceName?.trim();
  if (name) return name;

  const address = drive.endAddress?.trim();
  if (address) return address;

  if (drive.endLat != null && drive.endLon != null) {
    return `${drive.endLat.toFixed(4)}, ${drive.endLon.toFixed(4)}`;
  }

  return null;
}

export function buildYearlyInsights(
  year: number,
  drives: YearlyDrive[],
): YearlyInsightsResult {
  const classificationMap = new Map<
    YearlyClassification,
    YearlyClassificationSummary
  >();

  for (const classification of CLASSIFICATIONS) {
    classificationMap.set(classification, {
      classification,
      driveCount: 0,
      distanceKm: 0,
      durationSeconds: 0,
    });
  }

  const monthMap = new Map<string, YearlyMonthSummary>();

  for (let month = 1; month <= 12; month++) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    monthMap.set(monthKey, {
      monthKey,
      driveCount: 0,
      distanceKm: 0,
      durationSeconds: 0,
      businessDistanceKm: 0,
      privateDistanceKm: 0,
      commuteDistanceKm: 0,
      unclassifiedDistanceKm: 0,
    });
  }

  const dayMap = new Map<string, YearlyDaySummary>();
  const destinationMap = new Map<string, YearlyDestinationSummary>();

  let distanceKm = 0;
  let durationSeconds = 0;
  let longestDrive: YearlyDrive | null = null;

  for (const drive of drives) {
    const driveDistance = drive.distanceKm ?? 0;
    const driveDuration = drive.durationSeconds ?? 0;

    distanceKm += driveDistance;
    durationSeconds += driveDuration;

    const classification = classificationMap.get(drive.classification)!;
    classification.driveCount += 1;
    classification.distanceKm += driveDistance;
    classification.durationSeconds += driveDuration;

    const month = monthMap.get(drive.monthKey);
    if (month) {
      month.driveCount += 1;
      month.distanceKm += driveDistance;
      month.durationSeconds += driveDuration;

      switch (drive.classification) {
        case "business":
          month.businessDistanceKm += driveDistance;
          break;
        case "private":
          month.privateDistanceKm += driveDistance;
          break;
        case "commute":
          month.commuteDistanceKm += driveDistance;
          break;
        case "unclassified":
          month.unclassifiedDistanceKm += driveDistance;
          break;
      }
    }

    const day = dayMap.get(drive.dateKey) ?? {
      dateKey: drive.dateKey,
      driveCount: 0,
      distanceKm: 0,
      durationSeconds: 0,
    };

    day.driveCount += 1;
    day.distanceKm += driveDistance;
    day.durationSeconds += driveDuration;
    dayMap.set(drive.dateKey, day);

    if (
      longestDrive == null ||
      driveDistance > (longestDrive.distanceKm ?? 0)
    ) {
      longestDrive = drive;
    }

    const key = destinationKey(drive);
    const label = destinationLabel(drive);

    if (key && label) {
      const destination = destinationMap.get(key) ?? {
        key,
        label,
        visitCount: 0,
        distanceKm: 0,
        businessVisitCount: 0,
        privateVisitCount: 0,
        commuteVisitCount: 0,
        unclassifiedVisitCount: 0,
        businessDistanceKm: 0,
        privateDistanceKm: 0,
        commuteDistanceKm: 0,
        unclassifiedDistanceKm: 0,
        lastVisitDateKey: drive.dateKey,
        placeType: drive.endPlaceType,
        lat: drive.endLat,
        lon: drive.endLon,
      };

      destination.visitCount += 1;
      destination.distanceKm += driveDistance;

      switch (drive.classification) {
        case "business":
          destination.businessVisitCount += 1;
          destination.businessDistanceKm += driveDistance;
          break;
        case "private":
          destination.privateVisitCount += 1;
          destination.privateDistanceKm += driveDistance;
          break;
        case "commute":
          destination.commuteVisitCount += 1;
          destination.commuteDistanceKm += driveDistance;
          break;
        case "unclassified":
          destination.unclassifiedVisitCount += 1;
          destination.unclassifiedDistanceKm += driveDistance;
          break;
      }

      if (drive.dateKey > destination.lastVisitDateKey) {
        destination.lastVisitDateKey = drive.dateKey;
      }

      if (destination.placeType == null && drive.endPlaceType != null) {
        destination.placeType = drive.endPlaceType;
      }

      if (destination.lat == null && drive.endLat != null) {
        destination.lat = drive.endLat;
      }

      if (destination.lon == null && drive.endLon != null) {
        destination.lon = drive.endLon;
      }

      destinationMap.set(key, destination);
    }
  }

  const months = [...monthMap.values()];

  const busiestMonth =
    months
      .filter((month) => month.driveCount > 0)
      .sort(
        (a, b) =>
          b.distanceKm - a.distanceKm ||
          b.driveCount - a.driveCount ||
          a.monthKey.localeCompare(b.monthKey),
      )[0] ?? null;

  const busiestDay =
    [...dayMap.values()].sort(
      (a, b) =>
        b.distanceKm - a.distanceKm ||
        b.driveCount - a.driveCount ||
        a.dateKey.localeCompare(b.dateKey),
    )[0] ?? null;

  const destinations = [...destinationMap.values()].sort(
    (a, b) =>
      b.visitCount - a.visitCount ||
      b.distanceKm - a.distanceKm ||
      a.label.localeCompare(b.label),
  );

  const topDestinations = destinations.slice(0, 10);

  return {
    year,
    driveCount: drives.length,
    distanceKm,
    durationSeconds,
    byClassification: CLASSIFICATIONS.map(
      (classification) => classificationMap.get(classification)!,
    ),
    months,
    destinations,
    topDestinations,
    longestDrive,
    busiestDay,
    busiestMonth,
    topDestination: topDestinations[0] ?? null,
  };
}
