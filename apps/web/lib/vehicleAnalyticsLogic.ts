export interface BatteryEstimateInput {
  startTime: Date;
  startSoc: number | null;
  endSoc: number | null;
  energyAddedKwh: number | null;
}

export interface BatteryCapacitySample {
  ts: Date;
  capacityKwh: number;
  socDelta: number;
}

export interface BatteryHealthEstimate {
  usableCapacityKwh: number | null;
  baselineCapacityKwh: number | null;
  degradationPercent: number | null;
  sampleCount: number;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

export function buildBatteryCapacitySamples(
  sessions: BatteryEstimateInput[],
): BatteryCapacitySample[] {
  return sessions
    .map((session) => {
      if (
        session.startSoc == null ||
        session.endSoc == null ||
        session.energyAddedKwh == null
      ) {
        return null;
      }

      const socDelta = session.endSoc - session.startSoc;

      // Kleine SoC-Differenzen reagieren zu stark auf die ganzzahlige
      // Tesla-SoC-Rundung und werden deshalb nicht für die Kapazitätsschätzung
      // verwendet.
      if (socDelta < 20 || session.energyAddedKwh <= 0) {
        return null;
      }

      const capacityKwh = session.energyAddedKwh / (socDelta / 100);

      // Nur grobe Plausibilitätsgrenzen, keine fahrzeugspezifische Annahme.
      if (!Number.isFinite(capacityKwh) || capacityKwh < 20 || capacityKwh > 150) {
        return null;
      }

      return {
        ts: session.startTime,
        capacityKwh,
        socDelta,
      };
    })
    .filter((sample): sample is BatteryCapacitySample => sample !== null)
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

export function estimateBatteryHealth(
  sessions: BatteryEstimateInput[],
): BatteryHealthEstimate {
  const samples = buildBatteryCapacitySamples(sessions);

  if (samples.length === 0) {
    return {
      usableCapacityKwh: null,
      baselineCapacityKwh: null,
      degradationPercent: null,
      sampleCount: 0,
    };
  }

  const recent = samples.slice(-10);
  const usableCapacityKwh = median(recent.map((sample) => sample.capacityKwh));

  // Für einen Degradationsvergleich brauchen wir bewusst mehrere Messungen
  // sowohl am Anfang als auch aktuell. Vorher zeigen wir nur die Kapazität.
  const baseline =
    samples.length >= 6
      ? samples.slice(0, Math.min(10, Math.floor(samples.length / 2)))
      : [];

  const baselineCapacityKwh =
    baseline.length >= 3
      ? median(baseline.map((sample) => sample.capacityKwh))
      : null;

  const degradationPercent =
    usableCapacityKwh != null &&
    baselineCapacityKwh != null &&
    baselineCapacityKwh > 0
      ? ((usableCapacityKwh / baselineCapacityKwh) - 1) * 100
      : null;

  return {
    usableCapacityKwh,
    baselineCapacityKwh,
    degradationPercent,
    sampleCount: samples.length,
  };
}

export interface VehicleMetricInput {
  ts: Date;
  soc: number | null;
  ratedRangeKm: number | null;
  odometerKm: number | null;
}

export interface DailyVehicleMetric {
  ts: Date;
  soc: number | null;
  ratedRangeKm: number | null;
  projectedRange100Km: number | null;
  odometerKm: number | null;
}

export function projectedRangeAt100Percent(
  soc: number | null,
  ratedRangeKm: number | null,
): number | null {
  if (
    soc == null ||
    ratedRangeKm == null ||
    soc < 10 ||
    soc > 100 ||
    ratedRangeKm <= 0
  ) {
    return null;
  }

  return ratedRangeKm / (soc / 100);
}

export function buildDailyVehicleMetrics(
  metrics: VehicleMetricInput[],
): DailyVehicleMetric[] {
  const byDay = new Map<string, VehicleMetricInput>();

  for (const metric of metrics) {
    const key = metric.ts.toISOString().slice(0, 10);
    const current = byDay.get(key);

    if (!current || metric.ts > current.ts) {
      byDay.set(key, metric);
    }
  }

  return [...byDay.values()]
    .sort((a, b) => a.ts.getTime() - b.ts.getTime())
    .map((metric) => ({
      ...metric,
      projectedRange100Km: projectedRangeAt100Percent(
        metric.soc,
        metric.ratedRangeKm,
      ),
    }));
}

export function odometerDelta(
  metrics: VehicleMetricInput[],
  days: number,
  now = new Date(),
): number | null {
  const withOdometer = metrics
    .filter(
      (metric): metric is VehicleMetricInput & { odometerKm: number } =>
        metric.odometerKm != null,
    )
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());

  if (withOdometer.length < 2) return null;

  const latest = withOdometer[withOdometer.length - 1]!;
  const target = now.getTime() - days * 24 * 60 * 60 * 1000;

  const earlier = withOdometer
    .filter((metric) => metric.ts.getTime() <= target)
    .at(-1);

  if (!earlier) return null;

  return Math.max(0, latest.odometerKm - earlier.odometerKm);
}

export interface ChargingEfficiencyInput {
  energyAddedKwh: number | null;
  energyUsedKwh: number | null;
  chargerType: "ac" | "dc" | null;
}

export interface ChargingEfficiencyResult {
  efficiencyPercent: number | null;
  energyAddedKwh: number;
  energyUsedKwh: number;
  sessionCount: number;
  acSessionCount: number;
  dcSessionCount: number;
}

export function calculateChargingEfficiency(
  sessions: ChargingEfficiencyInput[],
): ChargingEfficiencyResult {
  const valid = sessions.filter(
    (session) =>
      session.energyAddedKwh != null &&
      session.energyUsedKwh != null &&
      session.energyAddedKwh > 0 &&
      session.energyUsedKwh > 0 &&
      session.energyAddedKwh <= session.energyUsedKwh * 1.05,
  );

  const energyAddedKwh = valid.reduce(
    (sum, session) => sum + session.energyAddedKwh!,
    0,
  );

  const energyUsedKwh = valid.reduce(
    (sum, session) => sum + session.energyUsedKwh!,
    0,
  );

  return {
    efficiencyPercent:
      energyUsedKwh > 0 ? (energyAddedKwh / energyUsedKwh) * 100 : null,
    energyAddedKwh,
    energyUsedKwh,
    sessionCount: valid.length,
    acSessionCount: valid.filter((session) => session.chargerType === "ac").length,
    dcSessionCount: valid.filter((session) => session.chargerType === "dc").length,
  };
}

export interface ParkDrainInput {
  startTime: Date;
  endTime: Date;
  durationSeconds: number | null;
  hasCharging: boolean;
}

export interface VampireDrainSample {
  startTime: Date;
  endTime: Date;
  durationHours: number;
  socLoss: number;
  socLossPer24h: number;
  ratedRangeLossKm: number | null;
  ratedRangeLossPer24hKm: number | null;
}

export interface VampireDrainResult {
  socLossPer24h: number | null;
  ratedRangeLossPer24hKm: number | null;
  sampleCount: number;
}

const MAX_METRIC_DISTANCE_MS = 30 * 60 * 1000;
const MIN_PARK_DURATION_SECONDS = 8 * 60 * 60;

function firstMetricOnOrAfter(
  metrics: VehicleMetricInput[],
  target: Date,
): VehicleMetricInput | null {
  const targetMs = target.getTime();

  for (const metric of metrics) {
    const diff = metric.ts.getTime() - targetMs;

    if (diff >= 0 && diff <= MAX_METRIC_DISTANCE_MS) {
      return metric;
    }

    if (diff > MAX_METRIC_DISTANCE_MS) {
      break;
    }
  }

  return null;
}

function lastMetricOnOrBefore(
  metrics: VehicleMetricInput[],
  target: Date,
): VehicleMetricInput | null {
  const targetMs = target.getTime();

  for (let i = metrics.length - 1; i >= 0; i--) {
    const metric = metrics[i]!;
    const diff = targetMs - metric.ts.getTime();

    if (diff >= 0 && diff <= MAX_METRIC_DISTANCE_MS) {
      return metric;
    }

    if (diff > MAX_METRIC_DISTANCE_MS) {
      break;
    }
  }

  return null;
}

export function buildVampireDrainSamples(
  parks: ParkDrainInput[],
  metrics: VehicleMetricInput[],
): VampireDrainSample[] {
  const orderedMetrics = [...metrics].sort(
    (a, b) => a.ts.getTime() - b.ts.getTime(),
  );

  const samples: VampireDrainSample[] = [];

  for (const park of parks) {
    if (
      park.hasCharging ||
      park.durationSeconds == null ||
      park.durationSeconds < MIN_PARK_DURATION_SECONDS
    ) {
      continue;
    }

    const startMetric = firstMetricOnOrAfter(
      orderedMetrics,
      park.startTime,
    );

    const endMetric = lastMetricOnOrBefore(
      orderedMetrics,
      park.endTime,
    );

    if (
      startMetric?.soc == null ||
      endMetric?.soc == null
    ) {
      continue;
    }

    const durationHours =
      (park.endTime.getTime() - park.startTime.getTime()) /
      (60 * 60 * 1000);

    if (durationHours < 4) continue;

    const socLoss = startMetric.soc - endMetric.soc;

    // Ein steigender SoC ohne Ladevorgang ist typischerweise
    // Rundung/Temperatur/BMS-Neubewertung und kein negativer Standverbrauch.
    if (socLoss < 0) continue;

    const ratedRangeLossKm =
      startMetric.ratedRangeKm != null &&
      endMetric.ratedRangeKm != null
        ? Math.max(
            0,
            startMetric.ratedRangeKm - endMetric.ratedRangeKm,
          )
        : null;

    samples.push({
      startTime: park.startTime,
      endTime: park.endTime,
      durationHours,
      socLoss,
      socLossPer24h: socLoss * (24 / durationHours),
      ratedRangeLossKm,
      ratedRangeLossPer24hKm:
        ratedRangeLossKm != null
          ? ratedRangeLossKm * (24 / durationHours)
          : null,
    });
  }

  return samples;
}

export function calculateVampireDrain(
  parks: ParkDrainInput[],
  metrics: VehicleMetricInput[],
): VampireDrainResult {
  const samples = buildVampireDrainSamples(parks, metrics);

  return {
    socLossPer24h: median(samples.map((sample) => sample.socLossPer24h)),
    ratedRangeLossPer24hKm: median(
      samples
        .map((sample) => sample.ratedRangeLossPer24hKm)
        .filter((value): value is number => value != null),
    ),
    sampleCount: samples.length,
  };
}
