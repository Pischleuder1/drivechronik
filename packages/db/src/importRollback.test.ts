import {
  describe,
  expect,
  it,
} from "vitest";

import {
  canRollbackInsert,
  importJsonEqual,
  planUpdateRollback,
  toImportJson,
} from "./importRollback.js";

describe("import rollback helpers", () => {
  it("normalizes dates deterministically", () => {
    expect(
      toImportJson({
        when: new Date(
          "2026-09-12T10:00:00.000Z",
        ),
        value: 42,
      }),
    ).toEqual({
      value: 42,
      when: "2026-09-12T10:00:00.000Z",
    });
  });

  it("compares objects independent of key order", () => {
    expect(
      importJsonEqual(
        { b: 2, a: 1 },
        { a: 1, b: 2 },
      ),
    ).toBe(true);
  });

  it("plans a safe update rollback", () => {
    const result = planUpdateRollback(
      {
        cost: "4.00",
        notes: null,
      },
      {
        cost: "5.00",
        notes: "TRONITY",
      },
      {
        cost: "5.00",
        notes: "manuell geändert",
      },
    );

    expect(result.restore).toEqual({
      cost: "4.00",
    });

    expect(
      result.alreadyRestored,
    ).toEqual([]);

    expect(result.conflicts).toEqual([
      "notes",
    ]);
  });

  it("recognizes fields that are already restored", () => {
    const result = planUpdateRollback(
      {
        cost: "4.00",
        notes: null,
      },
      {
        cost: "5.00",
        notes: "TRONITY",
      },
      {
        cost: "4.00",
        notes: "TRONITY",
      },
    );

    expect(result.restore).toEqual({
      notes: null,
    });

    expect(
      result.alreadyRestored,
    ).toEqual([
      "cost",
    ]);

    expect(result.conflicts).toEqual([]);
  });

  it("allows deleting an unchanged imported row", () => {
    expect(
      canRollbackInsert(
        {
          source: "tronity",
          cost: "5.00",
        },
        {
          id: 17,
          source: "tronity",
          cost: "5.00",
        },
      ),
    ).toBe(true);
  });

  it("protects a subsequently modified imported row", () => {
    expect(
      canRollbackInsert(
        {
          source: "tronity",
          cost: "5.00",
        },
        {
          id: 17,
          source: "tronity",
          cost: "7.00",
        },
      ),
    ).toBe(false);
  });
});
