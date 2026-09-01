import Image from "next/image";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { maybeSeedFromEnv, usersTableIsEmpty } from "../../lib/auth/actions";
import { validateSession } from "../../lib/auth/session";
import { BrandWordmark } from "../../components/BrandWordmark";
import { LocaleSwitcher, type Locale } from "../../components/LocaleSwitcher";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Skip the login page.
  if (await validateSession()) {
    redirect("/");
  }

  // Honour INITIAL_ADMIN_PASSWORD by seeding on first visit.
  await maybeSeedFromEnv();

  const bootstrap = await usersTableIsEmpty();
  const t = await getTranslations("auth");

  const cookieLocale = (await cookies()).get("drivechronik_locale")?.value;
  const locale: Locale = cookieLocale === "en" ? "en" : "de";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/drivechronik-logo.png"
              alt=""
              aria-hidden="true"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 object-contain"
              priority
            />
            <h1>
              <BrandWordmark size="md" />
            </h1>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {bootstrap ? t("setupSubtitle") : t("loginSubtitle")}
          </p>
        </div>
        <LoginForm bootstrap={bootstrap} />
      </div>
      <LocaleSwitcher initial={locale} variant="inline" />
    </main>
  );
}
