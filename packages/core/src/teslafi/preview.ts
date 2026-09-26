import { parseCsvLine } from "../tessie/parse.js";
import {
  segmentTeslaFiCharges,
  segmentTeslaFiDrives,
  type TeslaFiChargeSignal,
  type TeslaFiDriveSignal,
} from "./segment.js";
import {
  previewTeslaFiTimes,
  type TeslaFiTimePreview,
} from "./time-preview.js";
import {
  teslaFiOdometerToKm,
  teslaFiSpeedToKmh,
  type TeslaFiDistanceUnit,
} from "./units.js";

export const TESLAFI_KNOWN_HEADERS = [
  "Date",
  "Date_Format",
  "Date_Time",
  "Latitude",
  "Longitude",
  "Speed",
  "Odometer",
  "Battery_Level",
  "Usable_Battery_Level",
  "Charge_Energy_Added",
  "Power",
  "Heading",
  "Elevation",
  "Inside_Temp",
  "Outside_Temp",
  "Fan_Status",
  "Climate_On",
  "Is_Climate_On",
  "Is_Preconditioning",
  "Seat_Heater_Left",
  "Seat_Heater_Right",
  "Seat_Heater_Rear_Left",
  "Seat_Heater_Rear_Center",
  "Seat_Heater_Rear_Right",
  "Driver_Temp_Setting",
  "Passenger_Temp_Setting",
  "Sentry_Mode",
  "Battery_Heater_On",
  "Battery_Heater_No_Power",
  "Fast_Charger_Present",
  "Charger_Energy_To_Make_Edits",
  "Charger_Actual_Current",
  "Charger_Pilot_Current",
  "Charger_Power",
  "Charger_Voltage",
  "Time_To_Full_Charge",
  "Charge_Rate",
  "Charge_Port_Door_Open",
  "Conn_Charge_Cable",
  "Fast_Charger_Brand",
  "Fast_Charger_Type",
  "Scheduled_Charging_Pending",
  "Scheduled_Charging_Start_Time",
  "Shift_State",
  "Vehicle_Id",
  "Display_Name",
  "Locked",
  "Car_Type",
  "Rear_Seat_Heaters",
  "Frunk_Open",
  "Trunk_Open",
  "Left_Blinded_Windows",
  "Right_Blinded_Windows",
  "Door_Passenger_Front",
  "Door_Passenger_Rear",
  "Door_Driver_Front",
  "Door_Driver_Rear",
  "Sun_Roof_Percent",
  "Sun_Roof_State",
  "Center_Display_State",
  "Notifications_Supported",
  "Parsed_Calendar_Supported",
  "Smart_Preconditioning",
  "Wheel_Type",
  "Has_Spoiler",
  "Roof_Color",
  "Cu_Version",
  "Exterior_Color",
  "State",
  "Tpms_Pressure_Fl",
  "Tpms_Pressure_Fr",
  "Tpms_Pressure_Rl",
  "Tpms_Pressure_Rr",
  "Active_Route_Latitude",
  "Active_Route_Longitude",
  "Active_Route_Destination_Name",
] as const;

const REQUIRED_HEADERS = [
  "Date_Time",
  "Odometer",
] as const;

export interface TeslaFiCapabilities {
  gps: boolean;
  speed: boolean;
  odometer: boolean;
  soc: boolean;
  charging: boolean;
  shiftState: boolean;
  vehicleState: boolean;
  climate: boolean;
  tpms: boolean;
  navigation: boolean;
  vehicleIdentity: boolean;
}

export interface TeslaFiPreviewOptions {
  timeZone?: string;
  distanceUnit?: TeslaFiDistanceUnit;
}

export interface TeslaFiPreview {
  recognized: boolean;

  headerCount: number;
  knownHeaderCount: number;

  unknownHeaders: string[];
  missingKnownHeaders: string[];
  missingRequiredHeaders: string[];

  rowCount: number;
  validRows: number;
  invalidRows: number;

  minDateTime: string | null;
  maxDateTime: string | null;

  vehicleIds: string[];
  displayNames: string[];
  dateFormats: string[];

  gpsRows: number;
  movingRows: number;
  chargingRows: number;

  driveEpisodes: Array<{
    startDateTime: string;
    endDateTime: string;
    distanceKm: number | null;
    sampleCount: number;
  }>;

  chargeEpisodes: Array<{
    startDateTime: string;
    endDateTime: string;
    startSoc: number | null;
    endSoc: number | null;
    maxPowerKw: number | null;
    sampleCount: number;
  }>;

  timePreview: TeslaFiTimePreview | null;

  capabilities: TeslaFiCapabilities;
}

function numberValue(value: string | null): number | null {
  if (value == null) return null;

  const trimmed = value.trim();

  if (trimmed === "") return null;

  const n = Number(trimmed);

  return Number.isFinite(n) ? n : null;
}

/**
 * TeslaFi liefert Date_Time ohne Zeitzoneninformation.
 *
 * Für den Dry-Run benötigen wir zunächst nur eine robuste Prüfung und
 * chronologische Sortierbarkeit. Die echte Zeitzonenumrechnung erfolgt
 * später beim Import.
 */
