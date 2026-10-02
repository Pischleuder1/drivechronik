import { describe, expect, it } from "vitest";

import { extractMotorwayRefsFromOsrmBody } from "./recordedDriveTrafficCore";

describe("recorded drive traffic", () => {
  it("extracts and normalizes German Autobahn refs from OSRM steps", () => {
    const body = {
      code: "Ok",
      routes: [
        {
          legs: [
            {
              steps: [
                { ref: "B239" },
                { ref: "A 2" },
                { ref: "A30 / E30" },
                { ref: "A 30" },
                { ref: "A2" },
                { ref: "B61 / A 33" },
              ],
            },
          ],
        },
      ],
    };

    expect(extractMotorwayRefsFromOsrmBody(body)).toEqual([
      "A2",
      "A30",
      "A33",
    ]);
  });

  it("returns an empty list for malformed OSRM responses", () => {
    expect(extractMotorwayRefsFromOsrmBody(null)).toEqual([]);
    expect(extractMotorwayRefsFromOsrmBody({})).toEqual([]);
    expect(
      extractMotorwayRefsFromOsrmBody({
        code: "NoRoute",
        routes: [],
      }),
    ).toEqual([]);
  });

  it("ignores non-Autobahn references", () => {
    const body = {
      code: "Ok",
      routes: [
        {
          legs: [
            {
              steps: [
                { ref: "B65" },
                { ref: "L876" },
                { ref: "E30" },
              ],
            },
          ],
        },
      ],
    };

    expect(extractMotorwayRefsFromOsrmBody(body)).toEqual([]);
  });
});
