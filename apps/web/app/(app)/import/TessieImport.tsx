"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";

import { buttonClasses } from "../../../components/ui/Button";

const REQUIRED_FILES = [
  "driving_states.csv",
  "charging_states.csv",
  "climate_states.csv",
  "battery_states.csv",
] as const;

type RequiredFile = (typeof REQUIRED_FILES)[number];

type JobFile = {
  name: RequiredFile;
  uploaded: boolean;
  size: number;
};

type ImportResult = {
  minTs?: string | null;
  maxTs?: string | null;
  packKwh?: number | null;
  totalKm?: number;
  drivesImported?: number;
  drivesSkipped?: number;
  chargesImported?: number;
  chargesSkipped?: number;
  routePointsImported?: number;
  chargePointsImported?: number;
};

type ImportJob = {
  id: number;
  status: string;
  phase: string | null;
  progressPercent: number;
  processed: number;
  total: number | null;
  error: string | null;
  result: ImportResult | null;
  files: JobFile[];
  ready: boolean;
};

type SelectedFiles = Partial<Record<RequiredFile, File>>;

export function TessieImport() {
  const t = useTranslations("import");

  const [files, setFiles] = useState<SelectedFiles>({});
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allSelected = REQUIRED_FILES.every((name) => files[name]);

  function selectFile(name: RequiredFile, file: File | undefined) {
    setMessage(null);
    setError(null);
    setJob(null);

    if (!file) {
      setFiles((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
      return;
    }

    if (file.name !== name) {
      setError(t("tessie.errors.wrongFilename", { expected: name }));
      return;
    }

    setFiles((current) => ({
      ...current,
      [name]: file,
    }));
  }

  async function parseResponse(response: Response) {
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const apiError =
        body && typeof body.error === "string"
          ? body.error
          : t("tessie.errors.unknown");

      throw new Error(apiError);
    }

    return body;
  }

  async function getJob(id: number): Promise<ImportJob> {
    const response = await fetch(`/api/import/tessie/jobs/${id}`, {
      cache: "no-store",
    });

    return parseResponse(response);
  }

  async function uploadAndCheck() {
    if (!allSelected) {
      setError(t("tessie.errors.filesMissing"));
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    setJob(null);
    setUploadStep(0);

    try {
      const createResponse = await fetch("/api/import/tessie/jobs", {
        method: "POST",
      });

      const created = await parseResponse(createResponse);
      const jobId = Number(created.id);

      if (!Number.isInteger(jobId) || jobId <= 0) {
        throw new Error(t("tessie.errors.invalidJob"));
      }

      for (let index = 0; index < REQUIRED_FILES.length; index += 1) {
        const filename = REQUIRED_FILES[index];
        const file = files[filename];

        if (!file) {
          throw new Error(t("tessie.errors.filesMissing"));
        }

        setUploadStep(index + 1);

        const uploadResponse = await fetch(
          `/api/import/tessie/jobs/${jobId}/upload?file=${encodeURIComponent(filename)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "text/csv",
            },
            body: file,
          },
        );

        await parseResponse(uploadResponse);
      }

      const current = await getJob(jobId);
      setJob(current);

      if (!current.ready) {
        throw new Error(t("tessie.errors.serverFilesMissing"));
      }

      setMessage(t("tessie.ready"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("tessie.errors.unknown"),
      );
    } finally {
      setBusy(false);
      setUploadStep(0);
    }
  }

  async function startImport() {
    if (!job?.ready) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/import/tessie/jobs/${job.id}/start`,
        {
          method: "POST",
        },
      );

      await parseResponse(response);

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const current = await getJob(job.id);
        setJob(current);

        if (current.status === "completed") {
          setMessage(t("tessie.completed"));
          break;
        }

        if (current.status === "failed") {
          throw new Error(current.error || t("tessie.errors.importFailed"));
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("tessie.errors.unknown"),
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFiles({});
    setJob(null);
    setMessage(null);
    setError(null);
    setUploadStep(0);
  }

  const importing =
    job?.status === "queued" || job?.status === "importing";

  const progress = importing || job?.status === "completed"
    ? job.progressPercent
    : busy && uploadStep > 0
      ? Math.round((uploadStep / REQUIRED_FILES.length) * 100)
      : 0;

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3">
        {REQUIRED_FILES.map((name) => {
          const selected = files[name];

          return (
            <label
              key={name}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 p-3 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                <FileText aria-hidden size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {name}
                </span>
                <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {selected
                    ? t("tessie.selected", {
                        size: Math.max(1, Math.round(selected.size / 1024)),
                      })
                    : t("tessie.selectFile")}
                </span>
              </span>

              {selected && (
                <CheckCircle2
                  aria-hidden
                  size={18}
                  className="shrink-0 text-emerald-600 dark:text-emerald-400"
                />
              )}

              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={busy}
                onChange={(event) =>
                  selectFile(name, event.target.files?.[0])
                }
              />
            </label>
          );
        })}
      </div>

      {(busy || importing || job?.status === "completed") && (
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              {importing
                ? t("tessie.progress.import")
                : job?.status === "completed"
                  ? t("tessie.progress.completed")
                  : t("tessie.progress.upload", {
                      current: uploadStep,
                      total: REQUIRED_FILES.length,
                    })}
            </span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {progress} %
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-sky-600 transition-all duration-300 dark:bg-sky-500"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>

          {job?.total !== null &&
            job?.total !== undefined &&
            importing && (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {t("tessie.progress.processed", {
                  processed: job.processed,
                  total: job.total,
                })}
              </p>
            )}
        </div>
      )}

      {message && (
        <p
          role="status"
          className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2 aria-hidden size={17} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
        >
          <XCircle aria-hidden size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {job?.status === "completed" && job.result && (
        <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/60">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("tessie.result.title")}
          </h3>

          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">
                {t("tessie.result.drives")}
              </dt>
              <dd className="font-medium">
                {job.result.drivesImported ?? 0}
              </dd>
            </div>

            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">
                {t("tessie.result.charges")}
              </dt>
              <dd className="font-medium">
                {job.result.chargesImported ?? 0}
              </dd>
            </div>

            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">
                {t("tessie.result.routePoints")}
              </dt>
              <dd className="font-medium">
                {job.result.routePointsImported ?? 0}
              </dd>
            </div>

            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">
                {t("tessie.result.chargePoints")}
              </dt>
              <dd className="font-medium">
                {job.result.chargePointsImported ?? 0}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!job?.ready && (
          <button
            type="button"
            disabled={busy || !allSelected}
            onClick={uploadAndCheck}
            className={buttonClasses("primary", "sm")}
          >
            {busy ? (
              <Loader2 aria-hidden size={16} className="animate-spin" />
            ) : (
              <Upload aria-hidden size={16} />
            )}
            {busy
              ? t("tessie.uploading")
              : t("tessie.uploadAndCheck")}
          </button>
        )}

        {job?.ready && job.status === "staged" && (
          <button
            type="button"
            disabled={busy}
            onClick={startImport}
            className={buttonClasses("primary", "sm")}
          >
            {busy && (
              <Loader2 aria-hidden size={16} className="animate-spin" />
            )}
            {busy ? t("tessie.importing") : t("tessie.start")}
          </button>
        )}

        {job?.status === "completed" && (
          <button
            type="button"
            onClick={reset}
            className={buttonClasses("secondary", "sm")}
          >
            {t("tessie.reset")}
          </button>
        )}
      </div>
    </div>
  );
}
