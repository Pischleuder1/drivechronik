import { describe, expect, it } from "vitest";

import { buildYearlyInsights } from "./yearlyInsightsLogic";
import type {
  YearlyClassification,
  YearlyDrive,
} from "./yearlyInsightsTypes";

function drive(
  id: number,
  options: {
    date?: string;
    distance?: number | null;
    duration?: number | null;
    classification?: YearlyClassification;
    placeId?: number | null;
    placeName?: string | null;
    placeType?: "home" | "work" | "customer" | "site" | "supplier" | "hotel" | "charger" | "parking" | "other" | null;
    address?: string | null;
    lat?: number | null;
    lon?: number | null;
  } = {},
): YearlyDrive {
  const date = options.date ?? "2026-01-15";

  return {
    id,
    dateKey: date,
    monthKey: date.slice(0, 7),
    startTime: new Date(`${date}T10:00:00Z`),
    endTime: new Date(`${date}T11:00:00Z`),
    distanceKm: options.distance ?? 100,
    durationSeconds: options.duration ?? 3600,
    classification: options.classification ?? "private",
    endPlaceId: options.placeId ?? null,
    endPlaceName: options.placeName ?? null,
    endPlaceType: options.placeType ?? null,
    endAddress: options.address ?? null,
    endLat: options.lat ?? null,
    endLon: options.lon ?? null,
  };
}

describe("buildYearlyInsights", () => {
  it("returns an empty year with all twelve months", () => {
    const result = buildYearlyInsights(2026, []);

    expect(result.driveCount).toBe(0);
    expect(result.distanceKm).toBe(0);
    expect(result.durationSeconds).toBe(0);
    expect(result.months).toHaveLength(12);
    expect(result.months[0]?.monthKey).toBe("2026-01");
    expect(result.months[11]?.monthKey).toBe("2026-12");
    expect(result.longestDrive).toBeNull();
    expect(result.busiestDay).toBeNull();
    expect(result.topDestination).toBeNull();
  });

  it("calculates totals and classification buckets", () => {
    const result = buildYearlyInsights(2026, [
      drive(1, {
        distance: 100,
        duration: 3600,
        classification: "business",
      }),
      drive(2, {
        distance: 50,
        duration: 1800,
        classification: "private",
      }),
      drive(3, {
        distance: 25,
        duration: 900,
        classification: "business",
      }),
    ]);

    expect(result.driveCount).toBe(3);
    expect(result.distanceKm).toBe(175);
    expect(result.durationSeconds).toBe(6300);

    const business = result.byClassification.find(
      (row) => row.classification === "business",
    );

    expect(business?.driveCount).toBe(2);
    expect(business?.distanceKm).toBe(125);
  });

  it("builds monthly totals and finds the busiest month", () => {
    const result = buildYearlyInsights(2026, [
      drive(1, {
        date: "2026-01-10",
        distance: 100,
        classification: "business",
      }),
      drive(2, {
        date: "2026-02-10",
        distance: 120,
        classification: "private",
      }),
      drive(3, {
        date: "2026-02-11",
        distance: 80,
        classification: "commute",
      }),
    ]);

    const january = result.months.find(
      (month) => month.monthKey === "2026-01",
    );
    const february = result.months.find(
      (month) => month.monthKey === "2026-02",
    );

    expect(february?.distanceKm).toBe(200);
    expect(february?.privateDistanceKm).toBe(120);
    expect(february?.commuteDistanceKm).toBe(80);
    expect(february?.businessDistanceKm).toBe(0);
    expect(january?.businessDistanceKm).toBe(100);

    expect(result.busiestMonth?.monthKey).toBe("2026-02");
  });

  it("finds the longest drive and busiest day", () => {
    const result = buildYearlyInsights(2026, [
      drive(1, { date: "2026-03-01", distance: 80 }),
      drive(2, { date: "2026-03-02", distance: 160 }),
      drive(3, { date: "2026-03-02", distance: 60 }),
    ]);

    expect(result.longestDrive?.id).toBe(2);
    expect(result.busiestDay?.dateKey).toBe("2026-03-02");
    expect(result.busiestDay?.distanceKm).toBe(220);
  });

  it("groups repeated destinations by place id", () => {
    const result = buildYearlyInsights(2026, [
      drive(1, {
        placeId: 10,
        placeName: "Kunde A",
        distance: 50,
        lat: 52.1,
        lon: 8.7,
      }),
      drive(2, {
        placeId: 10,
        placeName: "Kunde A",
        distance: 70,
        lat: 52.1,
        lon: 8.7,
      }),
      drive(3, {
        placeId: 20,
        placeName: "Kunde B",
        distance: 200,
      }),
    ]);

    expect(result.topDestination?.label).toBe("Kunde A");
    expect(result.topDestination?.visitCount).toBe(2);
    expect(result.topDestination?.distanceKm).toBe(120);
  });

  it("uses an address when no DriveChronik place exists", () => {
    const result = buildYearlyInsights(2026, [
      drive(1, {
        address: "Musterstraße 1",
        distance: 40,
      }),
      drive(2, {
        address: "Musterstraße 1",
        distance: 50,
      }),
    ]);

    expect(result.topDestination?.label).toBe("Musterstraße 1");
    expect(result.topDestination?.visitCount).toBe(2);
  });
  it("counts destination classifications and tracks customer visits", () => {
    const result = buildYearlyInsights(2026, [
      drive(1, {
        date: "2026-02-10",
        placeId: 10,
        placeName: "Kunde A",
        placeType: "customer",
        classification: "business",
        distance: 50,
      }),
      drive(2, {
        date: "2026-03-15",
        placeId: 10,
        placeName: "Kunde A",
        placeType: "customer",
        classification: "business",
        distance: 70,
      }),
      drive(3, {
        date: "2026-04-20",
        placeId: 10,
        placeName: "Kunde A",
        placeType: "customer",
        classification: "private",
        distance: 30,
      }),
    ]);

    const destination = result.destinations[0];

    expect(destination?.label).toBe("Kunde A");
    expect(destination?.placeType).toBe("customer");
    expect(destination?.visitCount).toBe(3);
    expect(destination?.businessVisitCount).toBe(2);
    expect(destination?.privateVisitCount).toBe(1);
    expect(destination?.commuteVisitCount).toBe(0);
    expect(destination?.businessDistanceKm).toBe(120);
    expect(destination?.privateDistanceKm).toBe(30);
    expect(destination?.commuteDistanceKm).toBe(0);
    expect(destination?.lastVisitDateKey).toBe("2026-04-20");
  });

  it("keeps all destinations while limiting the ranking to ten", () => {
    const drives = Array.from({ length: 12 }, (_, index) =>
      drive(index + 1, {
        placeId: index + 1,
        placeName: `Ziel ${index + 1}`,
        distance: 20 + index,
        lat: 52 + index * 0.01,
        lon: 8 + index * 0.01,
      }),
    );

    const result = buildYearlyInsights(2026, drives);

    expect(result.destinations).toHaveLength(12);
    expect(result.topDestinations).toHaveLength(10);
  });

});
