import { getCalendarMonthStats } from "../../../lib/calendar";
import { buildCalendarGrid, isValidMonthParam } from "../../../lib/calendarGrid";
import { todayInAppTz } from "../../../lib/day";
import { getVehicles } from "../../../lib/queries";
import { MonthNav } from "./MonthNav";
import { CalendarVehicleSwitcher } from "./CalendarVehicleSwitcher";
import { MonthGrid } from "./MonthGrid";

import { NoVehicleState } from "../../../components/NoVehicleState";
import { Panel } from "../../../components/ui/Panel";

export const dynamic = "force-dynamic";

function currentMonthInAppTz(): string {
  return todayInAppTz().slice(0, 7);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; vehicle?: string }>;
}) {
  const { month: monthParam, vehicle } = await searchParams;
  const currentMonth = currentMonthInAppTz();
  const month =
    monthParam && isValidMonthParam(monthParam) ? monthParam : currentMonth;

  const vehicles = await getVehicles();

  if (vehicles.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Panel padding="sm">
          <MonthNav
            month={month}
            currentMonth={currentMonth}
            vehicleQuery=""
          />
        </Panel>
        <div className="mt-6">
          <NoVehicleState />
        </div>
      </div>
    );
  }

  const requested = vehicle ? Number(vehicle) : NaN;
  const current = vehicles.find((v) => v.id === requested) ?? vehicles[0]!;

  const vehicleQuery = vehicles.length > 1 ? `?vehicle=${current.id}` : "";

  const statsByDay = await getCalendarMonthStats(current.id, month);
  const today = todayInAppTz();
  const cells = buildCalendarGrid(month, statsByDay, today);

  return (
    <div className="mx-auto max-w-3xl">
      <Panel padding="sm">
        <MonthNav
          month={month}
          currentMonth={currentMonth}
          vehicleQuery={vehicleQuery}
        />

        {vehicles.length > 1 && (
          <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <CalendarVehicleSwitcher
              vehicles={vehicles}
              current={current.id}
              month={month}
            />
          </div>
        )}

      </Panel>

      <div className="mt-6">
        <MonthGrid cells={cells} vehicleQuery={vehicleQuery} />
      </div>
    </div>
  );
}
