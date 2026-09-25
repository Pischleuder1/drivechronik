export interface TpmsReadings {
  fl: number | null;
  fr: number | null;
  rl: number | null;
  rr: number | null;
}

export interface TpmsThresholds {
  /** Absolute floor in bar — below this a tire always warns. Default 2.4. */
  minBar?: number;
  /** Pressure deficit versus the same-axle tire that triggers a warning. Default 0.2 bar. */
  maxAxleDeltaBar?: number;
}

export interface TpmsTireAssessment {
  value: number | null;
  warn: boolean;
}

export interface TpmsAssessment {
  fl: TpmsTireAssessment;
  fr: TpmsTireAssessment;
  rl: TpmsTireAssessment;
  rr: TpmsTireAssessment;
  anyWarn: boolean;
}

/**
 * Per-tire pressure assessment for the dashboard TPMS card.
 *
 * Two independent warning triggers per tire:
 * - absolute: value < minBar,
 * - relative: partner - value >= maxAxleDeltaBar. Only the lower-pressure
 *   tire is flagged, which helps highlight a possible pressure loss.
 *
 * Null-safe: a missing tire never warns (nothing to compare), and a tire
 * with a null axle partner falls back to the absolute check only.
 */
export function assessTpms(
  readings: TpmsReadings,
  thresholds: TpmsThresholds = {},
): TpmsAssessment {
  const minBar = thresholds.minBar ?? 2.4;
  const maxAxleDeltaBar = thresholds.maxAxleDeltaBar ?? 0.2;

  const fl = assessTire(readings.fl, readings.fr, minBar, maxAxleDeltaBar);
  const fr = assessTire(readings.fr, readings.fl, minBar, maxAxleDeltaBar);
  const rl = assessTire(readings.rl, readings.rr, minBar, maxAxleDeltaBar);
  const rr = assessTire(readings.rr, readings.rl, minBar, maxAxleDeltaBar);

  return {
    fl,
    fr,
    rl,
    rr,
    anyWarn: fl.warn || fr.warn || rl.warn || rr.warn,
  };
}

function assessTire(
  value: number | null,
  partner: number | null,
  minBar: number,
  maxAxleDeltaBar: number,
): TpmsTireAssessment {
  if (value == null) return { value: null, warn: false };

  if (value < minBar) return { value, warn: true };

  if (partner != null) {
    const EPSILON = 1e-9;
    if (partner - value + EPSILON >= maxAxleDeltaBar) {
      return { value, warn: true };
    }
  }

  return { value, warn: false };
}
