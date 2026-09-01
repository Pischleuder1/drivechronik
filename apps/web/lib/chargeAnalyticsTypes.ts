export interface ChargeAnalyticsPoint {
  ts: number;
  soc: number | null;
  powerKw: number | null;
  outsideTemp: number | null;
}

export interface ChargeAnalyticsSession {
  id: number;
  startTime: Date;
  endTime: Date;
  placeId: number | null;
  placeName: string | null;
  address: string | null;
  startSoc: number | null;
  endSoc: number | null;
  energyAddedKwh: number | null;
  maxPowerKw: number | null;
  outsideTempAvg: number | null;
  points: ChargeAnalyticsPoint[];
}

export interface LocationRanking {
  key: string;
  label: string;
  sessionCount: number;
  medianPeakKw: number | null;
  medianTenToEightySeconds: number | null;
}

export interface SlowChargeAlert {
  sessionId: number;
  durationSeconds: number;
  peerMedianSeconds: number;
  ratio: number;
  comparisonCount: number;
}
