import Image from "next/image";
import { getTranslations } from "next-intl/server";

export async function DashboardHero() {
  const t = await getTranslations("dashboard.hero");

  return (
    <section className="relative min-h-[145px] overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-white via-white to-sky-50/60 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:via-neutral-900 dark:to-sky-950/20">
      <Image
        src="/visuals/vehicle-tesla-header.png"
        alt=""
        width={2172}
        height={724}
        priority
        className="pointer-events-none absolute right-0 top-1/2 h-full w-auto -translate-y-1/2 object-contain opacity-75 dark:opacity-40"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/10 dark:from-neutral-900 dark:via-neutral-900/95 dark:to-neutral-900/10"
      />

      <div className="relative z-10 flex min-h-[145px] max-w-2xl flex-col justify-center px-5 py-5 sm:px-6">
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {t("eyebrow")}
        </p>

        <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-2xl">
          {t("title")}
        </h1>

        <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
          {t("subtitle")}
        </p>
      </div>
    </section>
  );
}
