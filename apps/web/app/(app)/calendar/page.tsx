import { getTranslations } from "next-intl/server";
import { getCalendarMonthStats } from "../../../lib/calendar";
import { buildCalendarGrid, isValidMonthParam } from "../../../lib/calendarGrid";
import { todayInAppTz } from "../../../lib/day";
import { getActiveVehicle } from "../../../lib/activeVehicle";
import { MonthNav } from "./MonthNav";
import { MonthGrid } from "./MonthGrid";

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
        <MonthGrid cells={cells} />
      </div>
    </div>
  );
}
