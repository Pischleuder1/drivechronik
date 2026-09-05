#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  createHash,
  createPublicKey,
  verify,
} from "node:crypto";
import {
  canonicalJson,
  sha256,
} from "../packages/db/dist/audit.js";

function ok(label, value) {
  console.log(label.padEnd(24, ".") + " " + (value ? "✓" : "✗"));
}

function fail(message) {
  console.error("\nFEHLER: " + message);
  process.exitCode = 1;
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function verifySignature(sealHash, signatureBase64, publicKeyBase64) {
  try {
    if (!/^[0-9a-f]{64}$/i.test(sealHash)) {
      return false;
    }

    const publicKeyDer = Buffer.from(publicKeyBase64, "base64");

    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });

    if (publicKey.asymmetricKeyType !== "ed25519") {
      return false;
    }

    return verify(
      null,
      Buffer.from(sealHash, "hex"),
      publicKey,
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}

const filename = process.argv[2];

if (!filename) {
  console.error(
    "Verwendung: node scripts/verify-month-seal-proof.mjs <proof.json>",
  );
  process.exit(2);
}

let proof;

try {
  proof = JSON.parse(await readFile(filename, "utf8"));
} catch (error) {
  fail(
    "Proof-Datei konnte nicht gelesen werden: " +
      (error instanceof Error ? error.message : String(error)),
  );
  process.exit();
}

console.log("\nDriveChronik Monatsabschluss-Verifikation\n");

const formatValid =
  proof?.format === "drivechronik-month-seal-proof" &&
  proof?.version === 1;

const snapshot = proof?.snapshot;
const integrity = proof?.integrity;
const signature = proof?.signature;

let contentHashValid = false;
let sealHashValid = false;
let keyIdValid = false;
let signatureValid = false;

try {
  if (snapshot && integrity?.contentHash) {
    const contentPayload = {
      schemaVersion: snapshot.schemaVersion,
      month: snapshot.month,
      vehicleId: snapshot.identity.vehicleId,
      drives: snapshot.drives,
    };

    const calculatedContentHash = sha256(
      canonicalJson(contentPayload),
    );

    contentHashValid =
      calculatedContentHash === integrity.contentHash;
  }
} catch {
  contentHashValid = false;
}

try {
  if (
    snapshot &&
    integrity?.contentHash &&
    integrity?.sealHash
  ) {
    const sealPayload = {
      version: 1,
      vehicleId: proof.vehicleId,
      month: proof.month,
      revision: proof.revision,
      driverName: proof.identity.driverName,
      licensePlate: proof.identity.licensePlate,
      vehicleDisplayName: proof.identity.vehicleDisplayName,
      vehicleVin: proof.identity.vehicleVin,
      driveCount: proof.totals.driveCount,
      distanceKm: proof.totals.distanceKm,
      lastAuditHash: integrity.lastAuditHash,
      contentHash: integrity.contentHash,
      sealedAt: proof.sealedAt,
      sealedBy: proof.sealedBy,
    };

    const calculatedSealHash = sha256(
      canonicalJson(sealPayload),
    );

    sealHashValid =
      calculatedSealHash === integrity.sealHash;
  }
} catch {
  sealHashValid = false;
}

try {
  if (signature?.publicKey && signature?.keyId) {
    const publicKeyDer = Buffer.from(
      signature.publicKey,
      "base64",
    );

    keyIdValid =
      sha256Buffer(publicKeyDer) === signature.keyId;
  }
} catch {
  keyIdValid = false;
}

if (
  signature?.algorithm === "ed25519" &&
  signature?.value &&
  signature?.publicKey &&
  integrity?.sealHash
) {
  signatureValid = verifySignature(
    integrity.sealHash,
    signature.value,
    signature.publicKey,
  );
}

ok("Proof-Format", formatValid);
ok("Snapshot vorhanden", Boolean(snapshot));
ok("Content-Hash", contentHashValid);
ok("Seal-Hash", sealHashValid);
ok("Schlüssel-ID", keyIdValid);
ok("Ed25519-Signatur", signatureValid);

console.log("");

if (proof?.month) {
  console.log("Monat".padEnd(24, ".") + " " + proof.month);
}

if (proof?.revision != null) {
  console.log(
    "Revision".padEnd(24, ".") + " " + proof.revision,
  );
}

console.log(
  "Audit-Verknüpfung".padEnd(24, ".") +
    " " +
    (integrity?.lastAuditHash
      ? "im signierten Seal enthalten"
      : "kein Audit-Hash vorhanden"),
);

const valid =
  formatValid &&
  Boolean(snapshot) &&
  contentHashValid &&
  sealHashValid &&
  keyIdValid &&
  signatureValid;

console.log(
  "\nERGEBNIS: " + (valid ? "GÜLTIG" : "UNGÜLTIG"),
);

if (!valid) {
  process.exitCode = 1;
}
