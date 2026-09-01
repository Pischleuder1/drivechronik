import { describe, expect, it } from "vitest";

import { workerHealthMaxAgeMs } from "./health.js";

describe("workerHealthMaxAgeMs", () => {
  it("uses at least five minutes tolerance", () => {
    expect(workerHealthMaxAgeMs(60)).toBe(5 * 60 * 1000);
  });

  it("scales with longer sync intervals", () => {
    expect(workerHealthMaxAgeMs(300)).toBe(
      (300 * 3 + 60) * 1000,
    );
  });

  it("keeps the five minute minimum for short intervals", () => {
    expect(workerHealthMaxAgeMs(30)).toBe(5 * 60 * 1000);
  });
});
