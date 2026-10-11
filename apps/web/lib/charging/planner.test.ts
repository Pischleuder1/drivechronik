import { describe, expect, it } from "vitest";
import { selectChargingStop } from "./planner";
import type { ChargingSite } from "./types";

const site: ChargingSite = {
  id: "nah",
  name: "Test-Schnelllader",
  lat: 52.018,
  lon: 8,
  network: "enbw",
  powerKw: 150,
  stalls: 4,
  openToAllEvs: true,
  pricePerKwhEur: null,
  priceSource: null,
  priceUpdatedAt: null,
  source: "test",
};

const geometry: [number, number][] = [
  [52, 8],
  [52.018, 8],
  [52.09, 8],
  [52.18, 8],
];

const input = {
  startSoc: 3,
  capacityKwh: 62,
  routeDistanceKm: 20,
  energyKwh: 2.9,
  targetArrivalSoc: 20,
  minimumStopArrivalSoc: 10,
};

describe("Ladeplanung bei 3 % Start-SoC", () => {
  it("akzeptiert einen geprüften Schnelllader", () => {
    const result = selectChargingStop([site], geometry, {
      ...input,
      allowedFirstStopIds: ["enbw:nah"],
    });

    expect(result.planningComplete).toBe(true);
    expect(result.stops).toHaveLength(1);
    expect(result.stops[0]?.site.id).toBe("nah");
    expect(result.stops[0]?.arrivalSoc).toBeGreaterThan(0);
  });

  it("verwirft einen ungeprüften Schnelllader", () => {
    const result = selectChargingStop([site], geometry, {
      ...input,
      allowedFirstStopIds: [],
    });

    expect(result.planningComplete).toBe(false);
    expect(result.stops).toHaveLength(0);
  });
});

describe("Weitere Ladeplanungsfälle", () => {
  it("unterscheidet gleiche IDs verschiedener Ladenetze", () => {
    const result = selectChargingStop([site], geometry, {
      ...input,
      allowedFirstStopIds: ["tesla:nah"],
    });

    expect(result.stops).toHaveLength(0);
    expect(result.planningComplete).toBe(false);
  });

  it("benötigt bei 50 % Start-SoC keinen Ladestopp", () => {
    const result = selectChargingStop([], geometry, {
      ...input,
      startSoc: 50,
    });

    expect(result.planningComplete).toBe(true);
    expect(result.stops).toHaveLength(0);
  });
});

describe("Mehrstopp-Planung nach festem Erststopp", () => {
  it("berücksichtigt den bereits gefahrenen Streckenabschnitt", () => {
    const result = selectChargingStop([site], geometry, {
      startSoc: 80,
      capacityKwh: 62,
      routeDistanceKm: 20,
      energyKwh: 65,
      targetArrivalSoc: 20,
      minimumStopArrivalSoc: 10,
      initialRouteDistanceKm: 3,
    });

    expect(result.stops).toHaveLength(0);
    expect(result.planningComplete).toBe(false);
  });
});

describe("Lange Weiterfahrt nach dem ersten Schnelllader", () => {
  it("plant weitere Ladestopps ab 80 Prozent", () => {
    const route: [number, number][] = [
      [52.0, 8], [52.5, 8], [53.0, 8],
      [53.5, 8], [54.0, 8],
    ];
    const sites = [0.5, 1.0, 1.5].map((offset, index) => ({
      ...site,
      id: `hpc-${index}`,
      lat: 52 + offset,
    }));

    const result = selectChargingStop(sites, route, {
      startSoc: 80,
      capacityKwh: 62,
      routeDistanceKm: 400,
      energyKwh: 70,
      targetArrivalSoc: 20,
      minimumStopArrivalSoc: 10,
      initialRouteDistanceKm: 0.85,
    });

    expect(result.planningComplete).toBe(true);
    expect(result.stops.length).toBeGreaterThan(0);
    expect(result.stops[0]!.routeDistanceKm).toBeGreaterThan(0.85);
    expect(result.plannedArrivalSoc!).toBeGreaterThanOrEqual(19.99);
  });
});
