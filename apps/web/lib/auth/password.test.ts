import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes and verifies the correct password", async () => {
    const password = "DriveChronik-Test-2026!";
    const storedHash = await hashPassword(password);

    expect(storedHash).not.toBe(password);
    expect(storedHash.startsWith("$argon2")).toBe(true);
    expect(await verifyPassword(storedHash, password)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const storedHash = await hashPassword("correct-password");

    expect(await verifyPassword(storedHash, "wrong-password")).toBe(false);
  });

  it("returns false for an invalid stored hash", async () => {
    expect(await verifyPassword("not-an-argon2-hash", "password")).toBe(false);
  });

  it("uses a fresh salt for every password hash", async () => {
    const password = "same-password";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).not.toBe(second);
    expect(await verifyPassword(first, password)).toBe(true);
    expect(await verifyPassword(second, password)).toBe(true);
  });
});
