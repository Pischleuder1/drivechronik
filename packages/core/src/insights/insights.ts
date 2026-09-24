// Reine, framework-freie Insights-Bausteine (M21). Wie `reports/` importiert
// dieses Modul KEINE Drizzle-Typen — die Web-App mappt DB-Rows auf einfache
// Getter (getX/getY) und ruft die Funktionen hier. So bleiben Binning,
// Wochentagsmuster und die Schwellwerte deterministisch und unit-testbar.

/**
 * Mindestanzahl auswertbarer Fahrten, ab der eine Insights-Karte überhaupt
 * eine Auswertung zeigt (darunter: freundlicher EmptyState). Die Seite selbst
 * ist immer erreichbar — die Schwelle gilt pro Karte.
 */
export const MIN_DRIVES_TOTAL = 30;

/** Mindestanzahl Datenpunkte je Bin, damit ein Bin-Mittel gezeigt wird. */
export const MIN_PER_BIN = 3;

export interface Bin {
  /** Mitte des Bins auf der X-Achse (z. B. 12.5 für den 10–15-°C-Bin bei 5er-Breite). */
  xCenter: number;
  /** Untere (inklusive) Bin-Grenze. */
  xStart: number;
  /** Mittelwert der Y-Werte im Bin. */
  meanY: number;
  /** Anzahl berücksichtigter Punkte im Bin. */
  count: number;
}

/**
 * Bündelt Items in gleich breite X-Bins und liefert je Bin die X-Mitte, das
 * Y-Mittel und die Anzahl. Punkte mit null/NaN in X oder Y werden übersprungen.
 * Nur Bins mit `count >= MIN_PER_BIN` erscheinen im Ergebnis; die Bins sind
 * nach xStart aufsteigend sortiert.
 *
 * Ein Bin `k` deckt das halboffene Intervall
 *   [k * binWidth, (k + 1) * binWidth)
 * ab (floor-basiert, funktioniert auch für negative Werte, z. B. Minusgrade).
 */
export function binByNumeric<T>(
  items: readonly T[],
  getX: (item: T) => number | null | undefined,
  getY: (item: T) => number | null | undefined,
  binWidth: number,
): Bin[] {
  if (!(binWidth > 0)) {
    throw new Error("binWidth must be a positive number");
  }

  const buckets = new Map<number, { sumY: number; count: number }>();

  for (const item of items) {
    const x = getX(item);
    const y = getY(item);
    if (x == null || y == null) continue;
    if (Number.isNaN(x) || Number.isNaN(y)) continue;

    const k = Math.floor(x / binWidth);
    const bucket = buckets.get(k) ?? { sumY: 0, count: 0 };
    bucket.sumY += y;
    bucket.count += 1;
    buckets.set(k, bucket);
  }

  const bins: Bin[] = [];
  for (const [k, { sumY, count }] of buckets) {
    if (count < MIN_PER_BIN) continue;
    const xStart = k * binWidth;
    bins.push({
      xStart,
      xCenter: xStart + binWidth / 2,
      meanY: sumY / count,
      count,
    });
  }

  bins.sort((a, b) => a.xStart - b.xStart);
  return bins;
}

export interface WeekdayBucket {
  /** Wochentag 0..6 als ISO-artiger Index (Konvention vom Aufrufer, s. getDow). */
  dow: number;
  /** Mittelwert der Y-Werte an diesem Wochentag. */
  meanY: number;
  /** Summe der Y-Werte an diesem Wochentag (für km-Summen praktisch). */
  sumY: number;
  /** Anzahl Fahrten an diesem Wochentag. */
  count: number;
}

/**
 * Aggregiert Items je Wochentag. `getDow` liefert den Wochentag-Index (der
 * Aufrufer bestimmt die Konvention — z. B. 0=Montag..6=Sonntag; die Funktion
 * bleibt timezone-agnostisch, weil sie nur mit den bereits berechneten Indizes
 * arbeitet). Es werden immer sieben Buckets (dow 0..6) zurückgegeben, auch
 * leere (count=0, meanY=0), damit die Anzeige eine feste Mo–So-Achse hat.
 * Punkte mit null/NaN in Y werden übersprungen; ein ungültiger dow (außerhalb
 * 0..6) wird ignoriert.
 */
export function weeklyPattern<T>(
  items: readonly T[],
  getDow: (item: T) => number,
  getY: (item: T) => number | null | undefined,
): WeekdayBucket[] {
  const buckets: WeekdayBucket[] = Array.from({ length: 7 }, (_, dow) => ({
    dow,
    meanY: 0,
    sumY: 0,
    count: 0,
  }));

  for (const item of items) {
    const dow = getDow(item);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) continue;
    const y = getY(item);
    if (y == null || Number.isNaN(y)) continue;
    const bucket = buckets[dow]!;
    bucket.sumY += y;
    bucket.count += 1;
  }

  for (const bucket of buckets) {
    bucket.meanY = bucket.count > 0 ? bucket.sumY / bucket.count : 0;
  }

  return buckets;
}

