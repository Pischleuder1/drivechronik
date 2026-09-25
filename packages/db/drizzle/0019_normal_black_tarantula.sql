ALTER TABLE "journeys" ADD COLUMN "vehicle_id" bigint;
--> statement-breakpoint

-- Bestehende Reisen:
-- Fahrzeug aus den aktuell aktiven Journey-Mitgliedschaften ableiten.
-- Nur wenn alle aktiven Items derselben Reise genau einem Fahrzeug zugeordnet
-- werden können, wird vehicle_id automatisch gesetzt.
WITH "active_item_vehicles" AS (
  SELECT
    ji."journey_id",
    d."vehicle_id"
  FROM "journey_items" ji
  JOIN "drives" d
    ON ji."item_type" = 'drive'
   AND d."id" = ji."item_id"
  WHERE ji."excluded" = false

  UNION ALL

  SELECT
    ji."journey_id",
    c."vehicle_id"
  FROM "journey_items" ji
  JOIN "charge_sessions" c
    ON ji."item_type" = 'charge'
   AND c."id" = ji."item_id"
  WHERE ji."excluded" = false

  UNION ALL

  SELECT
    ji."journey_id",
    p."vehicle_id"
  FROM "journey_items" ji
  JOIN "park_sessions" p
    ON ji."item_type" = 'park'
   AND p."id" = ji."item_id"
  WHERE ji."excluded" = false
),
"unambiguous_journeys" AS (
  SELECT
    "journey_id",
    MIN("vehicle_id") AS "vehicle_id"
  FROM "active_item_vehicles"
  GROUP BY "journey_id"
  HAVING COUNT(DISTINCT "vehicle_id") = 1
)
UPDATE "journeys" j
SET "vehicle_id" = u."vehicle_id"
FROM "unambiguous_journeys" u
WHERE j."id" = u."journey_id";
--> statement-breakpoint

-- Historische Single-Vehicle-Installationen:
-- Auch Reisen ohne aktive Items lassen sich eindeutig zuordnen.
UPDATE "journeys"
SET "vehicle_id" = (
  SELECT MIN("id")
  FROM "vehicles"
)
WHERE "vehicle_id" IS NULL
  AND (
    SELECT COUNT(*)
    FROM "vehicles"
  ) = 1;
--> statement-breakpoint

-- Nicht eindeutig auflösbare Altdaten nicht stillschweigend einem Fahrzeug
-- zuordnen. Das betrifft insbesondere historisch gemischte Reisen oder leere
-- Reisen auf bereits vorhandenen Multi-Vehicle-Installationen.
DO $$
DECLARE
  unresolved_ids text;
BEGIN
  SELECT string_agg("id"::text, ', ' ORDER BY "id")
  INTO unresolved_ids
  FROM "journeys"
  WHERE "vehicle_id" IS NULL;

  IF unresolved_ids IS NOT NULL THEN
    RAISE EXCEPTION
      'DriveChronik: vehicle_id for journey(s) % cannot be determined unambiguously. Resolve mixed or empty journeys before retrying the migration.',
      unresolved_ids;
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "journeys"
  ALTER COLUMN "vehicle_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "journeys"
  ADD CONSTRAINT "journeys_vehicle_id_vehicles_id_fk"
  FOREIGN KEY ("vehicle_id")
  REFERENCES "public"."vehicles"("id")
  ON DELETE no action
  ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "journeys_vehicle_start_idx"
  ON "journeys" USING btree ("vehicle_id","start_time");
