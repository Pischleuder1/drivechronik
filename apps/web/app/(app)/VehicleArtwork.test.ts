import { describe, expect, it } from "vitest";
import {
  resolveVehicleArtworkVariant,
  resolveVehicleImage,
  vehicleModelYearFromVin,
} from "./VehicleArtwork";

// Synthetische VINs für die Prüfung von Modell- und Jahrescodes.
// Keine echten Fahrzeugidentifikationsnummern.
function vin(model: "3" | "Y", yearCode: string): string {
  return `5YJ${model}AAAAA${yearCode}AAAAAAA`;
}

function image(
  model: "3" | "Y",
  yearCode: string,
  trimBadging: string | null = null,
  variantOverride: string | null = null,
) {
  return resolveVehicleImage({
    vin: vin(model, yearCode),
    model,
    trimBadging,
    variantOverride,
  });
}

describe("VIN-Fahrzeugerkennung", () => {
  it("erkennt das Modelljahr 2026", () => {
    expect(vehicleModelYearFromVin(vin("Y", "T"))).toBe(2026);
  });

  it("ordnet Model 3 von 2023 Classic zu", () => {
    expect(resolveVehicleArtworkVariant({
      vin: vin("3", "P"),
      model: "Model 3",
    })).toBe("model-3-classic");

    expect(image("3", "P")).toContain("model3-classic-white.webp");
  });

  it("ordnet Model 3 von 2026 Highland zu", () => {
    expect(image("3", "T")).toContain("model3-highland-white.webp");
  });

  it("ordnet Model Y von 2023 Classic zu", () => {
    expect(image("Y", "P")).toContain("modely-classic-white.webp");
  });

  it("erkennt die Juniper-Generation 2026", () => {
    expect(resolveVehicleArtworkVariant({
      vin: vin("Y", "T"),
      model: "Model Y",
    })).toBe("model-y-juniper");
  });

  it("verwendet die manuelle Standard-Auswahl", () => {
    expect(
      image("Y", "T", "RWD", "model-y-juniper-standard"),
    ).toContain("modely-juniper-standard-white.webp");
  });

  it("verwendet die manuelle Premium-Auswahl", () => {
    expect(
      image("Y", "T", "RWD", "model-y-juniper-premium"),
    ).toContain("modely-juniper-premium-white.webp");
  });

  it("interpretiert RWD nicht automatisch als Premium", () => {
    expect(image("Y", "T", "RWD")).toBeNull();
  });

  it("übernimmt eindeutige TeslaMate-Ausstattungsangaben", () => {
    expect(image("Y", "T", "Standard")).toContain(
      "modely-juniper-standard-white.webp",
    );

    expect(image("Y", "T", "Premium")).toContain(
      "modely-juniper-premium-white.webp",
    );
  });

  it("ignoriert Juniper-Overrides bei älteren Fahrzeugen", () => {
    expect(
      image("Y", "P", "RWD", "model-y-juniper-standard"),
    ).toContain("modely-classic-white.webp");
  });

  it("vermeidet Zuordnungen bei unbekanntem Modelljahr", () => {
    expect(image("Y", "S")).toBeNull();
  });

  it("weist ungültige VINs zurück", () => {
    expect(vehicleModelYearFromVin("INVALID")).toBeNull();
  });
});

describe("Fahrzeug-Farbmatrix", () => {
  const variants = [
    { name: "model3-classic", vin: vin("3", "P"), model: "3", override: null },
    { name: "model3-highland", vin: vin("3", "T"), model: "3", override: null },
    { name: "modely-classic", vin: vin("Y", "P"), model: "Y", override: null },
    {
      name: "modely-juniper-standard",
      vin: vin("Y", "T"),
      model: "Y",
      override: "model-y-juniper-standard",
    },
    {
      name: "modely-juniper-premium",
      vin: vin("Y", "T"),
      model: "Y",
      override: "model-y-juniper-premium",
    },
  ] as const;

  const colors = [
    ["white", "white"],
    ["black", "black"],
    ["grey", "grey"],
    ["stealth_grey", "stealth-grey"],
    ["blue", "blue"],
    ["red", "red"],
    ["silver", "silver"],
  ] as const;

  for (const variant of variants) {
    for (const [color, filenameColor] of colors) {
      it(`${variant.name} in ${color}`, () => {
        expect(resolveVehicleImage({
          vin: variant.vin,
          model: variant.model,
          trimBadging: "RWD",
          variantOverride: variant.override,
          exteriorColor: color,
        })).toBe(
          `/vehicles/variants/${variant.name}-${filenameColor}.webp`
        );
      });
    }
  }

  it("verwendet Weiß bei unbekannter Farbe", () => {
    expect(resolveVehicleImage({
      vin: vin("3", "T"),
      model: "3",
      trimBadging: "RWD",
      variantOverride: null,
      exteriorColor: "other",
    })).toBe("/vehicles/variants/model3-highland-white.webp");
  });

  it("zeigt kein falsches Juniper-Bild bei RWD ohne Variantenangabe", () => {
    expect(resolveVehicleImage({
      vin: vin("Y", "T"),
      model: "Y",
      trimBadging: "RWD",
      variantOverride: null,
      exteriorColor: "red",
    })).toBeNull();
  });
});
