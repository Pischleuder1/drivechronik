"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { useLocale } from "next-intl";

export function DashboardClock({
  timeZone,
}: {
  timeZone: string;
}) {
  const locale = useLocale();
  const [now, setNow] = useState<Date | null>(null);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    [locale, timeZone],
  );

  useEffect(() => {
    const update = () => setNow(new Date());

    update();
    const timer = window.setInterval(update, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5">
      <Clock3
        aria-hidden
        size={15}
        strokeWidth={1.8}
        className="text-neutral-400 dark:text-neutral-500"
      />
      <span className="font-medium tabular-nums text-neutral-700 dark:text-neutral-200">
        {now ? formatter.format(now) : "--:--"}
      </span>
    </span>
  );
}
