import { NextResponse } from "next/server";

import {
  previewImportRollback,
  rollbackImportRun,
} from "@drivechronik/db";

import { validateSession } from "../../../../../../lib/auth/session";
import { db } from "../../../../../../lib/db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseImportRunId(
  value: string,
): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

function rollbackError(
  error: unknown,
) {
  const message =
    error instanceof Error
      ? error.message
      : "Import konnte nicht geprüft werden.";

  const status =
    message.includes(
      "wurde nicht gefunden",
    )
      ? 404
      : message.includes(
            "bereits vollständig zurückgesetzt",
          ) ||
          message.includes(
            "laufender Import",
          )
        ? 409
        : 400;

  return NextResponse.json(
    { error: message },
    { status },
  );
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Nicht angemeldet.",
      },
      { status: 401 },
    );
  }

  const { id } = await params;

  const importRunId =
    parseImportRunId(id);

  if (importRunId == null) {
    return NextResponse.json(
      {
        error:
          "Ungültige Import-ID.",
      },
      { status: 400 },
    );
  }

  try {
    const preview =
      await previewImportRollback(
        db,
        importRunId,
      );

    return NextResponse.json({
      mode: "preview",
      preview,
    });
  } catch (error) {
    return rollbackError(error);
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Nicht angemeldet.",
      },
      { status: 401 },
    );
  }

  const { id } = await params;

  const importRunId =
    parseImportRunId(id);

  if (importRunId == null) {
    return NextResponse.json(
      {
        error:
          "Ungültige Import-ID.",
      },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Bestätigung fehlt.",
      },
      { status: 400 },
    );
  }

  if (
    body == null ||
    typeof body !== "object" ||
    !("confirm" in body) ||
    body.confirm !== true
  ) {
    return NextResponse.json(
      {
        error:
          "Rollback muss ausdrücklich bestätigt werden.",
      },
      { status: 400 },
    );
  }

  try {
    const result =
      await rollbackImportRun(
        db,
        importRunId,
        {
          changedBy:
            user.username,
        },
      );

    return NextResponse.json({
      mode: "rollback",
      result,
    });
  } catch (error) {
    return rollbackError(error);
  }
}
