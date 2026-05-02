import type { AvailabilityPeriod } from "./shift-period.js";

const WEEKDAY_SHORT_TO_PG: Record<string, string> = {
  Sun: "SUN",
  Mon: "MON",
  Tue: "TUE",
  Wed: "WED",
  Thu: "THU",
  Fri: "FRI",
  Sat: "SAT",
};

/**
 * Calendar weekday, clock period and local date for a shift instant in a fixed IANA timezone.
 * Matches how clinicians pick “dia + período” in Portugal regardless of server TZ (UTC vs local).
 */
export function shiftInstantInTimezone(
  instant: Date,
  timeZone: string,
): {
  dayOfWeekEnum: string;
  period: AvailabilityPeriod;
  localCalendarDate: string;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const wRaw = get("weekday").replace(/\.$/, "");
  const dayOfWeekEnum = WEEKDAY_SHORT_TO_PG[wRaw] ?? "MON";

  const hour = Number.parseInt(get("hour"), 10);
  let period: AvailabilityPeriod;
  if (hour >= 6 && hour < 14) period = "MORNING";
  else if (hour >= 14 && hour < 22) period = "AFTERNOON";
  else period = "NIGHT";

  const localCalendarDate = `${get("year")}-${get("month")}-${get("day")}`;

  return { dayOfWeekEnum, period, localCalendarDate };
}
