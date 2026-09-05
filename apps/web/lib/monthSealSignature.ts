import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

export const MONTH_SEAL_SIGNATURE_ALGORITHM = "ed25519" as const;

export interface MonthSealSignature {
  algorithm: typeof MONTH_SEAL_SIGNATURE_ALGORITHM;
  signature: string;
  publicKey: string;
  keyId: string;
}

function sealHashBytes(sealHash: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(sealHash)) {
    throw new Error("Ungültiger Monatsabschluss-Hash.");
  }

  return Buffer.from(sealHash, "hex");
}

function requireEd25519Key(key: KeyObject): KeyObject {
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("Der Signaturschlüssel muss ein Ed25519-Schlüssel sein.");
  }

  return key;
}

export function publicKeyFingerprint(publicKeyBase64: string): string {
  const der = Buffer.from(publicKeyBase64, "base64");

  return createHash("sha256").update(der).digest("hex");
}

export function signMonthSealHash(
  sealHash: string,
  privateKeyPem: string | Buffer,
): MonthSealSignature {
  const privateKey = requireEd25519Key(createPrivateKey(privateKeyPem));
  const publicKey = requireEd25519Key(createPublicKey(privateKey));

  const publicKeyDer = publicKey.export({
    format: "der",
    type: "spki",
  });

  const publicKeyBase64 = publicKeyDer.toString("base64");
  const signature = sign(
    null,
    sealHashBytes(sealHash),
    privateKey,
  ).toString("base64");

  return {
    algorithm: MONTH_SEAL_SIGNATURE_ALGORITHM,
    signature,
    publicKey: publicKeyBase64,
    keyId: publicKeyFingerprint(publicKeyBase64),
  };
}

export function verifyMonthSealSignature(
  sealHash: string,
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  try {
    const publicKey = requireEd25519Key(
      createPublicKey({
        key: Buffer.from(publicKeyBase64, "base64"),
        format: "der",
        type: "spki",
      }),
    );

    return verify(
      null,
      sealHashBytes(sealHash),
      publicKey,
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}
