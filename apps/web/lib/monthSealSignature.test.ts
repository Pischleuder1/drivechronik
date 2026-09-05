import { describe, expect, it } from "vitest";
import {
  generateKeyPairSync,
} from "node:crypto";
import {
  publicKeyFingerprint,
  signMonthSealHash,
  verifyMonthSealSignature,
} from "./monthSealSignature";

function createPrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync("ed25519");

  return privateKey.export({
    format: "pem",
    type: "pkcs8",
  }).toString();
}

describe("monthSealSignature", () => {
  const sealHash =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  it("signiert und verifiziert einen Monatsabschluss-Hash", () => {
    const signed = signMonthSealHash(
      sealHash,
      createPrivateKeyPem(),
    );

    expect(signed.algorithm).toBe("ed25519");
    expect(signed.signature).not.toBe("");
    expect(signed.publicKey).not.toBe("");
    expect(signed.keyId).toBe(
      publicKeyFingerprint(signed.publicKey),
    );

    expect(
      verifyMonthSealSignature(
        sealHash,
        signed.signature,
        signed.publicKey,
      ),
    ).toBe(true);
  });

  it("erkennt einen veränderten Abschluss-Hash", () => {
    const signed = signMonthSealHash(
      sealHash,
      createPrivateKeyPem(),
    );

    const changedHash =
      "1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    expect(
      verifyMonthSealSignature(
        changedHash,
        signed.signature,
        signed.publicKey,
      ),
    ).toBe(false);
  });

  it("erkennt eine Signatur mit einem anderen Schlüssel", () => {
    const signed = signMonthSealHash(
      sealHash,
      createPrivateKeyPem(),
    );

    const other = signMonthSealHash(
      sealHash,
      createPrivateKeyPem(),
    );

    expect(
      verifyMonthSealSignature(
        sealHash,
        signed.signature,
        other.publicKey,
      ),
    ).toBe(false);
  });

  it("weist ungültige Hashes beim Signieren zurück", () => {
    expect(() =>
      signMonthSealHash(
        "kein-sha256-hash",
        createPrivateKeyPem(),
      ),
    ).toThrow("Ungültiger Monatsabschluss-Hash.");
  });

  it("liefert bei ungültigen Verifikationsdaten false", () => {
    expect(
      verifyMonthSealSignature(
        sealHash,
        "ungueltig",
        "ungueltig",
      ),
    ).toBe(false);
  });
});
