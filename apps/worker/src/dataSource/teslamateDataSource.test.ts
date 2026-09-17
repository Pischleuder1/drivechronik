import { describe, expect, it, vi } from "vitest";

vi.mock("../teslamate/client.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../teslamate/client.js")>();

  return {
    ...actual,
    probeTeslamateSchema: vi.fn(async () => undefined),
  };
});

import {
  probeTeslamateSchema,
  type TeslamateSql,
} from "../teslamate/client.js";
import { TeslaMateDataSource } from "./teslamateDataSource.js";

function makeSql(rows: { id: number }[] = []) {
  const fn = vi.fn(async (..._args: unknown[]) => rows);

  return {
    sql: fn as unknown as TeslamateSql,
    fn,
  };
}

describe("TeslaMateDataSource", () => {
  it("identifies itself as teslamate", () => {
    const { sql } = makeSql();
    const dataSource = new TeslaMateDataSource(sql);

    expect(dataSource.source).toBe("teslamate");
  });

  it("does not query TeslaMate for an empty drive id list", async () => {
    const { sql, fn } = makeSql();
    const dataSource = new TeslaMateDataSource(sql);

    await expect(dataSource.fetchExistingDriveIds([])).resolves.toEqual([]);

    expect(fn).not.toHaveBeenCalled();
  });

  it("returns existing TeslaMate drive ids", async () => {
    const { sql, fn } = makeSql([{ id: 12 }, { id: 34 }]);
    const dataSource = new TeslaMateDataSource(sql);

    await expect(
      dataSource.fetchExistingDriveIds([12, 34, 56]),
    ).resolves.toEqual([12, 34]);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0]?.[1]).toEqual([12, 34, 56]);
  });

  it("delegates schema probing to the TeslaMate client", async () => {
    const { sql } = makeSql();
    const dataSource = new TeslaMateDataSource(sql);

    await expect(dataSource.probe()).resolves.toBeUndefined();

    expect(probeTeslamateSchema).toHaveBeenCalledWith(sql);
  });
});
