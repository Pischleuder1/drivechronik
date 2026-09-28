import { getTranslations } from "next-intl/server";
import { getCalendarMonthStats } from "../../../lib/calendar";
import { buildCalendarGrid, isValidMonthParam } from "../../../lib/calendarGrid";
import { todayInAppTz } from "../../../lib/day";
import { getActiveVehicle } from "../../../lib/activeVehicle";
import { getVehicles } from "../../../lib/queries";
import { MonthNav } from "./MonthNav";
import { MonthGrid } from "./MonthGrid";
import { MobileCalendarHero } from "./MobileCalendarHero";

import { NoVehicleState } from "../../../components/NoVehicleState";
import { Panel } from "../../../components/ui/Panel";
import { PageHeader } from "../../../components/ui/PageHeader";

export const dynamic = "force-dynamic";

function currentMonthInAppTz(): string {
  return todayInAppTz().slice(0, 7);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const currentMonth = currentMonthInAppTz();
  const t = await getTranslations("calendar");
  const month =
    monthParam && isValidMonthParam(monthParam) ? monthParam : currentMonth;

  const current = await getActiveVehicle();
  const vehicles = await getVehicles();

  if (!current) {
    return (
      <div className="w-full">
        <PageHeader
          visual="calendar"
          title={t("pageTitle")}
          className="mb-4"
        />
        <Panel padding="sm">
          <MonthNav
            month={month}
            currentMonth={currentMonth}
          />
        </Panel>
        <div className="mt-6">
          <NoVehicleState />
        </div>
      </div>
    );
  }

  const statsByDay = await getCalendarMonthStats(current.id, month);
  const today = todayInAppTz();
  const cells = buildCalendarGrid(month, statsByDay, today);

  return (
    <div className="mobile-calendar-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobileCalendarHero
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          displayName: vehicle.displayName,
        }))}
        initialVehicleId={current.id}
        displayName={current.displayName}
        pageTitle={t("pageTitle")}
      />

      <div className="hidden md:block">
        <PageHeader
          visual="calendar"
          title={t("pageTitle")}
          className="mb-4"
        />

        <Panel padding="sm">
          <MonthNav
            month={month}
            currentMonth={currentMonth}
          />
        </Panel>
      </div>

      <div className="relative z-10 -mt-8 rounded-[20px] border border-neutral-200 bg-white p-3 shadow-lg shadow-black/10 md:hidden">
        <MonthNav
          month={month}
          currentMonth={currentMonth}
          compact
        />
      </div>

      <div className="mt-3 md:mt-6">
        <MonthGrid cells={cells} />
      </div>
    </div>
  );
}
