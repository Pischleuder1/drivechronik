import "server-only";

import { Readable } from "node:stream";
import { parse } from "csv-parse";

import type {
  ChargingNetwork,
  ChargingSearchOptions,
  ChargingSite,
  ChargingSiteProvider,
} from "./types";

const DOWNLOAD_PAGE =
  "https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/Ladesaeulenkarte/start.html";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 30_000;

interface CacheEntry {
  loadedAt: number;
  sites: ChargingSite[];
}

let cache: CacheEntry | null = null;
let loadingPromise: Promise<ChargingSite[]> | null = null;

function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const radiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function germanNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function networkFromOperator(operator: string): ChargingNetwork {
  const normalized = operator.toLowerCase();

  if (normalized.includes("ionity")) return "ionity";
  if (normalized.includes("enbw")) return "enbw";
  if (normalized.includes("fastned")) return "fastned";

  return "other";
}

function isTeslaOperator(operator: string): boolean {
  return operator.toLowerCase().includes("tesla");
}

function maximumCcsPowerKw(
  row: Record<string, string>,
): number | null {
  let maximum: number | null = null;

  for (const [key, rawPower] of Object.entries(row)) {
    const match = /^Nennleistung Stecker(\d+)$/i.exec(key.trim());
    if (!match) continue;

    const index = match[1]!;
    const connector = row[`Steckertypen${index}`] ?? "";

    // BNetzA bezeichnet CCS unter anderem als "DC Kupplung Combo".
    if (!/combo|ccs/i.test(connector)) continue;

    const powerKw = germanNumber(rawPower);
    if (powerKw == null) continue;

    if (maximum == null || powerKw > maximum) {
      maximum = powerKw;
    }
  }

  return maximum;
}

function distanceToRouteKm(
  site: ChargingSite,
  geometry: [number, number][],
): number {
  let best = Number.POSITIVE_INFINITY;

  for (const [lat, lon] of geometry) {
    const distanceKm = haversineKm(
      site.lat,
      site.lon,
      lat,
      lon,
    );

    if (distanceKm < best) best = distanceKm;
  }

  return best;
}

function siteIsInsideBoundingBox(
  site: ChargingSite,
  geometry: [number, number][],
  corridorKm: number,
): boolean {
  const latitudes = geometry.map(([lat]) => lat);
  const longitudes = geometry.map(([, lon]) => lon);

  const middleLat =
    (Math.min(...latitudes) + Math.max(...latitudes)) / 2;

  const latMargin = corridorKm / 111;
  const lonFactor = Math.max(
    0.2,
    Math.cos((middleLat * Math.PI) / 180),
  );
  const lonMargin = corridorKm / (111 * lonFactor);

  return (
    site.lat >= Math.min(...latitudes) - latMargin &&
    site.lat <= Math.max(...latitudes) + latMargin &&
    site.lon >= Math.min(...longitudes) - lonMargin &&
    site.lon <= Math.max(...longitudes) + lonMargin
  );
}

async function discoverCsvUrl(): Promise<string> {
  const response = await fetch(DOWNLOAD_PAGE, {
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: {
      "user-agent": "DriveChronik/0.3",
    },
  });

  if (!response.ok) {
    throw new Error(
      `BNetzA-Downloadseite antwortete mit HTTP ${response.status}`,
    );
  }

  const html = await response.text();

  const match = html.match(
    /href=["']([^"']*Ladesaeulenregister_BNetzA_[^"']*\.csv)["']/i,
  );

  if (!match?.[1]) {
    throw new Error(
      "CSV-Link des BNetzA-Ladesäulenregisters nicht gefunden",
    );
  }

  return new URL(
    match[1].replaceAll("&amp;", "&"),
    DOWNLOAD_PAGE,
  ).toString();
}

