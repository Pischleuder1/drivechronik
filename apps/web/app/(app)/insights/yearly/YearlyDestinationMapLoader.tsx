"use client";

import dynamic from "next/dynamic";

import type { YearlyDestinationMapProps } from "./YearlyDestinationMap";

const YearlyDestinationMap = dynamic(
  () =>
    import("./YearlyDestinationMap").then(
      (module) => module.YearlyDestinationMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 sm:h-96" />
    ),
  },
);

export function YearlyDestinationMapLoader(
  props: YearlyDestinationMapProps,
) {
  return <YearlyDestinationMap {...props} />;
}
