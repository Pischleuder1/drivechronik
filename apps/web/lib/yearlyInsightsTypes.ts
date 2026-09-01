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
