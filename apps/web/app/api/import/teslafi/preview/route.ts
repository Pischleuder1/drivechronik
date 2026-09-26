import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  vehicles,
} from "@drivechronik/db";

import {
  previewTeslaFiCsv,
} from "@drivechronik/core";

import { db } from "../../../../../lib/db";
import { validateSession } from "../../../../../lib/auth/session";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).format();

    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("import");
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      {
        error: t("apiErrors.notAuthenticated"),
      },
      { status: 401 },
    );
  }

  try {
    const form = await request.formData();

    const file = form.get("file");
    const vehicleIdRaw = form.get("vehicleId");
    const timezoneRaw = form.get("timezone");

    if (
      !file ||
      typeof file !== "object" ||
      !("arrayBuffer" in file)
    ) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.selectFile",
          ),
        },
        { status: 400 },
      );
    }

    const size =
      "size" in file &&
      typeof file.size === "number"
        ? file.size
        : 0;

    if (size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.fileTooLarge",
          ),
        },
        { status: 413 },
      );
    }

    const vehicleId = Number(
      typeof vehicleIdRaw === "string"
        ? vehicleIdRaw
        : "",
    );

    if (
      !Number.isInteger(vehicleId) ||
      vehicleId <= 0
    ) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.vehicleRequired",
          ),
        },
        { status: 400 },
      );
    }

    const timezone =
      typeof timezoneRaw === "string"
        ? timezoneRaw.trim()
        : "";

    if (
      timezone.length === 0 ||
      !validTimeZone(timezone)
    ) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.invalidTimezone",
          ),
        },
        { status: 400 },
      );
    }

    const vehicleRows = await db
      .select({
        id: vehicles.id,
        displayName: vehicles.displayName,
      })
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);

    const vehicle = vehicleRows[0];

    if (!vehicle) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.vehicleNotFound",
          ),
        },
        { status: 404 },
      );
    }

    const bytes = await file.arrayBuffer();

    const csvText = Buffer
      .from(bytes)
      .toString("utf8");

    const preview =
      previewTeslaFiCsv(csvText);

    const fileName =
      "name" in file &&
      typeof file.name === "string"
        ? file.name
        : null;

    return NextResponse.json({
      mode: "preview",
      dryRun: true,

      file: {
        name: fileName,
        size,
      },

      vehicle,

      timezone,

      preview,
    });
  } catch (error) {
    console.error(
      "[web] TeslaFi-Vorschau fehlgeschlagen",
      error,
    );

    return NextResponse.json(
      {
        error: t(
          "teslafi.errors.unknown",
        ),
      },
      { status: 400 },
    );
  }
}
