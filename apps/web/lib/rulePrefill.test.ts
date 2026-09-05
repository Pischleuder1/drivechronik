import { describe, expect, it } from "vitest";

import { buildRulePrefill } from "./rulePrefill";

describe("buildRulePrefill", () => {
  it("prefills a business rule for a known customer place", () => {
    const result = buildRulePrefill(
      {
        name: "Kunde Müller automatisch",
        endPlaceId: "42",
        classification: "business",
        customer: "Kunde Müller",
      },
      [10, 42, 99],
    );

    expect(result).toEqual({
      name: "Kunde Müller automatisch",
      priority: 0,
      enabled: true,
      startPlaceId: null,
      endPlaceId: 42,
      weekdays: null,
      startMinuteFrom: null,
      startMinuteTo: null,
      classification: "business",
      tagId: null,
      purpose: null,
      customer: "Kunde Müller",
      project: null,
    });
  });

  it("rejects unknown places and invalid classifications", () => {
    const result = buildRulePrefill(
      {
        startPlaceId: "999",
        endPlaceId: "-1",
        classification: "unclassified",
      },
      [1, 2, 3],
    );

    expect(result.startPlaceId).toBeNull();
    expect(result.endPlaceId).toBeNull();
    expect(result.classification).toBeNull();
  });

  it("handles array params and limits free text safely", () => {
    const result = buildRulePrefill(
      {
        endPlaceId: ["7", "8"],
        classification: ["commute", "business"],
        name: "x".repeat(250),
        customer: "  Beispielkunde  ",
      },
      [7, 8],
    );

    expect(result.endPlaceId).toBe(7);
    expect(result.classification).toBe("commute");
    expect(result.name).toHaveLength(200);
    expect(result.customer).toBe("Beispielkunde");
  });
});
