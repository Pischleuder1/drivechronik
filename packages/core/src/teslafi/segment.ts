export interface TeslaFiDriveSignal {
  ts: number;
  shift: string | null;
  speed: number | null;
  odometer: number | null;
}

export interface TeslaFiDriveEpisode {
  startTs: number;
  endTs: number;
  samples: TeslaFiDriveSignal[];
}

export interface TeslaFiChargeSignal {
  ts: number;
  powerKw: number | null;
  currentA: number | null;
  chargeRate: number | null;
  energyAdded: number | null;
  soc: number | null;
}

export interface TeslaFiChargeEpisode {
  startTs: number;
  endTs: number;
  startSoc: number | null;
  endSoc: number | null;
  maxPowerKw: number | null;
  samples: TeslaFiChargeSignal[];
}

const DRIVE_GAP_MS = 10 * 60 * 1000;
const SUSTAINED_PARK_MS = 5 * 60 * 1000;
const CHARGE_GAP_MS = 15 * 60 * 1000;

function normalizeShift(
  value: string | null,
): string | null {
  const normalized =
    value?.trim().toUpperCase() ?? "";

  return normalized || null;
}

function cleanDriveSignals(
  input: TeslaFiDriveSignal[],
): TeslaFiDriveSignal[] {
  const sorted = [...input].sort(
    (a, b) => a.ts - b.ts,
  );

  const result: TeslaFiDriveSignal[] = [];

  for (const signal of sorted) {
    const normalized = {
      ...signal,
      shift: normalizeShift(signal.shift),
    };

    if (
      result.length > 0 &&
      result[result.length - 1]!.ts ===
        normalized.ts
    ) {
      result[result.length - 1] =
        normalized;
    } else {
      result.push(normalized);
    }
  }

  return result;
}

function driveSignalIsActive(
  signal: TeslaFiDriveSignal,
  previousOdometer: number | null,
): boolean {
  if (
    signal.shift === "D" ||
    signal.shift === "R" ||
    signal.shift === "N"
  ) {
    return true;
  }

  if (
    signal.speed != null &&
    signal.speed > 0
  ) {
    return true;
  }

  if (
    signal.odometer != null &&
    previousOdometer != null &&
    signal.odometer > previousOdometer
  ) {
    return true;
  }

  return false;
}

export function segmentTeslaFiDrives(
  input: TeslaFiDriveSignal[],
): TeslaFiDriveEpisode[] {
  const samples =
    cleanDriveSignals(input);

  const episodes: TeslaFiDriveEpisode[] =
    [];

  let startIndex = -1;
  let lastActiveIndex = -1;
  let parkStartTs: number | null = null;

  const emit = () => {
    if (
      startIndex < 0 ||
      lastActiveIndex < startIndex
    ) {
      return;
    }

    const episodeSamples =
      samples.slice(
        startIndex,
        lastActiveIndex + 1,
      );

    if (episodeSamples.length === 0) {
      return;
    }

    episodes.push({
      startTs: episodeSamples[0]!.ts,
      endTs:
        episodeSamples[
          episodeSamples.length - 1
        ]!.ts,
      samples: episodeSamples,
    });
  };

  for (
    let index = 0;
    index < samples.length;
    index += 1
  ) {
    const sample = samples[index]!;

    const previous =
      index > 0
        ? samples[index - 1]!
        : null;

    const previousOdometer =
      previous?.odometer ?? null;

    const active =
      driveSignalIsActive(
        sample,
        previousOdometer,
      );

    if (startIndex === -1) {
      if (active) {
        startIndex = index;
        lastActiveIndex = index;
        parkStartTs = null;
      }

      continue;
    }

    const gap =
      sample.ts -
      samples[index - 1]!.ts;

    if (gap > DRIVE_GAP_MS) {
      emit();

      if (active) {
        startIndex = index;
        lastActiveIndex = index;
      } else {
        startIndex = -1;
        lastActiveIndex = -1;
      }

      parkStartTs = null;
      continue;
    }

    if (active) {
      lastActiveIndex = index;
      parkStartTs = null;
      continue;
    }

    if (parkStartTs == null) {
      parkStartTs = sample.ts;
      continue;
    }

    if (
      sample.ts - parkStartTs >=
      SUSTAINED_PARK_MS
    ) {
      emit();

      startIndex = -1;
      lastActiveIndex = -1;
      parkStartTs = null;
    }
  }

  if (startIndex !== -1) {
    emit();
  }

  return episodes;
}

function cleanChargeSignals(
  input: TeslaFiChargeSignal[],
): TeslaFiChargeSignal[] {
  const sorted = [...input].sort(
    (a, b) => a.ts - b.ts,
  );

  const result: TeslaFiChargeSignal[] =
    [];

  for (const signal of sorted) {
    if (
      result.length > 0 &&
      result[result.length - 1]!.ts ===
        signal.ts
    ) {
      result[result.length - 1] =
        signal;
    } else {
      result.push(signal);
    }
  }

  return result;
}

function chargeSignalIsActive(
  signal: TeslaFiChargeSignal,
  previousEnergy: number | null,
): boolean {
  if (
    signal.powerKw != null &&
    signal.powerKw > 0
  ) {
    return true;
  }

  if (
    signal.currentA != null &&
    signal.currentA > 0
  ) {
    return true;
  }

  if (
    signal.chargeRate != null &&
    signal.chargeRate > 0
  ) {
    return true;
  }

  if (
    signal.energyAdded != null &&
    previousEnergy != null &&
    signal.energyAdded >
      previousEnergy + 0.0001
  ) {
    return true;
  }

  return false;
}

function buildChargeEpisode(
  samples: TeslaFiChargeSignal[],
): TeslaFiChargeEpisode {
  let maxPowerKw: number | null = null;

  for (const sample of samples) {
    if (
      sample.powerKw != null &&
      (
        maxPowerKw == null ||
        sample.powerKw > maxPowerKw
      )
    ) {
      maxPowerKw = sample.powerKw;
    }
  }

  return {
    startTs: samples[0]!.ts,
    endTs:
      samples[samples.length - 1]!.ts,
    startSoc: samples[0]!.soc,
    endSoc:
      samples[samples.length - 1]!.soc,
    maxPowerKw,
    samples,
  };
}

export function segmentTeslaFiCharges(
  input: TeslaFiChargeSignal[],
): TeslaFiChargeEpisode[] {
  const samples =
    cleanChargeSignals(input);

  const activeSamples: TeslaFiChargeSignal[] =
    [];

  let previousEnergy: number | null = null;

  for (const sample of samples) {
    if (
      chargeSignalIsActive(
        sample,
        previousEnergy,
      )
    ) {
      activeSamples.push(sample);
    }

    if (sample.energyAdded != null) {
      previousEnergy =
        sample.energyAdded;
    }
  }

  const episodes: TeslaFiChargeEpisode[] =
    [];

  let current: TeslaFiChargeSignal[] = [];

  const flush = () => {
    if (current.length === 0) {
      return;
    }

    episodes.push(
      buildChargeEpisode(current),
    );

    current = [];
  };

  for (const sample of activeSamples) {
    if (
      current.length > 0 &&
      sample.ts -
        current[current.length - 1]!.ts >
        CHARGE_GAP_MS
    ) {
      flush();
    }

    current.push(sample);
  }

  flush();

  return episodes;
}
