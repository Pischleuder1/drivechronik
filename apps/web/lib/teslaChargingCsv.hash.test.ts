import { describe, expect, it } from "vitest";

import { parseTeslaChargingCsv } from "./teslaChargingCsv";

const header =
  "ChargeStartDateTime,Vin,SiteLocationName,Description,QuantityBase," +
  "QuantityTier1,QuantityTier2,QuantityTier3,QuantityTier4," +
  "InvoiceNumber,VAT,Total Exc. VAT,Total Inc. VAT,Status,Invoice";

describe("Tesla charging CSV identity", () => {
  it("keeps the same source hash when invoice, amount or status changes", () => {
    const pending = parseTeslaChargingCsv(
      [
        header,
        "2026-08-15T11:38:00+02:00,5YJ3E7EA1PF000001,Raststätte Neuhaus,CHARGING,19.87 kWh,N/A,N/A,N/A,N/A,,0.00,0.00,0.00,PENDING,",
      ].join("\n"),
    )[0]!;

    const paid = parseTeslaChargingCsv(
      [
        header,
        "2026-08-15T11:38:00+02:00,5YJ3E7EA1PF000001,Raststätte Neuhaus,CHARGING,19.87 kWh,N/A,N/A,N/A,N/A,DEMO-2026-0001,1.43,7.51,8.94,PAID,",
      ].join("\n"),
    )[0]!;

    expect(paid.sourceHash).toBe(pending.sourceHash);
    expect(paid.invoiceNumber).toBe("DEMO-2026-0001");
    expect(paid.totalIncVat).toBe(8.94);
    expect(paid.status).toBe("PAID");
  });

  it("changes the source hash for a different charging event", () => {
    const first = parseTeslaChargingCsv(
      [
        header,
        "2026-08-15T11:38:00+02:00,5YJ3E7EA1PF000001,Raststätte Neuhaus,CHARGING,19.87 kWh,N/A,N/A,N/A,N/A,INV-1,1.43,7.51,8.94,PAID,",
      ].join("\n"),
    )[0]!;

    const second = parseTeslaChargingCsv(
      [
        header,
        "2026-08-16T11:38:00+02:00,5YJ3E7EA1PF000001,Raststätte Neuhaus,CHARGING,19.87 kWh,N/A,N/A,N/A,N/A,INV-2,1.43,7.51,8.94,PAID,",
      ].join("\n"),
    )[0]!;

    expect(second.sourceHash).not.toBe(first.sourceHash);
  });
});
