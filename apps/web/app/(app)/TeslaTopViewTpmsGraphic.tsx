import Image from "next/image";

type PressureTone = "neutral" | "ok" | "warn" | "alert";

function pressureTone(value: number | null): PressureTone {
  if (value == null || !Number.isFinite(value)) return "neutral";
  if (value < 2.4 || value > 3.3) return "alert";
  if (value < 2.6 || value > 3.1) return "warn";
  return "ok";
}

function formatBar(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";

  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

type TeslaModel = "model3" | "modely";

function detectTeslaModel(model: string | null | undefined): TeslaModel {
  const value = (model ?? "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .trim();

  if (
    value === "3" ||
    value === "model 3" ||
    value.includes("model3") ||
    value.includes("model 3")
  ) {
    return "model3";
  }

  if (
    value === "y" ||
    value === "model y" ||
    value.includes("modely") ||
    value.includes("model y")
  ) {
    return "modely";
  }

  // DriveChronik/TeslaMate-Fallback:
  // Bei unbekanntem Modell aktuell Model Y anzeigen.
  return "modely";
}

const toneClasses: Record<PressureTone, string> = {
  neutral:
    "border-neutral-200 bg-white/95 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-300",
  ok:
    "border-emerald-200 bg-emerald-50/95 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300",
  warn:
    "border-amber-200 bg-amber-50/95 text-amber-700 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
  alert:
    "border-rose-200 bg-rose-50/95 text-rose-700 dark:border-rose-800 dark:bg-rose-950/80 dark:text-rose-300",
};

function TpmsBadge({
  label,
  value,
  className,
}: {
  label: string;
  value: number | null;
  className: string;
}) {
  const tone = pressureTone(value);

  return (
    <div className={`absolute z-10 ${className}`}>
      <div
        className={`min-w-[72px] rounded-xl border px-2 py-1.5 text-center shadow-sm backdrop-blur ${toneClasses[tone]}`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">
          {label}
        </div>

        <div className="mt-0.5 text-sm font-semibold tabular-nums leading-none">
          {formatBar(value)}
        </div>

        <div className="mt-0.5 text-[9px] font-medium leading-none opacity-75">
          bar
        </div>
      </div>
    </div>
  );
}

export function TeslaTopViewTpmsGraphic({
  model,
  fl,
  fr,
  rl,
  rr,
}: {
  model?: string | null;
  fl: number | null;
  fr: number | null;
  rl: number | null;
  rr: number | null;
}) {
  const kind = detectTeslaModel(model);

  const image =
    kind === "model3"
      ? {
          src: "/vehicles/model3-top.png",
          width: 358,
          height: 732,
          alt: "Tesla Model 3 von oben",
        }
      : {
          src: "/vehicles/modely-top.png",
          width: 391,
          height: 782,
          alt: "Tesla Model Y von oben",
        };

  return (
    <div className="relative mx-auto h-[340px] w-full max-w-[360px]">
      {/* Fahrzeug */}
      <div className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center justify-center">
        <Image
          src={image.src}
          width={image.width}
          height={image.height}
          alt={image.alt}
          priority
          className="h-[320px] w-auto object-contain"
        />
      </div>

      {/* Vorderachse */}
      <TpmsBadge
        label="VL"
        value={fl}
        className="left-0 top-[22%]"
      />

      <TpmsBadge
        label="VR"
        value={fr}
        className="right-0 top-[22%]"
      />

      {/* Hinterachse */}
      <TpmsBadge
        label="HL"
        value={rl}
        className="bottom-[18%] left-0"
      />

      <TpmsBadge
        label="HR"
        value={rr}
        className="bottom-[18%] right-0"
      />
    </div>
  );
}
