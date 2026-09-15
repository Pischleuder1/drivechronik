import postgres from "postgres";

import {
  BUSINESS_PLACE_KEYS,
  DEMO_PLACES,
  PRIVATE_PLACE_KEYS,
  demoPlace,
  type DemoPlace,
} from "./demoWorld";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://drivechronik:drivechronik-demo@localhost:5432/drivechronik";

const sql = postgres(DATABASE_URL, { max: 1 });

type Classification = "private" | "business" | "commute";

interface DemoRule {
  name: string;
  priority: number;
  startKey: string | null;
  endKey: string | null;
  classification: Classification;
  purpose: string | null;
  customer: string | null;
  project: string | null;
}

function businessDetails(key: string): {
  purpose: string;
  customer: string | null;
  project: string | null;
} {
  const place = demoPlace(key);

  switch (place.type) {
    case "customer":
      return {
        purpose: "Kundenbesuch",
        customer: place.name,
        project: null,
      };

    case "site":
      return {
        purpose: "Baustellentermin",
        customer: null,
        project: "Projekt Nord",
      };

    case "supplier":
      return {
        purpose: "Lieferantentermin",
        customer: place.name,
        project: null,
      };

    case "hotel":
      return {
        purpose: "Dienstreise",
        customer: null,
        project: null,
      };

    default:
      return {
        purpose: "Geschäftliche Fahrt",
        customer: null,
        project: null,
      };
  }
}

const rules: DemoRule[] = [
  {
    name: "[Demo] Arbeitsweg Zuhause → Büro",
    priority: 10,
    startKey: "home",
    endKey: "office",
    classification: "commute",
    purpose: "Arbeitsweg",
    customer: null,
    project: null,
  },
  {
    name: "[Demo] Arbeitsweg Büro → Zuhause",
    priority: 11,
    startKey: "office",
    endKey: "home",
    classification: "commute",
    purpose: "Arbeitsweg",
    customer: null,
    project: null,
  },
];

let priority = 20;

for (const key of BUSINESS_PLACE_KEYS) {
  const place = demoPlace(key);
  const details = businessDetails(key);

  rules.push({
    name: `[Demo] Geschäftlich → ${place.name}`,
    priority: priority++,
    startKey: null,
    endKey: key,
    classification: "business",
    ...details,
  });

  rules.push({
    name: `[Demo] Geschäftlich ${place.name} →`,
    priority: priority++,
    startKey: key,
    endKey: null,
    classification: "business",
    ...details,
  });
}

priority = 100;

for (const key of PRIVATE_PLACE_KEYS) {
  const place = demoPlace(key);

  rules.push({
    name: `[Demo] Privat → ${place.name}`,
    priority: priority++,
    startKey: null,
    endKey: key,
    classification: "private",
    purpose: "Privatfahrt",
    customer: null,
    project: null,
  });

  rules.push({
    name: `[Demo] Privat ${place.name} →`,
    priority: priority++,
    startKey: key,
    endKey: null,
    classification: "private",
    purpose: "Privatfahrt",
    customer: null,
    project: null,
  });
}

// Für das Parkhaus wird bewusst keine Regel erzeugt.
// So bleiben später einige Fahrten zur manuellen Klassifizierung offen.

