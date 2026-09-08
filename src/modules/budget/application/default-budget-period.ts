export const DEFAULT_BUDGET_TIME_ZONE = "America/Bogota";

export function buildCurrentMonthStartForTimeZone({
  now,
  timeZone = DEFAULT_BUDGET_TIME_ZONE,
}: {
  readonly now: Date;
  readonly timeZone?: string;
}) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new Error("Unable to derive budget month from time zone.");
  }

  return `${year}-${month}`;
}
