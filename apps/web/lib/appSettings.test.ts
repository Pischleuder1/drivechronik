import { describe, expect, it } from "vitest";

import { parseBusinessReimbursementRate } from "./appSettingsLogic";

describe("business reimbursement setting", () => {
  it("accepts a valid reimbursement rate", () => {
    expect(parseBusinessReimbursementRate(0.3)).toBe(0.3);
    expect(parseBusinessReimbursementRate(0.35)).toBe(0.35);
  });

  it("accepts zero", () => {
    expect(parseBusinessReimbursementRate(0)).toBe(0);
  });

  it("rejects invalid values", () => {
    expect(parseBusinessReimbursementRate(-0.1)).toBeNull();
    expect(parseBusinessReimbursementRate(10.01)).toBeNull();
    expect(parseBusinessReimbursementRate("0.30")).toBeNull();
    expect(parseBusinessReimbursementRate(null)).toBeNull();
  });
});
