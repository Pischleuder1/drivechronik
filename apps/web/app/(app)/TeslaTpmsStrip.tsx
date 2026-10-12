import { assessTpms } from "@drivechronik/core";

type Wheel = {
  label: string;
  value: number | null;
  warn: boolean;
};

export function TeslaTpmsStrip({
  fl,
  fr,
  rl,
  rr,
}: {
  fl: number | null;
  fr: number | null;
  rl: number | null;
  rr: number | null;
}) {
  const assessment = assessTpms({ fl, fr, rl, rr });

  const wheels: Wheel[] = [
    { label: "VL", value: fl, warn: assessment.fl.warn },
    { label: "VR", value: fr, warn: assessment.fr.warn },
    { label: "HL", value: rl, warn: assessment.rl.warn },
    { label: "HR", value: rr, warn: assessment.rr.warn },
  ];

  return (
    <div className="w-full max-w-xl py-3">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-neutral-400">
        Reifendruck
      </p>
      <div className="grid grid-cols-4 gap-3">
        {wheels.map((wheel) => (
          <div key={wheel.label} className="min-w-0">
            <p className="text-xs text-neutral-400">{wheel.label}</p>
            <p className={`mt-1 text-sm font-semibold tabular-nums ${
              wheel.value != null &&
              Number.isFinite(wheel.value) &&
              (wheel.value < 2.4 || wheel.value > 3.3)
                ? "text-red-600 dark:text-red-400"
                : wheel.warn ||
                    (wheel.value != null &&
                      Number.isFinite(wheel.value) &&
                      (wheel.value < 2.6 || wheel.value > 3.1))
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-neutral-700 dark:text-neutral-200"
            }`}>
              {wheel.value != null && Number.isFinite(wheel.value)
                ? wheel.value.toLocaleString("de-DE", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })
                : "—"}{" "}
              <span className="font-normal text-neutral-400">bar</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
