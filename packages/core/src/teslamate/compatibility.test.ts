import { describe, expect, it } from "vitest";

import {
  findMissingTeslaMateColumns,
  REQUIRED_TESLAMATE_SCHEMA,
  type TeslaMateSchemaColumn,
} from "./compatibility.js";

function completeSchema(): TeslaMateSchemaColumn[] {
  return Object.entries(REQUIRED_TESLAMATE_SCHEMA).flatMap(
    ([tableName, columns]) =>
      columns.map((columnName) => ({
        tableName,
        columnName,
      })),
  );
}

describe("findMissingTeslaMateColumns", () => {
  it("accepts a complete TeslaMate schema", () => {
    expect(findMissingTeslaMateColumns(completeSchema())).toEqual([]);
  });

  it("reports missing required columns", () => {
    const columns = completeSchema().filter(
      ({ tableName, columnName }) =>
        !(tableName === "states" && columnName === "state") &&
        !(
          tableName === "positions" &&
          columnName === "rated_battery_range_km"
        ),
    );

    expect(findMissingTeslaMateColumns(columns)).toEqual(
      expect.arrayContaining([
        "states.state",
        "positions.rated_battery_range_km",
      ]),
    );
  });

  it("ignores additional TeslaMate columns", () => {
    const columns = [
      ...completeSchema(),
      {
        tableName: "cars",
        columnName: "future_teslamate_column",
      },
      {
        tableName: "future_table",
        columnName: "some_column",
      },
    ];

    expect(findMissingTeslaMateColumns(columns)).toEqual([]);
  });
});
