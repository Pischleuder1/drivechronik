"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, lt, notInArray, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import {
  appendAuditEntry,
  chargeSessions,
  drives,
  journeyItems,
  journeys,
  parkSessions,
} from "@drivechronik/db";
import { db } from "../db";
import { validateSession } from "../auth/session";
import { parseDateTimeLocal } from "../day";
import { getActiveVehicleId } from "../activeVehicle";

const typeSchema = z.enum(["vacation", "business_trip", "roadtrip", "other"]);

export interface JourneyFormResult {
  ok: boolean;
  error?: string;
  /** Bei Erfolg die id der angelegten/aktualisierten Reise (für Redirect). */
  journeyId?: number;
}

function nullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

/** Parst einen datetime-local-Wert (APP_TIMEZONE-Wandzeit) in ein UTC-Date. */
function parseDateTime(value: FormDataEntryValue | null): Date | null {
  if (value == null) return null;
  return parseDateTimeLocal(String(value));
}

/**
 * Baut die Zod-Schemas für die Formularfelder mit übersetzten
 * Fehlermeldungen. Muss innerhalb der Server Action (nach getTranslations)
 * aufgerufen werden, da die Meldungen request-scoped (Locale) sind.
 */
function buildBaseFields(t: Awaited<ReturnType<typeof getTranslations>>) {
  const colorSchema = z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, t("errors.invalidColor"));
  return z.object({
    name: z.string().trim().min(1, t("errors.nameRequired")).max(200),
    type: typeSchema,
    description: z.string().trim().max(5000).nullable(),
    color: colorSchema.nullable(),
  });
}