async function loadSites(): Promise<ChargingSite[]> {
  const csvUrl = await discoverCsvUrl();

  const response = await fetch(csvUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: {
      "user-agent": "DriveChronik/0.3",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `BNetzA-CSV antwortete mit HTTP ${response.status}`,
    );
  }

  const parser = parse({
    columns: true,
    from_line: 11,
    delimiter: ";",
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  const source = Readable.fromWeb(
    response.body as Parameters<typeof Readable.fromWeb>[0],
  );

  // Ein Abbruch/Timeout des Fetch-Body tritt als Fehler des Source-Streams auf.
  // pipe() reicht diesen Fehler nicht automatisch an den CSV-Parser weiter.
  // Durch destroy(error) wird daraus eine normale Promise-Ablehnung, die
  // cachedSites() fehlertolerant abfangen kann.
  source.on("error", (error) => {
    parser.destroy(error);
  });

  source.pipe(parser);

  const byLocation = new Map<string, ChargingSite>();

  for await (const value of parser) {
    const row = value as Record<string, string>;

    const operator = row.Betreiber?.trim() ?? "";
    const status = row.Status?.trim() ?? "";
    const lat = germanNumber(row.Breitengrad);
    const lon = germanNumber(row.Längengrad);
    const powerKw = maximumCcsPowerKw(row);

    if (
      status !== "In Betrieb" ||
      operator === "" ||
      lat == null ||
      lon == null ||
      powerKw == null ||
      powerKw < 150 ||
      isTeslaOperator(operator)
    ) {
      continue;
    }

    const network = networkFromOperator(operator);

    const locationKey = [
      operator.toLowerCase(),
      lat.toFixed(5),
      lon.toFixed(5),
    ].join(":");

    const existing = byLocation.get(locationKey);

    if (existing) {
      existing.powerKw = Math.max(
        existing.powerKw ?? 0,
        powerKw,
      );

      const additionalStalls = Number.parseInt(
        row["Anzahl Ladepunkte"] ?? "",
        10,
      );

      if (Number.isFinite(additionalStalls)) {
        existing.stalls =
          (existing.stalls ?? 0) + additionalStalls;
      }

      continue;
    }

    const stalls = Number.parseInt(
      row["Anzahl Ladepunkte"] ?? "",
      10,
    );

    const street = row["Straße"]?.trim() ?? "";
    const houseNumber = row.Hausnummer?.trim() ?? "";
    const city = row.Ort?.trim() ?? "";

    const address = [street, houseNumber, city]
      .filter(Boolean)
      .join(" ");

    byLocation.set(locationKey, {
      id: `bnetza-${lat.toFixed(5)}-${lon.toFixed(5)}-${network}`,
      name:
        address !== ""
          ? `${operator} – ${address}`
          : operator,
      lat,
      lon,
      network,
      powerKw,
      stalls: Number.isFinite(stalls) ? stalls : null,
      openToAllEvs: true,
      pricePerKwhEur: null,
      priceSource: null,
      priceUpdatedAt: null,
      source: "bundesnetzagentur.de",
    });
  }

  return [...byLocation.values()];
}

async function cachedSites(): Promise<ChargingSite[]> {
  if (
    cache &&
    Date.now() - cache.loadedAt < CACHE_TTL_MS
  ) {
    return cache.sites;
  }

  // Läuft bereits ein Refresh, blockieren wir den Planner nicht.
  // Falls vorhanden, verwenden wir den bisherigen Cache, ansonsten [].
  if (loadingPromise) {
    return cache?.sites ?? [];
  }

  // Cache im Hintergrund auffrischen. Die aktuelle Routenplanung wartet
  // bewusst nicht auf den Download des vollständigen BNetzA-Registers.
  loadingPromise = loadSites()
    .then((sites) => {
      cache = {
        loadedAt: Date.now(),
        sites,
      };
      return sites;
    })
    .catch((error) => {
      console.warn("[charging] bundesnetzagentur refresh failed:", error);
      return cache?.sites ?? [];
    })
    .finally(() => {
      loadingPromise = null;
    });

  return cache?.sites ?? [];
}

export class BundesnetzagenturProvider
  implements ChargingSiteProvider
{
  readonly id = "bundesnetzagentur";

  async findAlongRoute(
    geometry: [number, number][],
    options: ChargingSearchOptions = {},
  ): Promise<ChargingSite[]> {
    if (geometry.length < 2) return [];

    const corridorKm = options.corridorKm ?? 15;
    const minimumPowerKw = options.minPowerKw ?? 150;

    const sites = await cachedSites();

    return sites.filter((site) => {
      if (
        site.powerKw == null ||
        site.powerKw < minimumPowerKw
      ) {
        return false;
      }

      if (
        !siteIsInsideBoundingBox(
          site,
          geometry,
          corridorKm,
        )
      ) {
        return false;
      }

      return (
        distanceToRouteKm(site, geometry) <= corridorKm
      );
    });
  }
}

export function getBundesnetzagenturProvider():
  BundesnetzagenturProvider {
  return new BundesnetzagenturProvider();
}