function parseLocalDateTime(value: string | null): number | null {
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

  const d = new Date(ms);

  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hour ||
    d.getUTCMinutes() !== minute ||
    d.getUTCSeconds() !== second
  ) {
    return null;
  }

  return ms;
}

function hasHeader(
  headerMap: Map<string, number>,
  name: string,
): boolean {
  return headerMap.has(name);
}

function formatLocalDateTime(
  timestamp: number,
): string {
  const d = new Date(timestamp);

  const pad = (value: number) =>
    String(value).padStart(2, "0");

  return [
    d.getUTCFullYear(),
    "-",
    pad(d.getUTCMonth() + 1),
    "-",
    pad(d.getUTCDate()),
    " ",
    pad(d.getUTCHours()),
    ":",
    pad(d.getUTCMinutes()),
    ":",
    pad(d.getUTCSeconds()),
  ].join("");
}

export function previewTeslaFiCsv(
  csvText: string,
  options: TeslaFiPreviewOptions = {},
): TeslaFiPreview {
  const normalized = csvText.replace(/^\uFEFF/, "");

  const distanceUnit =
    options.distanceUnit ?? "metric";

  const lines = normalized
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("TeslaFi CSV ist leer.");
  }

  const headers = parseCsvLine(lines[0]!).map(
    (value) => value?.trim() ?? "",
  );

  const headerMap = new Map<string, number>();

  headers.forEach((header, index) => {
    if (header !== "" && !headerMap.has(header)) {
      headerMap.set(header, index);
    }
  });

  const knownSet = new Set<string>(
    TESLAFI_KNOWN_HEADERS,
  );

  const unknownHeaders = headers.filter(
    (header) =>
      header !== "" &&
      !knownSet.has(header),
  );

  const missingKnownHeaders =
    TESLAFI_KNOWN_HEADERS.filter(
      (header) => !headerMap.has(header),
    );

  const missingRequiredHeaders =
    REQUIRED_HEADERS.filter(
      (header) => !headerMap.has(header),
    );

  const knownHeaderCount =
    TESLAFI_KNOWN_HEADERS.length -
    missingKnownHeaders.length;

  const capabilities: TeslaFiCapabilities = {
    gps:
      hasHeader(headerMap, "Latitude") &&
      hasHeader(headerMap, "Longitude"),

    speed: hasHeader(headerMap, "Speed"),

    odometer: hasHeader(headerMap, "Odometer"),

    soc:
      hasHeader(headerMap, "Battery_Level") ||
      hasHeader(
        headerMap,
        "Usable_Battery_Level",
      ),

    charging:
      hasHeader(headerMap, "Charger_Power") ||
      hasHeader(
        headerMap,
        "Charger_Actual_Current",
      ) ||
      hasHeader(headerMap, "Charge_Rate") ||
      hasHeader(
        headerMap,
        "Charge_Energy_Added",
      ),

    shiftState: hasHeader(
      headerMap,
      "Shift_State",
    ),

    vehicleState: hasHeader(
      headerMap,
      "State",
    ),

    climate:
      hasHeader(headerMap, "Inside_Temp") ||
      hasHeader(headerMap, "Outside_Temp") ||
      hasHeader(headerMap, "Is_Climate_On"),

    tpms:
      hasHeader(headerMap, "Tpms_Pressure_Fl") ||
      hasHeader(headerMap, "Tpms_Pressure_Fr") ||
      hasHeader(headerMap, "Tpms_Pressure_Rl") ||
      hasHeader(headerMap, "Tpms_Pressure_Rr"),

    navigation:
      hasHeader(
        headerMap,
        "Active_Route_Latitude",
      ) ||
      hasHeader(
        headerMap,
        "Active_Route_Longitude",
      ) ||
      hasHeader(
        headerMap,
        "Active_Route_Destination_Name",
      ),

    vehicleIdentity:
      hasHeader(headerMap, "Vehicle_Id") ||
      hasHeader(headerMap, "Display_Name") ||
      hasHeader(headerMap, "Car_Type"),
  };

  const vehicleIds = new Set<string>();
  const displayNames = new Set<string>();
  const dateFormats = new Set<string>();

  const localDateTimes: Array<string | null> = [];

  let validRows = 0;
  let invalidRows = 0;

  let minTs: number | null = null;
  let maxTs: number | null = null;

  let minDateTime: string | null = null;
  let maxDateTime: string | null = null;

  let gpsRows = 0;
  let movingRows = 0;
  let chargingRows = 0;

  const driveSignals: TeslaFiDriveSignal[] = [];
  const chargeSignals: TeslaFiChargeSignal[] = [];

  let previousOdometer: number | null = null;
  let previousChargeEnergy: number | null = null;

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const fields = parseCsvLine(lines[lineIndex]!);

    if (fields.length !== headers.length) {
      invalidRows++;
      continue;
    }

    const field = (
      name: string,
    ): string | null => {
      const index = headerMap.get(name);

      if (index == null) return null;

      return fields[index] ?? null;
    };

    const dateTime = field("Date_Time");

    localDateTimes.push(dateTime);

    const timestamp = parseLocalDateTime(dateTime);

    const odometer = numberValue(
      field("Odometer"),
    );

    if (
      timestamp == null ||
      odometer == null
    ) {
      invalidRows++;
      continue;
    }

    validRows++;

    if (
      minTs == null ||
      timestamp < minTs
    ) {
      minTs = timestamp;
      minDateTime = dateTime;
    }

    if (
      maxTs == null ||
      timestamp > maxTs
    ) {
      maxTs = timestamp;
      maxDateTime = dateTime;
    }

    const vehicleId = field("Vehicle_Id");
    if (vehicleId) vehicleIds.add(vehicleId);

    const displayName = field("Display_Name");
    if (displayName) {
      displayNames.add(displayName);
    }

    const dateFormat = field("Date_Format");
    if (dateFormat) dateFormats.add(dateFormat);

    const lat = numberValue(
      field("Latitude"),
    );
    const lon = numberValue(
      field("Longitude"),
    );

    if (
      lat != null &&
      lon != null &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      gpsRows++;
    }

    const shiftState =
      field("Shift_State");

    const rawSpeed =
      numberValue(field("Speed")) ?? 0;

    const speed =
      teslaFiSpeedToKmh(
        rawSpeed,
        distanceUnit,
      ) ?? 0;

    const odometerKm =
      teslaFiOdometerToKm(
        odometer,
        distanceUnit,
      );

    driveSignals.push({
      ts: timestamp,
      shift: shiftState,
      speed,
      odometer: odometerKm,
    });

    const odometerIncreased =
      previousOdometer != null &&
      odometer > previousOdometer;

    if (
      shiftState === "D" ||
      shiftState === "R" ||
      shiftState === "N" ||
      speed > 0 ||
      odometerIncreased
    ) {
      movingRows++;
    }

    const chargerPower =
      numberValue(
        field("Charger_Power"),
      ) ?? 0;

    const chargerCurrent =
      numberValue(
        field("Charger_Actual_Current"),
      ) ?? 0;

    const chargeRate =
      numberValue(
        field("Charge_Rate"),
      ) ?? 0;

    const chargeEnergy =
      numberValue(
        field("Charge_Energy_Added"),
      );

    const soc =
      numberValue(
        field("Usable_Battery_Level"),
      ) ??
      numberValue(
        field("Battery_Level"),
      );

    chargeSignals.push({
      ts: timestamp,
      powerKw: chargerPower,
      currentA: chargerCurrent,
      chargeRate,
      energyAdded: chargeEnergy,
      soc,
    });

    const energyIncreased =
      previousChargeEnergy != null &&
      chargeEnergy != null &&
      chargeEnergy >
        previousChargeEnergy + 0.0001;

    if (
      chargerPower > 0 ||
      chargerCurrent > 0 ||
      chargeRate > 0 ||
      energyIncreased
    ) {
      chargingRows++;
    }

    previousOdometer = odometer;

    if (chargeEnergy != null) {
      previousChargeEnergy = chargeEnergy;
    }
  }

  const timePreview =
    options.timeZone
      ? previewTeslaFiTimes(
          localDateTimes,
          options.timeZone,
        )
      : null;

  const driveEpisodes =
    segmentTeslaFiDrives(driveSignals).map(
      (episode) => ({
        startDateTime:
          formatLocalDateTime(
            episode.startTs,
          ),
        endDateTime:
          formatLocalDateTime(
            episode.endTs,
          ),
        distanceKm:
          episode.samples.length >= 2 &&
          episode.samples[0]!.odometer != null &&
          episode.samples[
            episode.samples.length - 1
          ]!.odometer != null
            ? Math.max(
                0,
                episode.samples[
                  episode.samples.length - 1
                ]!.odometer! -
                  episode.samples[0]!.odometer!,
              )
            : null,
        sampleCount:
          episode.samples.length,
      }),
    );

  const chargeEpisodes =
    segmentTeslaFiCharges(chargeSignals).map(
      (episode) => ({
        startDateTime:
          formatLocalDateTime(
            episode.startTs,
          ),
        endDateTime:
          formatLocalDateTime(
            episode.endTs,
          ),
        startSoc: episode.startSoc,
        endSoc: episode.endSoc,
        maxPowerKw:
          episode.maxPowerKw,
        sampleCount:
          episode.samples.length,
      }),
    );

  return {
    recognized:
      missingRequiredHeaders.length === 0 &&
      knownHeaderCount >= 8,

    headerCount: headers.length,
    knownHeaderCount,

    unknownHeaders,
    missingKnownHeaders:
      [...missingKnownHeaders],
    missingRequiredHeaders:
      [...missingRequiredHeaders],

    rowCount: Math.max(0, lines.length - 1),
    validRows,
    invalidRows,

    minDateTime,
    maxDateTime,

    vehicleIds: [...vehicleIds],
    displayNames: [...displayNames],
    dateFormats: [...dateFormats],

    gpsRows,
    movingRows,
    chargingRows,

    driveEpisodes,
    chargeEpisodes,

    timePreview,

    capabilities,
  };
}
