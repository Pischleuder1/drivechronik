import type {
  ChargeAnalyticsPoint,
  ChargeAnalyticsSession,
  LocationRanking,
  SlowChargeAlert,
} from "./chargeAnalyticsTypes";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle]!;
  }

  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Ermittelt den Zeitpunkt, an dem ein bestimmter SoC erreicht wurde.
 * Zwischen zwei Messpunkten wird linear interpoliert.
 */
export function timeAtSoc(
  points: ChargeAnalyticsPoint[],
  targetSoc: number,
): number | null {
  const usable = points
    .filter((p): p is ChargeAnalyticsPoint & { soc: number } => p.soc != null)
    .sort((a, b) => a.ts - b.ts);

  if (usable.length === 0) return null;

  for (let i = 0; i < usable.length; i++) {
    const current = usable[i]!;

    if (current.soc === targetSoc) return current.ts;
    if (i === 0) continue;

    const previous = usable[i - 1]!;

    if (current.soc <= previous.soc) continue;

    if (targetSoc > previous.soc && targetSoc < current.soc) {
      const fraction =
        (targetSoc - previous.soc) / (current.soc - previous.soc);

      return previous.ts + fraction * (current.ts - previous.ts);
    }
  }

  return null;
}

export function durationBetweenSoc(
  points: ChargeAnalyticsPoint[],
  fromSoc: number,
  toSoc: number,
): number | null {
  if (toSoc <= fromSoc) return null;

  const from = timeAtSoc(points, fromSoc);
  const to = timeAtSoc(points, toSoc);

  if (from == null || to == null || to <= from) return null;

  return (to - from) / 1000;
}

function locationKey(session: ChargeAnalyticsSession): string {
  if (session.placeId != null) return `place:${session.placeId}`;

  const address = session.address?.trim().toLowerCase();
  if (address) return `address:${address}`;

  return "unknown";
}

function locationLabel(session: ChargeAnalyticsSession): string {
  return (
    session.placeName?.trim() ||
    session.address?.trim() ||
    "Unbekannter Ladeort"
  );
}

export function buildLocationRanking(
  sessions: ChargeAnalyticsSession[],
): LocationRanking[] {
  const groups = new Map<string, ChargeAnalyticsSession[]>();

  for (const session of sessions) {
    const key = locationKey(session);
    const existing = groups.get(key) ?? [];
    existing.push(session);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const peaks = group
        .map((s) => s.maxPowerKw)
        .filter((v): v is number => v != null);

      const durations = group
        .map((s) => durationBetweenSoc(s.points, 10, 80))
        .filter((v): v is number => v != null);

      return {
        key,
        label: locationLabel(group[0]!),
        sessionCount: group.length,
        medianPeakKw: median(peaks),
        medianTenToEightySeconds: median(durations),
      };
    })
    .sort((a, b) => {
      if (b.sessionCount !== a.sessionCount) {
        return b.sessionCount - a.sessionCount;
      }

      return a.label.localeCompare(b.label);
    });
}

/**
 * Markiert Sessions, deren 20–60-%-Zeit deutlich schlechter als vergleichbare
 * Sessions ist. Temperaturähnliche Sessions (±10 °C) werden bevorzugt, sobald
 * mindestens drei Vergleichssessions vorhanden sind.
 */
export function buildSlowAlerts(
  sessions: ChargeAnalyticsSession[],
): SlowChargeAlert[] {
  const MIN_PEERS = 3;
  const SLOW_RATIO = 1.25;
  const MIN_EXTRA_SECONDS = 120;
  const TEMP_WINDOW_C = 10;

  const measured = sessions
    .map((session) => ({
      session,
      durationSeconds: durationBetweenSoc(session.points, 20, 60),
    }))
    .filter(
      (
        row,
      ): row is {
        session: ChargeAnalyticsSession;
        durationSeconds: number;
      } => row.durationSeconds != null,
    );

  const alerts: SlowChargeAlert[] = [];

  for (const current of measured) {
    const allPeers = measured.filter(
      (candidate) => candidate.session.id !== current.session.id,
    );

    const temp = current.session.outsideTempAvg;

    const temperaturePeers =
      temp == null
        ? []
        : allPeers.filter((candidate) => {
            const otherTemp = candidate.session.outsideTempAvg;
            return (
              otherTemp != null &&
              Math.abs(otherTemp - temp) <= TEMP_WINDOW_C
            );
          });

    const peers =
      temperaturePeers.length >= MIN_PEERS ? temperaturePeers : allPeers;

    if (peers.length < MIN_PEERS) continue;

    const peerMedian = median(peers.map((p) => p.durationSeconds));
    if (peerMedian == null || peerMedian <= 0) continue;

    const ratio = current.durationSeconds / peerMedian;
    const delta = current.durationSeconds - peerMedian;

    if (ratio >= SLOW_RATIO && delta >= MIN_EXTRA_SECONDS) {
      alerts.push({
        sessionId: current.session.id,
        durationSeconds: current.durationSeconds,
        peerMedianSeconds: peerMedian,
        ratio,
        comparisonCount: peers.length,
      });
    }
  }

  return alerts.sort((a, b) => b.ratio - a.ratio);
}
