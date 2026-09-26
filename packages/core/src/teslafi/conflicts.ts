export interface TeslaFiCandidateInterval {
  startMs: number;
  endMs: number;
}

export interface TeslaFiExistingInterval {
  id: number;
  source: string;
  startMs: number;
  endMs: number | null;
}

export interface TeslaFiIntervalConflict {
  candidateIndex: number;
  conflicts: Array<{
    id: number;
    source: string;
    startMs: number;
    endMs: number | null;
  }>;
}

function assertCandidateInterval(
  interval: TeslaFiCandidateInterval,
): void {
  if (
    !Number.isFinite(interval.startMs) ||
    !Number.isFinite(interval.endMs) ||
    interval.endMs < interval.startMs
  ) {
    throw new Error(
      "Ungültiges TeslaFi-Kandidatenintervall",
    );
  }
}

function assertExistingInterval(
  interval: TeslaFiExistingInterval,
): void {
  if (
    !Number.isFinite(interval.startMs) ||
    (
      interval.endMs != null &&
      (
        !Number.isFinite(interval.endMs) ||
        interval.endMs < interval.startMs
      )
    )
  ) {
    throw new Error(
      "Ungültiges bestehendes Intervall",
    );
  }
}

export function teslaFiIntervalsOverlap(
  candidate: TeslaFiCandidateInterval,
  existing: TeslaFiExistingInterval,
): boolean {
  assertCandidateInterval(candidate);
  assertExistingInterval(existing);

  const existingEnd =
    existing.endMs ?? Number.POSITIVE_INFINITY;

  return (
    candidate.startMs <= existingEnd &&
    candidate.endMs >= existing.startMs
  );
}

export function findTeslaFiIntervalConflicts(
  candidates: TeslaFiCandidateInterval[],
  existingIntervals: TeslaFiExistingInterval[],
): TeslaFiIntervalConflict[] {
  candidates.forEach(assertCandidateInterval);
  existingIntervals.forEach(assertExistingInterval);

  return candidates.map(
    (candidate, candidateIndex) => ({
      candidateIndex,

      conflicts: existingIntervals
        .filter((existing) =>
          teslaFiIntervalsOverlap(
            candidate,
            existing,
          ),
        )
        .map((existing) => ({
          id: existing.id,
          source: existing.source,
          startMs: existing.startMs,
          endMs: existing.endMs,
        })),
    }),
  );
}
