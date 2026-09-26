import {
  teslaFiLocalTimeToUtc,
} from "./timezone.js";

import {
  teslaFiOdometerToKm,
  teslaFiSpeedToKmh,
  type TeslaFiDistanceUnit,
} from "./units.js";

export type TeslaFiFieldReader = (
  name: string,
) => string | null;

export interface TeslaFiNormalizeRowOptions {
  timeZone?: string;
  distanceUnit?: TeslaFiDistanceUnit;
  lineNumber?: number;
}

export interface TeslaFiNormalizedRow {
  lineNumber: number | null;

  localDateTime: string;
  localTimestamp: number;

  /*
   * Nur gesetzt, wenn eine lokale TeslaFi-Zeit
   * eindeutig und sicher nach UTC konvertiert
   * werden konnte.
   */
  utcMs: number | null;

  /*
   * Zeitachse für die Segmentierung:
   * - mit Zeitzone: sicherer UTC-Zeitstempel
   * - ohne Zeitzone: lokale Pseudo-Zeit für
   *   bestehende Preview-Kompatibilität
   */
  segmentTimestamp: number | null;

  timeValid: boolean;
  timeAmbiguous: boolean;

  lat: number | null;
  lon: number | null;

  speedKmh: number | null;
  odometerKm: number;

  batteryLevel: number | null;
  usableBatteryLevel: number | null;
  soc: number | null;

  /*
   * Noch absichtlich "Raw":
   * Für Elevation und Temperaturen wurde die
   * TeslaFi-Einheit bei imperialen Exporten noch
   * nicht verbindlich festgelegt.
   */
  elevationRaw: number | null;
  insideTempRaw: number | null;
  outsideTempRaw: number | null;

  /*
   * Power ist die TeslaFi-Fahrzeugleistung.
   * Sie darf NICHT als Charger_Power behandelt
   * werden.
   */
  vehiclePowerRaw: number | null;

  chargerPowerKw: number | null;
  chargerCurrentA: number | null;
  chargerPilotCurrentA: number | null;
  chargerVoltageV: number | null;
  chargeRateRaw: number | null;
  chargeEnergyAddedKwh: number | null;

  shiftState: string | null;
  state: string | null;

  vehicleId: string | null;
  displayName: string | null;
  carType: string | null;

  fastChargerPresent: string | null;
  fastChargerBrand: string | null;
  fastChargerType: string | null;
  connectedChargeCable: string | null;
}

export function teslaFiNumberValue(
  value: string | null,
): number | null {
  if (value == null) return null;

  const trimmed = value.trim();

  if (trimmed === "") return null;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export function teslaFiTextValue(
  value: string | null,
): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed === ""
    ? null
    : trimmed;
}

export function parseTeslaFiLocalDateTime(
  value: string | null,
): number | null {
  if (value == null) return null;

  const match =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(
      value.trim(),
    );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  const ms = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
  );

  const check = new Date(ms);

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second
  ) {
    return null;
  }

  return ms;
}

export function normalizeTeslaFiRow(
  field: TeslaFiFieldReader,
  options: TeslaFiNormalizeRowOptions = {},
): TeslaFiNormalizedRow | null {
  const distanceUnit =
    options.distanceUnit ?? "metric";

  const localDateTime =
    teslaFiTextValue(
      field("Date_Time"),
    );

  const localTimestamp =
    parseTeslaFiLocalDateTime(
      localDateTime,
    );

  const rawOdometer =
    teslaFiNumberValue(
      field("Odometer"),
    );

  if (
    localDateTime == null ||
    localTimestamp == null ||
    rawOdometer == null
  ) {
    return null;
  }

  const odometerKm =
    teslaFiOdometerToKm(
      rawOdometer,
      distanceUnit,
    );

  if (odometerKm == null) {
    return null;
  }

  let utcMs: number | null = null;
  let segmentTimestamp: number | null =
    localTimestamp;

  let timeValid = true;
  let timeAmbiguous = false;

  if (options.timeZone) {
    const converted =
      teslaFiLocalTimeToUtc(
        localDateTime,
        options.timeZone,
      );

    timeValid = converted.valid;
    timeAmbiguous = converted.ambiguous;

    utcMs =
      converted.valid &&
      !converted.ambiguous &&
      converted.utcMs != null
        ? converted.utcMs
        : null;

    segmentTimestamp = utcMs;
  }

  const rawLat =
    teslaFiNumberValue(
      field("Latitude"),
    );

  const rawLon =
    teslaFiNumberValue(
      field("Longitude"),
    );

  const validGps =
    rawLat != null &&
    rawLon != null &&
    rawLat >= -90 &&
    rawLat <= 90 &&
    rawLon >= -180 &&
    rawLon <= 180;

  const rawSpeed =
    teslaFiNumberValue(
      field("Speed"),
    );

  const batteryLevel =
    teslaFiNumberValue(
      field("Battery_Level"),
    );

  const usableBatteryLevel =
    teslaFiNumberValue(
      field("Usable_Battery_Level"),
    );

  return {
    lineNumber:
      options.lineNumber ?? null,

    localDateTime,
    localTimestamp,

    utcMs,
    segmentTimestamp,

    timeValid,
    timeAmbiguous,

    lat: validGps ? rawLat : null,
    lon: validGps ? rawLon : null,

    speedKmh:
      teslaFiSpeedToKmh(
        rawSpeed,
        distanceUnit,
      ),

    odometerKm,

    batteryLevel,
    usableBatteryLevel,

    soc:
      usableBatteryLevel ??
      batteryLevel,

    elevationRaw:
      teslaFiNumberValue(
        field("Elevation"),
      ),

    insideTempRaw:
      teslaFiNumberValue(
        field("Inside_Temp"),
      ),

    outsideTempRaw:
      teslaFiNumberValue(
        field("Outside_Temp"),
      ),

    vehiclePowerRaw:
      teslaFiNumberValue(
        field("Power"),
      ),

    chargerPowerKw:
      teslaFiNumberValue(
        field("Charger_Power"),
      ),

    chargerCurrentA:
      teslaFiNumberValue(
        field("Charger_Actual_Current"),
      ),

    chargerPilotCurrentA:
      teslaFiNumberValue(
        field("Charger_Pilot_Current"),
      ),

    chargerVoltageV:
      teslaFiNumberValue(
        field("Charger_Voltage"),
      ),

    chargeRateRaw:
      teslaFiNumberValue(
        field("Charge_Rate"),
      ),

    chargeEnergyAddedKwh:
      teslaFiNumberValue(
        field("Charge_Energy_Added"),
      ),

    shiftState:
      teslaFiTextValue(
        field("Shift_State"),
      ),

    state:
      teslaFiTextValue(
        field("State"),
      ),

    vehicleId:
      teslaFiTextValue(
        field("Vehicle_Id"),
      ),

    displayName:
      teslaFiTextValue(
        field("Display_Name"),
      ),

    carType:
      teslaFiTextValue(
        field("Car_Type"),
      ),

    fastChargerPresent:
      teslaFiTextValue(
        field("Fast_Charger_Present"),
      ),

    fastChargerBrand:
      teslaFiTextValue(
        field("Fast_Charger_Brand"),
      ),

    fastChargerType:
      teslaFiTextValue(
        field("Fast_Charger_Type"),
      ),

    connectedChargeCable:
      teslaFiTextValue(
        field("Conn_Charge_Cable"),
      ),
  };
}