/**
 * Vergleicht das Verbrauchs-Mittel bei niedriger Temperatur mit dem bei ~20 °C
 * und liefert die relative Mehrverbrauchs-Angabe (Prozent), aus der die Karte
 * ihren dynamischen Untertitel baut. Sucht den Bin, dessen Mitte 20 °C am
 * nächsten liegt (Referenz), und den kältesten Bin mit xCenter < 10 °C. Gibt
 * null zurück, wenn eine der beiden Seiten fehlt (dann nutzt die UI einen
 * generischen Text).
 */
export interface ColdVsMildDelta {
  coldCenter: number;
  mildCenter: number;
  coldMeanY: number;
  mildMeanY: number;
  /** (cold - mild) / mild, z. B. 0.12 = +12 %. */
  relativeDelta: number;
}

export function coldVsMildDelta(bins: readonly Bin[]): ColdVsMildDelta | null {
  if (bins.length < 2) return null;

  const cold = bins.filter((b) => b.xCenter < 10);
  if (cold.length === 0) return null;
  // Kältester verfügbarer Bin.
  const coldBin = cold.reduce((a, b) => (b.xCenter < a.xCenter ? b : a));

  // Referenz: Bin mit Mitte am nächsten zu 20 °C, aber deutlich wärmer als der
  // Kälte-Bin (mind. 5 °C Abstand, damit der Vergleich aussagekräftig ist).
  const warm = bins.filter((b) => b.xCenter >= coldBin.xCenter + 5);
  if (warm.length === 0) return null;
  const mildBin = warm.reduce((a, b) =>
    Math.abs(b.xCenter - 20) < Math.abs(a.xCenter - 20) ? b : a,
  );

  if (mildBin.meanY === 0) return null;
  return {
    coldCenter: coldBin.xCenter,
    mildCenter: mildBin.xCenter,
    coldMeanY: coldBin.meanY,
    mildMeanY: mildBin.meanY,
    relativeDelta: (coldBin.meanY - mildBin.meanY) / mildBin.meanY,
  };
}

export interface ShortTripShare {
  /** Anzahl Kurzstrecken-Fahrten (< thresholdKm). */
  shortCount: number;
  /** Gesamtzahl ausgewerteter Fahrten. */
  totalCount: number;
  /** Anteil Kurzstrecken 0..1. */
  shortShare: number;
  /** Ø-Verbrauch der Kurzstrecken (Wh/km), null falls keine mit Verbrauch. */
  shortMeanConsumption: number | null;
  /** Ø-Verbrauch aller ausgewerteten Fahrten (Wh/km), null falls keiner. */
  overallMeanConsumption: number | null;
}

/**
 * Anteil der Kurzstrecken (< thresholdKm) und deren Ø-Verbrauch gegenüber dem
 * Gesamt-Ø. Kurzstrecke ist ein Verbrauchstreiber (kalter Antriebsstrang),
 * daher der direkte Vergleich. Items ohne distanceKm werden ignoriert; der
 * Verbrauchs-Ø berücksichtigt nur Items mit vorhandenem Verbrauch.
 */
export function shortTripShare<T>(
  items: readonly T[],
  getDistanceKm: (item: T) => number | null | undefined,
  getConsumption: (item: T) => number | null | undefined,
  thresholdKm: number,
): ShortTripShare {
  let shortCount = 0;
  let totalCount = 0;
  let shortSum = 0;
  let shortConsCount = 0;
  let overallSum = 0;
  let overallConsCount = 0;

  for (const item of items) {
    const dist = getDistanceKm(item);
    if (dist == null || Number.isNaN(dist)) continue;
    totalCount += 1;

    const cons = getConsumption(item);
    const hasCons = cons != null && !Number.isNaN(cons);
    if (hasCons) {
      overallSum += cons;
      overallConsCount += 1;
    }

    if (dist < thresholdKm) {
      shortCount += 1;
      if (hasCons) {
        shortSum += cons;
        shortConsCount += 1;
      }
    }
  }

  return {
    shortCount,
    totalCount,
    shortShare: totalCount > 0 ? shortCount / totalCount : 0,
    shortMeanConsumption: shortConsCount > 0 ? shortSum / shortConsCount : null,
    overallMeanConsumption:
      overallConsCount > 0 ? overallSum / overallConsCount : null,
  };
}


/**
 * Verbrauchs-Anomalien werden nicht gegen einen festen Fahrzeug-Grenzwert,
 * sondern gegen vergleichbare Fahrten desselben Fahrzeugs bewertet.
 *
 * Vergleichskriterien:
 * - mindestens 5 km
 * - gleiche Streckenklasse
 * - ähnliche Außentemperatur
 * - ähnliches effektives Durchschnittstempo
 * - mindestens 8 Vergleichsfahrten
 *
 * Als robuste Referenz dient der Median der Vergleichsfahrten.
 */
