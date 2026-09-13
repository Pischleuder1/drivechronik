export type YearlyClassification =
  | "unclassified"
  | "private"
  | "business"
  | "commute";

export interface YearlyDrive {
  id: number;
  dateKey: string;
  monthKey: string;
  startTime: Date;
  endTime: Date | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  classification: YearlyClassification;

  endPlaceId: number | null;
  endPlaceName: string | null;
  endPlaceType: "home" | "work" | "customer" | "site" | "supplier" | "hotel" | "charger" | "parking" | "other" | null;
  endAddress: string | null;
  endLat: number | null;
  endLon: number | null;
}

export interface YearlyClassificationSummary {
  classification: YearlyClassification;
  driveCount: number;
  distanceKm: number;
  durationSeconds: number;
}

export interface YearlyMonthSummary {
  monthKey: string;
  driveCount: number;
  distanceKm: number;
  durationSeconds: number;
  businessDistanceKm: number;
  privateDistanceKm: number;
  commuteDistanceKm: number;
  unclassifiedDistanceKm: number;
}

export interface YearlyDaySummary {
  dateKey: string;
  driveCount: number;
  distanceKm: number;
  durationSeconds: number;
}

export interface YearlyDestinationSummary {
  key: string;
  label: string;
  visitCount: number;
  distanceKm: number;
  businessVisitCount: number;
  privateVisitCount: number;
  commuteVisitCount: number;
  unclassifiedVisitCount: number;
  businessDistanceKm: number;
  privateDistanceKm: number;
  commuteDistanceKm: number;
  unclassifiedDistanceKm: number;
  lastVisitDateKey: string;
  placeType: "home" | "work" | "customer" | "site" | "supplier" | "hotel" | "charger" | "parking" | "other" | null;
  lat: number | null;
  lon: number | null;
}

export interface YearlyInsightsResult {
  year: number;
  driveCount: number;
  distanceKm: number;
  durationSeconds: number;

  byClassification: YearlyClassificationSummary[];
  months: YearlyMonthSummary[];
  destinations: YearlyDestinationSummary[];
  topDestinations: YearlyDestinationSummary[];

  longestDrive: YearlyDrive | null;
  busiestDay: YearlyDaySummary | null;
  busiestMonth: YearlyMonthSummary | null;
  topDestination: YearlyDestinationSummary | null;
}
