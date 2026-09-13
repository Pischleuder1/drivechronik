import Image from "next/image";

export type PageHeaderVisualVariant =
  | "route"
  | "gps"
  | "year"
  | "heatmap"
  | "charge"
  | "stats"
  | "places"
  | "vehicle"
  | "document"
  | "tools"
  | "calendar";

export function PageHeaderVisual({
  variant,
  text,
  compact = false,
}: {
  variant: PageHeaderVisualVariant;
  text?: string | number;
  compact?: boolean;
}) {
  const common = `pointer-events-none absolute inset-y-0 right-0 overflow-hidden ${
    compact ? "w-[72%]" : "w-[76%] sm:w-[68%]"
  } text-sky-600/60 dark:text-sky-300/40`;

  if (variant === "year") {
    return (
      <div aria-hidden className={common}>
        <div className="absolute inset-0 bg-gradient-to-l from-sky-50/60 via-transparent to-transparent dark:from-sky-950/20" />
        <div className="absolute right-5 top-1/2 -translate-y-1/2 select-none text-[4.8rem] font-semibold leading-none tracking-[-0.08em] text-sky-950/[0.055] sm:right-8 sm:text-[7.5rem] dark:text-sky-100/[0.055]">
          {text ?? new Date().getFullYear()}
        </div>
        <svg viewBox="0 0 760 180" className="absolute inset-x-0 bottom-0 h-full w-full" preserveAspectRatio="none">
          <path d="M38 163 C126 142 145 117 220 126 C293 135 303 81 376 92 C452 104 482 65 548 69 C626 73 649 32 750 25" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M58 174 C155 151 163 133 230 141 C311 151 328 102 392 108 C469 116 503 84 561 86 C633 88 675 48 755 42" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".45" />
          {[220, 376, 548, 690].map((x, i) => (
            <circle key={x} cx={x} cy={[126, 92, 69, 43][i]} r="5" fill="white" stroke="currentColor" strokeWidth="2.5" />
          ))}
        </svg>
      </div>
    );
  }

  if (variant === "heatmap") {
    const spots = [
      [180, 60, 30], [282, 108, 46], [405, 58, 24], [505, 112, 39],
      [610, 65, 25], [665, 135, 31], [365, 145, 22],
    ] as const;
    return (
      <div aria-hidden className={common}>
        <svg viewBox="0 0 760 180" className="h-full w-full" preserveAspectRatio="none">
          <g fill="none" stroke="currentColor" strokeWidth="0.8" opacity=".25">
            {Array.from({ length: 13 }, (_, i) => <path key={`v-${i}`} d={`M${i * 66 - 40} -10 L${i * 66 + 70} 190`} />)}
            {Array.from({ length: 8 }, (_, i) => <path key={`h-${i}`} d={`M0 ${i * 30 - 10} C190 ${i * 28 + 10}, 430 ${i * 31 - 16}, 780 ${i * 30 + 4}`} />)}
          </g>
          {spots.map(([cx, cy, r]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r={r} fill="currentColor" opacity=".07" />
              <circle cx={cx} cy={cy} r={r * .55} fill="currentColor" opacity=".12" />
              <circle cx={cx} cy={cy} r="4" fill="currentColor" opacity=".8" />
            </g>
          ))}
        </svg>
      </div>
    );
  }


  if (variant === "charge") {
    return (
      <div aria-hidden className={common}>
        <div className="absolute inset-0 bg-gradient-to-l from-sky-50/70 via-transparent to-transparent dark:from-sky-950/20" />
        <svg
          viewBox="0 0 760 180"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity=".18"
          >
            <path d="M20 145 C135 110 210 148 320 112 C420 79 518 107 742 48" />
            <path d="M35 162 C160 130 242 166 350 133 C466 98 560 128 750 72" />
          </g>

          <rect
            x="430"
            y="43"
            width="190"
            height="94"
            rx="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <rect
            x="623"
            y="72"
            width="18"
            height="36"
            rx="5"
            fill="currentColor"
            opacity=".42"
          />

          <path
            d="M522 27 L476 92 H519 L494 151 L572 73 H530 L553 27 Z"
            fill="currentColor"
            opacity=".32"
          />

          <circle
            cx="320"
            cy="112"
            r="6"
            fill="white"
            stroke="currentColor"
            strokeWidth="2.5"
          />
        </svg>
      </div>
    );
  }

  if (variant === "stats") {
    const bars = [
      [470, 52],
      [505, 78],
      [540, 98],
      [575, 70],
      [610, 120],
    ] as const;

    return (
      <div aria-hidden className={common}>
        <div className="absolute inset-0 bg-gradient-to-l from-sky-50/60 via-transparent to-transparent dark:from-sky-950/20" />
        <svg
          viewBox="0 0 760 180"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <g fill="currentColor" opacity=".18">
            {bars.map(([x, h]) => (
              <rect
                key={x}
                x={x}
                y={158 - h}
                width="20"
                height={h}
                rx="4"
              />
            ))}
          </g>

          <path
            d="M95 137 C170 122 217 145 280 109 C342 74 382 97 438 72 C500 45 563 61 681 29"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {[
            [95, 137],
            [280, 109],
            [438, 72],
            [681, 29],
          ].map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r="5"
              fill="white"
              stroke="currentColor"
              strokeWidth="2.5"
            />
          ))}
        </svg>
      </div>
    );
  }

  if (variant === "places") {
    const pins = [
      [335, 74],
      [505, 113],
      [637, 55],
    ] as const;

    return (
      <div aria-hidden className={common}>
        <svg
          viewBox="0 0 760 180"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity=".2"
          >
            <path d="M0 38 C146 5 249 57 385 26 C520 -4 624 34 780 5" />
            <path d="M0 88 C130 54 253 105 391 73 C522 43 628 90 780 54" />
            <path d="M0 145 C145 104 260 164 398 126 C538 88 640 142 780 108" />
            <path d="M145 0 L87 180 M315 0 L257 180 M486 0 L428 180 M657 0 L599 180" />
          </g>

          {pins.map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <path
                d="M0 -26 C-17 -26 -29 -14 -29 2 C-29 22 0 49 0 49 C0 49 29 22 29 2 C29 -14 17 -26 0 -26 Z"
                fill="currentColor"
                opacity=".18"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle
                cx="0"
                cy="1"
                r="8"
                fill="white"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (variant === "vehicle") {
    return (
      <div aria-hidden className={common}>
        <div className="absolute inset-0 bg-gradient-to-l from-sky-50/70 via-sky-50/15 to-transparent dark:from-sky-950/25 dark:via-transparent" />

        <Image
          src="/visuals/vehicle-tesla-header.png"
          alt=""
          width={2172}
          height={724}
          priority
          className="absolute right-2 top-1/2 h-[92%] w-auto -translate-y-1/2 object-contain opacity-70 sm:right-5 dark:opacity-45"
        />
      </div>
    );
  }

  if (variant === "document") {
    return (
      <div aria-hidden className={common}>
        <div className="absolute inset-0 bg-gradient-to-l from-sky-50/65 via-transparent to-transparent dark:from-sky-950/20" />
        <svg
          viewBox="0 0 760 180"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <rect
            x="430"
            y="23"
            width="195"
            height="138"
            rx="12"
            fill="currentColor"
            opacity=".07"
            stroke="currentColor"
            strokeWidth="2.5"
          />

          <path
            d="M462 57 H581 M462 78 H594 M462 99 H553"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".55"
          />

          <g fill="currentColor" opacity=".3">
            <rect x="463" y="122" width="19" height="25" rx="3" />
            <rect x="493" y="110" width="19" height="37" rx="3" />
            <rect x="523" y="96" width="19" height="51" rx="3" />
            <rect x="553" y="116" width="19" height="31" rx="3" />
          </g>

          <path
            d="M110 140 C193 111 246 138 330 103 C370 87 399 72 430 62"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (variant === "tools") {
    return (
      <div aria-hidden className={common}>
        <svg
          viewBox="0 0 760 180"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity=".7"
          >
            <path d="M325 47 H690" />
            <path d="M285 91 H650" />
            <path d="M355 135 H720" />
          </g>

          <g fill="white" stroke="currentColor" strokeWidth="3">
            <circle cx="470" cy="47" r="12" />
            <circle cx="550" cy="91" r="12" />
            <circle cx="480" cy="135" r="12" />
          </g>

          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity=".14"
          >
            <path d="M60 28 C175 5 233 61 338 37" />
            <path d="M40 154 C158 120 242 166 355 126" />
          </g>
        </svg>
      </div>
    );
  }

  if (variant === "calendar") {
    const cells = [
      [447, 72],
      [487, 72],
      [527, 72],
      [567, 72],
      [447, 106],
      [487, 106],
      [527, 106],
      [567, 106],
      [447, 140],
      [487, 140],
      [527, 140],
      [567, 140],
    ] as const;

    return (
      <div aria-hidden className={common}>
        <div className="absolute inset-0 bg-gradient-to-l from-sky-50/60 via-transparent to-transparent dark:from-sky-950/20" />
        <svg
          viewBox="0 0 760 180"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <rect
            x="408"
            y="28"
            width="205"
            height="139"
            rx="16"
            fill="currentColor"
            opacity=".06"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M409 61 H613 M449 19 V42 M572 19 V42"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {cells.map(([x, y], index) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="22"
              height="17"
              rx="4"
              fill="currentColor"
              opacity={index === 6 ? ".42" : ".13"}
            />
          ))}

          <path
            d="M92 137 C183 102 256 145 349 103 C376 90 392 77 410 68"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }


  const gps = variant === "gps";
  const path = gps
    ? "M18 123 C94 92 116 148 187 116 C253 85 267 44 337 72 C411 102 431 132 500 105 C569 78 592 34 744 48"
    : "M18 128 C87 97 134 104 189 82 C251 57 275 121 338 106 C404 90 430 52 497 75 C566 99 601 125 744 59";

  return (
    <div aria-hidden className={common}>
      <div className="absolute inset-0 bg-gradient-to-l from-sky-50/70 via-transparent to-transparent dark:from-sky-950/20" />
      <svg viewBox="0 0 760 180" className="h-full w-full" preserveAspectRatio="none">
        <g fill="none" stroke="currentColor" strokeWidth="0.8" opacity=".17">
          <path d="M0 42 C130 12 216 54 335 26 C448 0 571 38 760 10" />
          <path d="M0 66 C116 41 220 81 347 52 C481 21 600 70 760 38" />
          <path d="M0 153 C129 117 242 173 359 142 C482 110 604 159 760 119" />
          <path d="M120 0 L62 180 M264 0 L206 180 M414 0 L356 180 M576 0 L518 180 M710 0 L652 180" />
        </g>
        <path d={path} fill="none" stroke="currentColor" strokeWidth={gps ? 3.2 : 3} strokeLinecap="round" strokeLinejoin="round" />
        {(gps
          ? [[92, 105], [187, 116], [337, 72], [500, 105], [650, 51]]
          : [[86, 100], [189, 82], [338, 106], [497, 75], [635, 91]]
        ).map(([cx, cy], index) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={index === 0 || index === 4 ? 7 : 4.5} fill="white" stroke="currentColor" strokeWidth="2.5" />
            {(index === 0 || index === 4) && <circle cx={cx} cy={cy} r="2" fill="currentColor" />}
          </g>
        ))}
        {!gps && (
          <g opacity=".5">
            <rect x="548" y="27" width="8" height="25" rx="2" fill="currentColor" />
            <rect x="561" y="17" width="8" height="35" rx="2" fill="currentColor" />
            <rect x="574" y="9" width="8" height="43" rx="2" fill="currentColor" />
            <rect x="587" y="1" width="8" height="51" rx="2" fill="currentColor" />
          </g>
        )}
      </svg>
    </div>
  );
}
