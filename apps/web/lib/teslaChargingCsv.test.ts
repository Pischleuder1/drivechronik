import { describe, expect, it } from "vitest";

import { parseTeslaChargingCsv } from "./teslaChargingCsv";

const HEADER =
  "ChargeStartDateTime,Name,Vin,Model,Country,SiteLocationName,Description,QuantityBase,QuantityTier1,QuantityTier2,QuantityTier3,QuantityTier4,InvoiceNumber,UnitCostBase,UnitCostTier1,UnitCostTier2,UnitCostTier3,UnitCostTier4,VAT,Total Exc. VAT,Total Inc. VAT,Status,Invoice";

describe("parseTeslaChargingCsv", () => {
  it("parses a normal kWh based Tesla charging row", () => {
    const csv = [
      HEADER,
      '2026-08-20T14:25:10+02:00,Max,TESTVIN1234567890,MY,DE,"Hannover, Germany",CHARGING,45.22 kWh,N/A,N/A,N/A,N/A,INV-123,0.42/kWh,N/A,N/A,N/A,N/A,3.02,15.92,18.94,PAID,https://example.invalid/invoice',
    ].join("\n");

    const rows = parseTeslaChargingCsv(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.vin).toBe("TESTVIN1234567890");
    expect(rows[0]!.energyKwh).toBeCloseTo(45.22);
    expect(rows[0]!.totalIncVat).toBeCloseTo(18.94);
    expect(rows[0]!.currency).toBe("EUR");
    expect(rows[0]!.invoiceNumber).toBe("INV-123");
  });

  it("accepts time based Tesla charging rows without kWh", () => {
    const csv = [
      HEADER,
      '2024-12-17T05:54:10+01:00,Max,TESTVIN1234567890,MY,AT,"Innsbruck, Austria",CHARGING : NO_CHARGE,N/A,14.00 min,14.00 min,18.00 min,N/A,N/A,0.31/min,0.63/min,0.98/min,1.65/min,N/A,0.00,0.00,0.00,PAID,',
    ].join("\n");

    const rows = parseTeslaChargingCsv(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.energyKwh).toBeNull();
    expect(rows[0]!.totalIncVat).toBe(0);
    expect(rows[0]!.currency).toBe("EUR");
  });

  it("rejects an unrelated CSV", () => {
    expect(() =>
      parseTeslaChargingCsv("foo,bar\n1,2\n"),
    ).toThrow(/Tesla-CSV nicht erkannt/);
  });
});