async function journeyBelongsToVehicle(
  journeyId: number,
  vehicleId: number,
): Promise<boolean> {
  const rows = await db
    .select({ id: journeys.id })
    .from(journeys)
    .where(
      and(
        eq(journeys.id, journeyId),
        eq(journeys.vehicleId, vehicleId),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

async function itemBelongsToVehicle(
  itemType: "drive" | "charge" | "park",
  itemId: number,
  vehicleId: number,
): Promise<boolean> {
  if (itemType === "drive") {
    const rows = await db
      .select({ id: drives.id })
      .from(drives)
      .where(
        and(
          eq(drives.id, itemId),
          eq(drives.vehicleId, vehicleId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  if (itemType === "charge") {
    const rows = await db
      .select({ id: chargeSessions.id })
      .from(chargeSessions)
      .where(
        and(
          eq(chargeSessions.id, itemId),
          eq(chargeSessions.vehicleId, vehicleId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  const rows = await db
    .select({ id: parkSessions.id })
    .from(parkSessions)
    .where(
      and(
        eq(parkSessions.id, itemId),
        eq(parkSessions.vehicleId, vehicleId),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Legt die Auto-Zuordnung einer Reise an bzw. aktualisiert sie: fügt für alle
 * Fahrten, Ladestopps und Parkvorgänge, deren Startzeit im Reisezeitraum liegt,
 * journey_items-Rows (assignedBy='auto') ein. ON CONFLICT DO NOTHING lässt
 * bereits vorhandene (excluded oder manuelle) Rows unangetastet — vom Nutzer
 * entfernte Items werden also nicht erneut zugeordnet. Anschließend werden
 * verwaiste Auto-Rows (nicht excluded, nicht mehr im Fenster) entfernt.
 *
 * Parks werden zwar mit zugeordnet (für die Export-Vollständigkeit gemäß
 * vision.md §20.4), aber in der MVP-Detail-UI nicht angezeigt.
 */
export async function autoAssignJourney(journeyId: number): Promise<void> {
  const rows = await db
    .select({
      startTime: journeys.startTime,
      endTime: journeys.endTime,
      vehicleId: journeys.vehicleId,
    })
    .from(journeys)
    .where(eq(journeys.id, journeyId))
    .limit(1);
  const j = rows[0];
  if (!j) return;

  const inWindow = (col: SQLWrapper) =>
    and(gte(col, j.startTime), lt(col, j.endTime));

  const driveIds = (
    await db
      .select({ id: drives.id })
      .from(drives)
      .where(
        and(
          eq(drives.vehicleId, j.vehicleId),
          inWindow(drives.startTime),
        ),
      )
  ).map((r) => r.id);
  const chargeIds = (
    await db
      .select({ id: chargeSessions.id })
      .from(chargeSessions)
      .where(
        and(
          eq(chargeSessions.vehicleId, j.vehicleId),
          inWindow(chargeSessions.startTime),
        ),
      )
  ).map((r) => r.id);
  const parkIds = (
    await db
      .select({ id: parkSessions.id })
      .from(parkSessions)
      .where(
        and(
          eq(parkSessions.vehicleId, j.vehicleId),
          inWindow(parkSessions.startTime),
        ),
      )
  ).map((r) => r.id);

  await db.transaction(async (tx) => {
    const values: Array<{
      journeyId: number;
      itemType: string;
      itemId: number;
    }> = [
      ...driveIds.map((id) => ({ journeyId, itemType: "drive", itemId: id })),
      ...chargeIds.map((id) => ({ journeyId, itemType: "charge", itemId: id })),
      ...parkIds.map((id) => ({ journeyId, itemType: "park", itemId: id })),
    ];

    if (values.length > 0) {
      // Nur einfügen, wenn (journeyId,itemType,itemId) noch nicht existiert —
      // excluded- und manual-Rows bleiben so unangetastet.
      await tx
        .insert(journeyItems)
        .values(values.map((v) => ({ ...v, assignedBy: "auto" })))
        .onConflictDoNothing({
          target: [
            journeyItems.journeyId,
            journeyItems.itemType,
            journeyItems.itemId,
          ],
        });
    }

    // Verwaiste Auto-Rows entfernen: assignedBy='auto', nicht excluded, aber
    // ihr Item fällt nicht (mehr) ins Fenster (Zeitraum wurde verkleinert).
    await pruneStaleAutoRows(tx, journeyId, "drive", driveIds);
    await pruneStaleAutoRows(tx, journeyId, "charge", chargeIds);
    await pruneStaleAutoRows(tx, journeyId, "park", parkIds);
  });
}

async function pruneStaleAutoRows(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  journeyId: number,
  itemType: string,
  keepIds: number[],
): Promise<void> {
  const base = and(
    eq(journeyItems.journeyId, journeyId),
    eq(journeyItems.itemType, itemType),
    eq(journeyItems.assignedBy, "auto"),
    eq(journeyItems.excluded, false),
  );
  await tx
    .delete(journeyItems)
    .where(
      keepIds.length > 0
        ? and(base, notInArray(journeyItems.itemId, keepIds))
        : base,
    );
}

function validateWindow(
  t: Awaited<ReturnType<typeof getTranslations>>,
  startTime: Date | null,
  endTime: Date | null,
): { ok: true; start: Date; end: Date } | { ok: false; error: string } {
  if (startTime == null || endTime == null) {
    return { ok: false, error: t("errors.windowRequired") };
  }
  if (startTime.getTime() >= endTime.getTime()) {
    return { ok: false, error: t("errors.rangeInvalid") };
  }
  return { ok: true, start: startTime, end: endTime };
}

/** Legt eine neue Reise an und ordnet Items automatisch zu. */
export async function createJourney(
  _prev: JourneyFormResult,
  formData: FormData,
): Promise<JourneyFormResult> {
  const t = await getTranslations("journeys");
  const user = await validateSession();
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const vehicleId = await getActiveVehicleId();
  if (vehicleId == null) {
    return { ok: false, error: t("errors.noVehicle") };
  }

  const parsed = buildBaseFields(t).safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    description: nullableString(formData.get("description")),
    color: nullableString(formData.get("color")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("errors.invalidInput") };
  }

  const window = validateWindow(
    t,
    parseDateTime(formData.get("startTime")),
    parseDateTime(formData.get("endTime")),
  );
  if (!window.ok) return { ok: false, error: window.error };

  const journeyId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(journeys)
      .values({
        vehicleId,
        name: parsed.data.name,
        type: parsed.data.type,
        startTime: window.start,
        endTime: window.end,
        color: parsed.data.color,
        description: parsed.data.description,
      })
      .returning({ id: journeys.id });

    const journeyId = inserted[0]!.id;

    await appendAuditEntry(tx, {
      entityType: "journey",
      entityId: journeyId,
      field: "created",
      oldValue: null,
      newValue: parsed.data.name,
      changedBy: user.username,
      eventType: "create",
    });

    return journeyId;
  });

  await autoAssignJourney(journeyId);

  revalidatePath("/journeys");
  return { ok: true, journeyId };
}

/** Aktualisiert eine Reise und ordnet Items neu zu (Auto-Zuordnung). */
export async function updateJourney(
  _prev: JourneyFormResult,
  formData: FormData,
): Promise<JourneyFormResult> {
  const t = await getTranslations("journeys");
  const user = await validateSession();
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const vehicleId = await getActiveVehicleId();
  if (vehicleId == null) {
    return { ok: false, error: t("errors.noVehicle") };
  }

  const updateFields = buildBaseFields(t).extend({
    id: z.number().int().positive(),
  });

  const parsed = updateFields.safeParse({
    id: Number(formData.get("id")),
    name: formData.get("name"),
    type: formData.get("type"),
    description: nullableString(formData.get("description")),
    color: nullableString(formData.get("color")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("errors.invalidInput") };
  }

  const window = validateWindow(
    t,
    parseDateTime(formData.get("startTime")),
    parseDateTime(formData.get("endTime")),
  );
  if (!window.ok) return { ok: false, error: window.error };

  const existing = await db
    .select({ id: journeys.id })
    .from(journeys)
    .where(
      and(
        eq(journeys.id, parsed.data.id),
        eq(journeys.vehicleId, vehicleId),
      ),
    )
    .limit(1);
  if (!existing[0]) return { ok: false, error: t("errors.notFound") };

  await db.transaction(async (tx) => {
    await tx
      .update(journeys)
      .set({
        name: parsed.data.name,
        type: parsed.data.type,
        startTime: window.start,
        endTime: window.end,
        color: parsed.data.color,
        description: parsed.data.description,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(journeys.id, parsed.data.id),
          eq(journeys.vehicleId, vehicleId),
        ),
      );

    await appendAuditEntry(tx, {
      entityType: "journey",
      entityId: parsed.data.id,
      field: "updated",
      oldValue: null,
      newValue: parsed.data.name,
      changedBy: user.username,
    });
  });

  await autoAssignJourney(parsed.data.id);

  revalidatePath("/journeys");
  revalidatePath(`/journeys/${parsed.data.id}`);
  return { ok: true, journeyId: parsed.data.id };
}

const deleteSchema = z.object({ id: z.number().int().positive() });

/** Löscht eine Reise. journey_items werden per FK-Cascade mitgelöscht. */
export async function deleteJourney(id: number): Promise<void> {
  const t = await getTranslations("journeys");
  const user = await validateSession();
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const vehicleId = await getActiveVehicleId();
  if (vehicleId == null) throw new Error(t("errors.noVehicle"));

  const parsed = deleteSchema.parse({ id });

  if (!(await journeyBelongsToVehicle(parsed.id, vehicleId))) {
    throw new Error(t("errors.notFound"));
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(journeys)
      .where(
        and(
          eq(journeys.id, parsed.id),
          eq(journeys.vehicleId, vehicleId),
        ),
      );
    await appendAuditEntry(tx, {
      entityType: "journey",
      entityId: parsed.id,
      field: "deleted",
      oldValue: null,
      newValue: null,
      changedBy: user.username,
      eventType: "delete",
    });
  });

  revalidatePath("/journeys");
  redirect("/journeys");
}

const itemTypeSchema = z.enum(["drive", "charge", "park"]);

const itemSchema = z.object({
  journeyId: z.number().int().positive(),
  itemType: itemTypeSchema,
  itemId: z.number().int().positive(),
});

/**
 * Entfernt ein Item aus einer Reise: setzt excluded=true (assignedBy bleibt),
 * damit die Auto-Zuordnung es nie wieder aufnimmt. Schreibt eine Audit-Row.
 */
export async function removeItem(
  journeyId: number,
  itemType: z.infer<typeof itemTypeSchema>,
  itemId: number,
): Promise<void> {
  const t = await getTranslations("journeys");
  const user = await validateSession();
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const vehicleId = await getActiveVehicleId();
  if (vehicleId == null) throw new Error(t("errors.noVehicle"));

  const parsed = itemSchema.parse({ journeyId, itemType, itemId });

  if (!(await journeyBelongsToVehicle(parsed.journeyId, vehicleId))) {
    throw new Error(t("errors.notFound"));
  }

  if (
    !(await itemBelongsToVehicle(
      parsed.itemType,
      parsed.itemId,
      vehicleId,
    ))
  ) {
    throw new Error(t("errors.itemVehicleMismatch"));
  }

  await db.transaction(async (tx) => {
    // Falls die Row (noch) nicht existiert (z. B. manuell außerhalb des
    // Fensters), als excluded manual-Row anlegen, damit der Ausschluss
    // dauerhaft ist.
    await tx
      .insert(journeyItems)
      .values({
        journeyId: parsed.journeyId,
        itemType: parsed.itemType,
        itemId: parsed.itemId,
        assignedBy: "manual",
        excluded: true,
      })
      .onConflictDoUpdate({
        target: [
          journeyItems.journeyId,
          journeyItems.itemType,
          journeyItems.itemId,
        ],
        set: { excluded: true, updatedAt: new Date() },
      });

    await appendAuditEntry(tx, {
      entityType: "journey",
      entityId: parsed.journeyId,
      field: "item_removed",
      oldValue: null,
      newValue: `${parsed.itemType}:${parsed.itemId}`,
      changedBy: user.username,
    });
  });

  revalidatePath(`/journeys/${parsed.journeyId}`);
  revalidatePath("/journeys");
}

/**
 * Fügt ein Item manuell zu einer Reise hinzu: upsert assignedBy='manual',
 * excluded=false. Reaktiviert damit auch zuvor entfernte Items. Audit-Row.
 */
export async function addItem(
  journeyId: number,
  itemType: z.infer<typeof itemTypeSchema>,
  itemId: number,
): Promise<void> {
  const t = await getTranslations("journeys");
  const user = await validateSession();
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const vehicleId = await getActiveVehicleId();
  if (vehicleId == null) throw new Error(t("errors.noVehicle"));

  const parsed = itemSchema.parse({ journeyId, itemType, itemId });

  if (!(await journeyBelongsToVehicle(parsed.journeyId, vehicleId))) {
    throw new Error(t("errors.notFound"));
  }

  if (
    !(await itemBelongsToVehicle(
      parsed.itemType,
      parsed.itemId,
      vehicleId,
    ))
  ) {
    throw new Error(t("errors.itemVehicleMismatch"));
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(journeyItems)
      .values({
        journeyId: parsed.journeyId,
        itemType: parsed.itemType,
        itemId: parsed.itemId,
        assignedBy: "manual",
        excluded: false,
      })
      .onConflictDoUpdate({
        target: [
          journeyItems.journeyId,
          journeyItems.itemType,
          journeyItems.itemId,
        ],
        set: { assignedBy: "manual", excluded: false, updatedAt: new Date() },
      });

    await appendAuditEntry(tx, {
      entityType: "journey",
      entityId: parsed.journeyId,
      field: "item_added",
      oldValue: null,
      newValue: `${parsed.itemType}:${parsed.itemId}`,
      changedBy: user.username,
    });
  });

  revalidatePath(`/journeys/${parsed.journeyId}`);
  revalidatePath("/journeys");
}
