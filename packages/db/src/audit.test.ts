import { describe, expect, it } from "vitest";

import { canonicalJson, sha256, verifyAuditChain } from "./audit.js";

describe("audit hashing", () => {
  it("canonicalizes object keys deterministically", () => {
    const a = canonicalJson({
      entityId: 42,
      field: "purpose",
      metadata: { z: 2, a: 1 },
    });

    const b = canonicalJson({
      metadata: { a: 1, z: 2 },
      field: "purpose",
      entityId: 42,
    });

    expect(a).toBe(b);
  });

  it("produces stable SHA-256 hashes", () => {
    const payload = canonicalJson({
      version: 1,
      entityType: "drive",
      entityId: 42,
      field: "classification",
      oldValue: "private",
      newValue: "business",
    });

    expect(sha256(payload)).toBe(sha256(payload));
    expect(sha256(payload)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the hash when audit content changes", () => {
    const before = sha256(
      canonicalJson({
        entityId: 42,
        field: "classification",
        newValue: "private",
      }),
    );

    const after = sha256(
      canonicalJson({
        entityId: 42,
        field: "classification",
        newValue: "business",
      }),
    );

    expect(after).not.toBe(before);
  });

  it("rejects unsupported audit JSON values", () => {
    expect(() => canonicalJson(undefined)).toThrow();
    expect(() => canonicalJson(BigInt(1))).toThrow();
    expect(() => canonicalJson(Number.NaN)).toThrow();
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => canonicalJson(new Date())).toThrow();
  });


  it("verifies a valid audit chain", () => {
    const changedAt = new Date("2026-09-05T04:00:00.000Z");

    const firstPayload = {
      version: 1,
      eventId: "event-1",
      entityType: "drive",
      entityId: 1,
      field: "classification",
      oldValue: "private",
      newValue: "business",
      changedAt: changedAt.toISOString(),
      changedBy: "tester",
      eventType: "change",
      previousHash: null,
      metadata: null,
    };

    const firstHash = sha256(canonicalJson(firstPayload));

    const secondPayload = {
      version: 1,
      eventId: "event-2",
      entityType: "drive",
      entityId: 1,
      field: "purpose",
      oldValue: null,
      newValue: "Kundentermin",
      changedAt: changedAt.toISOString(),
      changedBy: "tester",
      eventType: "change",
      previousHash: firstHash,
      metadata: null,
    };

    const secondHash = sha256(canonicalJson(secondPayload));

    const result = verifyAuditChain([
      {
        id: 1,
        eventId: "event-1",
        entityType: "drive",
        entityId: 1,
        field: "classification",
        oldValue: "private",
        newValue: "business",
        changedAt,
        changedBy: "tester",
        eventType: "change",
        previousHash: null,
        entryHash: firstHash,
        metadata: null,
      },
      {
        id: 2,
        eventId: "event-2",
        entityType: "drive",
        entityId: 1,
        field: "purpose",
        oldValue: null,
        newValue: "Kundentermin",
        changedAt,
        changedBy: "tester",
        eventType: "change",
        previousHash: firstHash,
        entryHash: secondHash,
        metadata: null,
      },
    ]);

    expect(result.ok).toBe(true);
    expect(result.checked).toBe(2);
    expect(result.lastHash).toBe(secondHash);
  });

  it("detects tampering in the audit chain", () => {
    const changedAt = new Date("2026-09-05T04:00:00.000Z");
    const payload = {
      version: 1,
      eventId: "event-1",
      entityType: "drive",
      entityId: 1,
      field: "classification",
      oldValue: "private",
      newValue: "business",
      changedAt: changedAt.toISOString(),
      changedBy: "tester",
      eventType: "change",
      previousHash: null,
      metadata: null,
    };

    const entryHash = sha256(canonicalJson(payload));

    const result = verifyAuditChain([
      {
        id: 1,
        eventId: "event-1",
        entityType: "drive",
        entityId: 1,
        field: "classification",
        oldValue: "private",
        newValue: "private",
        changedAt,
        changedBy: "tester",
        eventType: "change",
        previousHash: null,
        entryHash,
        metadata: null,
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.brokenAtId).toBe(1);
    expect(result.reason).toBe("entry_hash_mismatch");
  });

});
