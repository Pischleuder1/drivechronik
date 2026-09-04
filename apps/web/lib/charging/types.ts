export type ChargingNetwork =
  | "tesla"
  | "ionity"
  | "enbw"
  | "fastned"
  | "other";

export interface ChargingSite {
  /** Eindeutige ID innerhalb des Providers. */
  id: string;

  /** Anzeigename, z. B. "Tesla Supercharger Bispingen". */
  name: string;

  lat: number;
  lon: number;

  network: ChargingNetwork;

  /** Maximale bekannte Ladeleistung in kW. */
  powerKw: number | null;

  /** Anzahl Ladepunkte/Stalls, sofern bekannt. */
  stalls: number | null;

  /** Für Fremdmarken geöffnet, sofern bekannt. */
  openToAllEvs: boolean | null;

  /** Aktueller Preis, nur wenn belastbar vorhanden. */
  pricePerKwhEur: number | null;

  /** Herkunft des Preises. */
  priceSource: string | null;

  /** Zeitpunkt/Stand der Preisinformation. */
  priceUpdatedAt: string | null;

  /** Datenquelle der Station. */
  source: string;
}

export interface ChargingSearchOptions {
  /** Suchkorridor um die Route in km. */
  corridorKm?: number;

  /** Mindestleistung eines Ladepunkts. */
  minPowerKw?: number;
}

export interface ChargingSiteProvider {
  readonly id: string;

  findAlongRoute(
    geometry: [number, number][],
    options?: ChargingSearchOptions,
  ): Promise<ChargingSite[]>;
}

export type ChargingPreference =
  | "tesla-only"
  | "tesla-preferred"
  | "all-fast-chargers";

export interface PlannedChargingStop {
  site: ChargingSite;

  /** Entfernung vom Start entlang der geplanten Route. */
  routeDistanceKm: number;

  /** Prognostizierter SoC bei Ankunft. */
  arrivalSoc: number;

  /** Empfohlener SoC beim Weiterfahren. */
  departureSoc: number;

  /** Nachzuladende Energie. */
  energyAddedKwh: number;

  /** Geschätzte Ladezeit. */
  chargingMinutes: number;

  /** Geschätzte Ladekosten, wenn ein Preis vorhanden ist. */
  estimatedCostEur: number | null;
}