export const CONSUMPTION_ANOMALY_MIN_DISTANCE_KM = 5;
export const CONSUMPTION_ANOMALY_MIN_COMPARISONS = 8;
export const CONSUMPTION_ANOMALY_TEMP_TOLERANCE_C = 5;
export const CONSUMPTION_ANOMALY_SPEED_TOLERANCE_KMH = 15;
export const CONSUMPTION_ANOMALY_NOTICEABLE_RATIO = 0.25;
export const CONSUMPTION_ANOMALY_STRONG_RATIO = 0.40;

export type ConsumptionAnomalySeverity = "noticeable" | "strong";

export interface ConsumptionAnomaly<T> {
  item: T;
  actualWhKm: number;
  baselineWhKm: number;
  deviationRatio: number;
  comparisonCount: number;
  severity: ConsumptionAnomalySeverity;
}

export interface ConsumptionAnomalyAccessors<T> {
  getDistanceKm: (item: T) => number | null | undefined;
  getConsumptionWhKm: (item: T) => number | null | undefined;
  getTempC: (item: T) => number | null | undefined;
  getAvgSpeedKmh: (item: T) => number | null | undefined;
}

function consumptionDistanceClass(distanceKm: number): number {
  if (distanceKm < 10) return 0;
  if (distanceKm < 25) return 1;
  if (distanceKm < 60) return 2;
  return 3;
}

function numericMedian(values: readonly number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle]!;
  }

  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function detectConsumptionAnomalies<T>(
  items: readonly T[],
  accessors: ConsumptionAnomalyAccessors<T>,
): ConsumptionAnomaly<T>[] {
  const result: ConsumptionAnomaly<T>[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;

    const distanceKm = accessors.getDistanceKm(item);
    const actualWhKm = accessors.getConsumptionWhKm(item);
    const tempC = accessors.getTempC(item);
    const avgSpeedKmh = accessors.getAvgSpeedKmh(item);

    if (
      distanceKm == null ||
      actualWhKm == null ||
      tempC == null ||
      avgSpeedKmh == null ||
      !Number.isFinite(distanceKm) ||
      !Number.isFinite(actualWhKm) ||
      !Number.isFinite(tempC) ||
      !Number.isFinite(avgSpeedKmh) ||
      distanceKm < CONSUMPTION_ANOMALY_MIN_DISTANCE_KM ||
      actualWhKm <= 0
    ) {
      continue;
    }

    const distanceClass = consumptionDistanceClass(distanceKm);
    const comparableConsumptions: number[] = [];

    for (let j = 0; j < items.length; j += 1) {
      if (j === i) continue;

      const other = items[j]!;

      const otherDistance = accessors.getDistanceKm(other);
      const otherConsumption = accessors.getConsumptionWhKm(other);
      const otherTemp = accessors.getTempC(other);
      const otherSpeed = accessors.getAvgSpeedKmh(other);

      if (
        otherDistance == null ||
        otherConsumption == null ||
        otherTemp == null ||
        otherSpeed == null ||
        !Number.isFinite(otherDistance) ||
        !Number.isFinite(otherConsumption) ||
        !Number.isFinite(otherTemp) ||
        !Number.isFinite(otherSpeed) ||
        otherDistance < CONSUMPTION_ANOMALY_MIN_DISTANCE_KM ||
        otherConsumption <= 0
      ) {
        continue;
      }

      if (consumptionDistanceClass(otherDistance) !== distanceClass) {
        continue;
      }

      if (
        Math.abs(otherTemp - tempC) >
        CONSUMPTION_ANOMALY_TEMP_TOLERANCE_C
      ) {
        continue;
      }

      if (
        Math.abs(otherSpeed - avgSpeedKmh) >
        CONSUMPTION_ANOMALY_SPEED_TOLERANCE_KMH
      ) {
        continue;
      }

      comparableConsumptions.push(otherConsumption);
    }

    if (
      comparableConsumptions.length <
      CONSUMPTION_ANOMALY_MIN_COMPARISONS
    ) {
      continue;
    }

    const baselineWhKm = numericMedian(comparableConsumptions);
    if (baselineWhKm == null || baselineWhKm <= 0) continue;

    const deviationRatio = (actualWhKm - baselineWhKm) / baselineWhKm;

    if (deviationRatio < CONSUMPTION_ANOMALY_NOTICEABLE_RATIO) {
      continue;
    }

    result.push({
      item,
      actualWhKm,
      baselineWhKm,
      deviationRatio,
      comparisonCount: comparableConsumptions.length,
      severity:
        deviationRatio >= CONSUMPTION_ANOMALY_STRONG_RATIO
          ? "strong"
          : "noticeable",
    });
  }

  return result.sort((a, b) => b.deviationRatio - a.deviationRatio);
}
