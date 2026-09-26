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
  parseTeslaFiNormalizedCsv,
} from "./normalized-csv.js";
import {
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

function formatPreviewDateTime(
  timestamp: number,
  timeZone?: string,
): string {
  if (!timeZone) {
    return formatLocalDateTime(timestamp);
  }

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      },
    );

  const parts =
    formatter.formatToParts(
      new Date(timestamp),
    );

  const part = (
    type: Intl.DateTimeFormatPartTypes,
  ): string =>
    parts.find(
      (value) =>
        value.type === type,
    )?.value ?? "";

  return [
    part("year"),
    "-",
    part("month"),
    "-",
    part("day"),
    " ",
    part("hour"),
    ":",
    part("minute"),
    ":",
    part("second"),
  ].join("");
}

export function previewTeslaFiCsv(
  csvText: string,
  options: TeslaFiPreviewOptions = {},
): TeslaFiPreview {
  const distanceUnit =
    options.distanceUnit ?? "metric";

  const parsed =
    parseTeslaFiNormalizedCsv(
      csvText,
      {
        timeZone: options.timeZone,
        distanceUnit,
      },
    );

  const headers = parsed.headers;

  const headerMap =
    new Map<string, number>();

  headers.forEach(
    (header, index) => {
      if (
        header !== "" &&
        !headerMap.has(header)
      ) {
        headerMap.set(
          header,
          index,
        );
      }
    },
  );

  const knownSet =
    new Set<string>(
      TESLAFI_KNOWN_HEADERS,
    );

  const unknownHeaders =
    headers.filter(
      (header) =>
        header !== "" &&
        !knownSet.has(header),
    );

  const missingKnownHeaders =
    TESLAFI_KNOWN_HEADERS.filter(
      (header) =>
        !headerMap.has(header),
    );

  const missingRequiredHeaders =
    parsed.missingRequiredHeaders;

  const knownHeaderCount =
    TESLAFI_KNOWN_HEADERS.length -
    missingKnownHeaders.length;

  const capabilities:
    TeslaFiCapabilities = {
      gps:
        hasHeader(
          headerMap,
          "Latitude",
        ) &&
        hasHeader(
          headerMap,
          "Longitude",
        ),

      speed:
        hasHeader(
          headerMap,
          "Speed",
        ),

      odometer:
        hasHeader(
          headerMap,
          "Odometer",
        ),

      soc:
        hasHeader(
          headerMap,
          "Battery_Level",
        ) ||
        hasHeader(
          headerMap,
          "Usable_Battery_Level",
        ),

      charging:
        hasHeader(
          headerMap,
          "Charger_Power",
        ) ||
        hasHeader(
          headerMap,
          "Charger_Actual_Current",
        ) ||
        hasHeader(
          headerMap,
          "Charge_Rate",
        ) ||
        hasHeader(
          headerMap,
          "Charge_Energy_Added",
        ),

      shiftState:
        hasHeader(
          headerMap,
          "Shift_State",
        ),

      vehicleState:
        hasHeader(
          headerMap,
          "State",
        ),

      climate:
        hasHeader(
          headerMap,
          "Inside_Temp",
        ) ||
        hasHeader(
          headerMap,
          "Outside_Temp",
        ) ||
        hasHeader(
          headerMap,
          "Is_Climate_On",
        ),

      tpms:
        hasHeader(
          headerMap,
          "Tpms_Pressure_Fl",
        ) ||
        hasHeader(
          headerMap,
          "Tpms_Pressure_Fr",
        ) ||
        hasHeader(
          headerMap,
          "Tpms_Pressure_Rl",
        ) ||
        hasHeader(
          headerMap,
          "Tpms_Pressure_Rr",
        ),

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
        hasHeader(
          headerMap,
          "Vehicle_Id",
        ) ||
        hasHeader(
          headerMap,
          "Display_Name",
        ) ||
        hasHeader(
          headerMap,
          "Car_Type",
        ),
    };

  const vehicleIds =
    new Set<string>();

  const displayNames =
    new Set<string>();

  const dateFormats =
    new Set<string>();

  let minTs: number | null = null;
  let maxTs: number | null = null;

  let minDateTime:
    string | null = null;

  let maxDateTime:
    string | null = null;

  let gpsRows = 0;
  let movingRows = 0;
  let chargingRows = 0;

  const driveSignals:
    TeslaFiDriveSignal[] = [];

  const chargeSignals:
    TeslaFiChargeSignal[] = [];

  let previousOdometerKm:
    number | null = null;

  let previousChargeEnergy:
    number | null = null;

  for (const row of parsed.rows) {
    if (
      minTs == null ||
      row.localTimestamp < minTs
    ) {
      minTs = row.localTimestamp;
      minDateTime =
        row.localDateTime;
    }

    if (
      maxTs == null ||
      row.localTimestamp > maxTs
    ) {
      maxTs = row.localTimestamp;
      maxDateTime =
        row.localDateTime;
    }

    if (row.vehicleId) {
      vehicleIds.add(
        row.vehicleId,
      );
    }

    if (row.displayName) {
      displayNames.add(
        row.displayName,
      );
    }

    if (row.dateFormat) {
      dateFormats.add(
        row.dateFormat,
      );
    }

    if (
      row.lat != null &&
      row.lon != null
    ) {
      gpsRows++;
    }

    const speed =
      row.speedKmh ?? 0;

    if (
      row.segmentTimestamp != null
    ) {
      driveSignals.push({
        ts:
          row.segmentTimestamp,
        shift:
          row.shiftState,
        speed,
        odometer:
          row.odometerKm,
      });
    }

    const odometerIncreased =
      previousOdometerKm != null &&
      row.odometerKm >
        previousOdometerKm;

    if (
      row.shiftState === "D" ||
      row.shiftState === "R" ||
      row.shiftState === "N" ||
      speed > 0 ||
      odometerIncreased
    ) {
      movingRows++;
    }

    const chargerPower =
      row.chargerPowerKw ?? 0;

    const chargerCurrent =
      row.chargerCurrentA ?? 0;

    const chargeRate =
      row.chargeRateRaw ?? 0;

    const chargeEnergy =
      row.chargeEnergyAddedKwh;

    if (
      row.segmentTimestamp != null
    ) {
      chargeSignals.push({
        ts:
          row.segmentTimestamp,
        powerKw:
          chargerPower,
        currentA:
          chargerCurrent,
        chargeRate,
        energyAdded:
          chargeEnergy,
        soc:
          row.soc,
      });
    }

    const energyIncreased =
      previousChargeEnergy != null &&
      chargeEnergy != null &&
      chargeEnergy >
        previousChargeEnergy +
          0.0001;

    if (
      chargerPower > 0 ||
      chargerCurrent > 0 ||
      chargeRate > 0 ||
      energyIncreased
    ) {
      chargingRows++;
    }

    previousOdometerKm =
      row.odometerKm;

    if (chargeEnergy != null) {
      previousChargeEnergy =
        chargeEnergy;
    }
  }

  const timePreview =
    options.timeZone
      ? previewTeslaFiTimes(
          parsed.localDateTimes,
          options.timeZone,
        )
      : null;

  const driveEpisodes =
    segmentTeslaFiDrives(
      driveSignals,
    ).map(
      (episode) => ({
        startDateTime:
          formatPreviewDateTime(
            episode.startTs,
            options.timeZone,
          ),

        endDateTime:
          formatPreviewDateTime(
            episode.endTs,
            options.timeZone,
          ),

        distanceKm:
          episode.samples.length >= 2 &&
          episode.samples[0]!
            .odometer != null &&
          episode.samples[
            episode.samples.length - 1
          ]!.odometer != null
            ? Math.max(
                0,
                episode.samples[
                  episode.samples.length - 1
                ]!.odometer! -
                  episode.samples[0]!
                    .odometer!,
              )
            : null,

        sampleCount:
          episode.samples.length,
      }),
    );

  const chargeEpisodes =
    segmentTeslaFiCharges(
      chargeSignals,
    ).map(
      (episode) => ({
        startDateTime:
          formatPreviewDateTime(
            episode.startTs,
            options.timeZone,
          ),

        endDateTime:
          formatPreviewDateTime(
            episode.endTs,
            options.timeZone,
          ),

        startSoc:
          episode.startSoc,

        endSoc:
          episode.endSoc,

        maxPowerKw:
          episode.maxPowerKw,

        sampleCount:
          episode.samples.length,
      }),
    );

  return {
    recognized:
      missingRequiredHeaders.length ===
        0 &&
      knownHeaderCount >= 8,

    headerCount:
      headers.length,

    knownHeaderCount,

    unknownHeaders,

    missingKnownHeaders:
      [...missingKnownHeaders],

    missingRequiredHeaders:
      [...missingRequiredHeaders],

    rowCount:
      parsed.rowCount,

    validRows:
      parsed.validRows,

    invalidRows:
      parsed.invalidRows,

    minDateTime,
    maxDateTime,

    vehicleIds:
      [...vehicleIds],

    displayNames:
      [...displayNames],

    dateFormats:
      [...dateFormats],

    gpsRows,
    movingRows,
    chargingRows,

    driveEpisodes,
    chargeEpisodes,

    timePreview,

    capabilities,
  };
}