async function ensurePlace(place: DemoPlace): Promise<number> {
  const existing = await sql<{ id: number }[]>`
    SELECT id
    FROM places
    WHERE source = 'demo'
      AND source_id = ${place.key}
    ORDER BY id
    LIMIT 1
  `;

  if (existing.length > 0) {
    const id = Number(existing[0]!.id);

    await sql`
      UPDATE places
      SET
        name = ${place.name},
        type = ${place.type}::place_type,
        lat = ${place.lat},
        lon = ${place.lon},
        radius_m = ${place.radiusM},
        address = ${place.displayName},
        electricity_price_per_kwh = ${place.electricityPricePerKwh},
        electricity_price_currency =
          CASE
            WHEN ${place.electricityPricePerKwh}::double precision IS NULL
              THEN NULL
            ELSE 'EUR'
          END,
        updated_at = now()
      WHERE id = ${id}
    `;

    return id;
  }

  const inserted = await sql<{ id: number }[]>`
    INSERT INTO places (
      name,
      type,
      lat,
      lon,
      radius_m,
      address,
      electricity_price_per_kwh,
      electricity_price_currency,
      source,
      source_id
    )
    VALUES (
      ${place.name},
      ${place.type}::place_type,
      ${place.lat},
      ${place.lon},
      ${place.radiusM},
      ${place.displayName},
      ${place.electricityPricePerKwh},
      CASE
        WHEN ${place.electricityPricePerKwh}::double precision IS NULL
          THEN NULL
        ELSE 'EUR'
      END,
      'demo',
      ${place.key}
    )
    RETURNING id
  `;

  return Number(inserted[0]!.id);
}

async function ensureRule(
  rule: DemoRule,
  placeIds: Map<string, number>,
): Promise<void> {
  const startPlaceId =
    rule.startKey == null
      ? null
      : (placeIds.get(rule.startKey) ?? null);

  const endPlaceId =
    rule.endKey == null
      ? null
      : (placeIds.get(rule.endKey) ?? null);

  if (rule.startKey != null && startPlaceId == null) {
    throw new Error(`Start place missing for ${rule.name}`);
  }

  if (rule.endKey != null && endPlaceId == null) {
    throw new Error(`End place missing for ${rule.name}`);
  }

  const existing = await sql<{ id: number }[]>`
    SELECT id
    FROM classification_rules
    WHERE name = ${rule.name}
    ORDER BY id
    LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE classification_rules
      SET
        enabled = true,
        priority = ${rule.priority},
        start_place_id = ${startPlaceId},
        end_place_id = ${endPlaceId},
        weekdays = NULL,
        start_minute_from = NULL,
        start_minute_to = NULL,
        classification =
          ${rule.classification}::drive_classification,
        purpose = ${rule.purpose},
        customer = ${rule.customer},
        project = ${rule.project},
        updated_at = now()
      WHERE id = ${existing[0]!.id}
    `;

    return;
  }

  await sql`
    INSERT INTO classification_rules (
      name,
      enabled,
      priority,
      start_place_id,
      end_place_id,
      weekdays,
      start_minute_from,
      start_minute_to,
      classification,
      purpose,
      customer,
      project
    )
    VALUES (
      ${rule.name},
      true,
      ${rule.priority},
      ${startPlaceId},
      ${endPlaceId},
      NULL,
      NULL,
      NULL,
      ${rule.classification}::drive_classification,
      ${rule.purpose},
      ${rule.customer},
      ${rule.project}
    )
  `;
}

async function main() {
  console.log(`Bootstrapping DriveChronik demo DB at ${DATABASE_URL}`);

  const placeIds = new Map<string, number>();

  for (const place of DEMO_PLACES) {
    const id = await ensurePlace(place);
    placeIds.set(place.key, id);
  }

  for (const rule of rules) {
    await ensureRule(rule, placeIds);
  }

  // Places der Demo werden vom Bootstrap selbst verwaltet.
  // Deshalb soll der Worker keine zusätzlichen TeslaMate-Geofences
  // als Places importieren.
  await sql`
    INSERT INTO settings (key, value)
    VALUES ('geofence_import_done', 'true'::jsonb)
    ON CONFLICT (key)
    DO UPDATE SET
      value = 'true'::jsonb,
      updated_at = now()
  `;

  const [placeCount] = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM places
    WHERE source = 'demo'
  `;

  const [ruleCount] = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM classification_rules
    WHERE name LIKE '[Demo]%'
  `;

  console.log("");
  console.log("Demo bootstrap summary");
  console.log("----------------------");
  console.log(`demo places: ${placeCount?.count ?? 0}`);
  console.log(`demo rules:  ${ruleCount?.count ?? 0}`);
}

main()
  .catch((error) => {
    console.error("Demo bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
