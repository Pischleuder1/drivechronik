export type TrafficEventType = "warning" | "roadwork" | "closure";

export interface TrafficEvent {
  id: string;
  type: TrafficEventType;

  motorway: string;

  title: string;
  subtitle: string | null;
  description: string[];

  lat: number;
  lon: number;

  /**
   * Entfernung des Ereignisses vom Startpunkt entlang der geplanten Route.
   */
  routeDistanceKm: number;

  /**
   * Kleinster Abstand zwischen Ereignis und geplanter Route.
   */
  distanceToRouteKm: number;

  future: boolean;
  blocked: boolean;

  displayType: string | null;
  startTimestamp: string | null;

  /**
   * Autobahn-API liefert GeoJSON in [lon, lat].
   */
  geometry: [number, number][];
}

export interface FindTrafficEventsOptions {
  /**
   * Maximaler Abstand eines Ereignisses zur Route.
   */
  corridorKm?: number;

  /**
   * Künftige, noch nicht aktive Ereignisse ebenfalls berücksichtigen.
   * Standard: false.
   */
  includeFuture?: boolean;
}
