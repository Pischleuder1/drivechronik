import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyYearlyInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;

  const query = new URLSearchParams();
  query.set("view", "yearly");

  if (params.year) {
    query.set("year", params.year);
  }


  if (
    params.view === "all" ||
    params.view === "business" ||
    params.view === "customers"
  ) {
    query.set("destination", params.view);
  }

  redirect(`/insights?${query.toString()}`);
}
