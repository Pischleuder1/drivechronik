export type TpmsTire = "fl" | "fr" | "rl" | "rr";

export interface TpmsMetricInput {
  ts: Date;
  tpmsFlBar: number | null;
  tpmsFrBar: number | null;
  tpmsRlBar: number | null;
  tpmsRrBar: number | null;
}

export interface DailyTpmsPoint {
  ts: Date;
  fl: number | null;
  fr: number | null;
  rl: number | null;
  rr: number | null;
}

export interface TpmsSlowLeakAlert {
  tire: TpmsTire;
  dropBar: number;
  peerDifferenceBar: number;
  sampleDays: number;
  spanDays: number;
  severity: "noticeable" | "strong";
}

interface TpmsTrendOptions {
  windowDays?: number;
  minSampleDays?: number;
  minSpanDays?: number;
  minDropBar?: number;
  minCurrentPeerGapBar?: number;
  strongDropBar?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function validPressure(value: number | null): value is number {
  return (
    value != null &&
    Number.isFinite(value) &&
    value >= 1 &&
    value <= 5.5
  );
}

export function buildDailyTpmsHistory(
  metrics: TpmsMetricInput[],
): DailyTpmsPoint[] {
  const days = new Map<
    string,
    {
      ts: Date;
      fl: number[];
      fr: number[];
      rl: number[];
      rr: number[];
    }
  >();

  for (const metric of metrics) {
    const key = metric.ts.toISOString().slice(0, 10);

    let day = days.get(key);

    if (!day) {
      day = {
        ts: metric.ts,
        fl: [],
        fr: [],
        rl: [],
        rr: [],
      };
      days.set(key, day);
    } else if (metric.ts > day.ts) {
      day.ts = metric.ts;
    }

    if (validPressure(metric.tpmsFlBar)) day.fl.push(metric.tpmsFlBar);
    if (validPressure(metric.tpmsFrBar)) day.fr.push(metric.tpmsFrBar);
    if (validPressure(metric.tpmsRlBar)) day.rl.push(metric.tpmsRlBar);
    if (validPressure(metric.tpmsRrBar)) day.rr.push(metric.tpmsRrBar);
  }

  return [...days.values()]
    .map((day) => ({
      ts: day.ts,
      fl: median(day.fl),
      fr: median(day.fr),
      rl: median(day.rl),
      rr: median(day.rr),
    }))
    .filter(
      (day) =>
        day.fl != null ||
        day.fr != null ||
        day.rl != null ||
        day.rr != null,
    )
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

function peerDifference(
  point: DailyTpmsPoint,
  tire: TpmsTire,
): number | null {
  const own = point[tire];
  if (own == null) return null;

  const tires: TpmsTire[] = ["fl", "fr", "rl", "rr"];
  const peers = tires
    .filter((candidate) => candidate !== tire)
    .map((candidate) => point[candidate])
    .filter((value): value is number => value != null);

  // Mindestens zwei andere Reifen müssen als Referenz vorhanden sein.
  if (peers.length < 2) return null;

  const peerMedian = median(peers);
  return peerMedian == null ? null : own - peerMedian;
}

/**
 * Vorsichtiger Hinweis auf einen möglichen schleichenden Druckverlust.
 *
 * Es wird NICHT der absolute Drucktrend verwendet, sondern die Abweichung
 * eines Rades zum Median der anderen drei Reifen. Gemeinsame Änderungen
 * aller Reifen, z.B. durch Außentemperatur, wirken dadurch kaum auf den Trend.
 */
export function detectTpmsSlowLeak(
  history: DailyTpmsPoint[],
  options: TpmsTrendOptions = {},
): TpmsSlowLeakAlert[] {
  const {
    windowDays = 30,
    minSampleDays = 8,
    minSpanDays = 14,
    minDropBar = 0.15,
    minCurrentPeerGapBar = 0.10,
    strongDropBar = 0.25,
  } = options;

  if (history.length === 0) return [];

  const ordered = [...history].sort(
    (a, b) => a.ts.getTime() - b.ts.getTime(),
  );

  const latestTs = ordered.at(-1)!.ts.getTime();
  const startTs = latestTs - windowDays * DAY_MS;

  const window = ordered.filter(
    (point) => point.ts.getTime() >= startTs,
  );

  const tires: TpmsTire[] = ["fl", "fr", "rl", "rr"];
  const alerts: TpmsSlowLeakAlert[] = [];

  for (const tire of tires) {
    const samples = window
      .map((point) => ({
        ts: point.ts,
        difference: peerDifference(point, tire),
      }))
      .filter(
        (
          sample,
        ): sample is { ts: Date; difference: number } =>
          sample.difference != null,
      );

    if (samples.length < minSampleDays) continue;

    const spanDays =
      (samples.at(-1)!.ts.getTime() -
        samples[0]!.ts.getTime()) /
      DAY_MS;

    if (spanDays < minSpanDays) continue;

    // Robuster als nur erster gegen letzten Messpunkt:
    // erstes und letztes Drittel werden jeweils über den Median bewertet.
    const sectionSize = Math.max(
      3,
      Math.floor(samples.length / 3),
    );

    const early = median(
      samples
        .slice(0, sectionSize)
        .map((sample) => sample.difference),
    );

    const recent = median(
      samples
        .slice(-sectionSize)
        .map((sample) => sample.difference),
    );

    if (early == null || recent == null) continue;

    const dropBar = early - recent;

    // Nur warnen, wenn das Rad sowohl relativ gefallen ist als auch
    // aktuell tatsächlich unter seinen Vergleichsreifen liegt.
    if (
      dropBar + 1e-9 < minDropBar ||
      recent > -minCurrentPeerGapBar
    ) {
      continue;
    }

    alerts.push({
      tire,
      dropBar,
      peerDifferenceBar: recent,
      sampleDays: samples.length,
      spanDays,
      severity:
        dropBar >= strongDropBar ||
        recent <= -0.20
          ? "strong"
          : "noticeable",
    });
  }

  return alerts.sort((a, b) => b.dropBar - a.dropBar);
}
