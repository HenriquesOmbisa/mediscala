/** Aligns with web `getPeriod` / availability backfill (manhã 6–13h, tarde 14–21h, noite resto). */
export type AvailabilityPeriod = "MORNING" | "AFTERNOON" | "NIGHT";

export function shiftPeriodFromDate(d: Date): AvailabilityPeriod {
  const h = d.getHours();
  if (h >= 6 && h < 14) return "MORNING";
  if (h >= 14 && h < 22) return "AFTERNOON";
  return "NIGHT";
}

/** Local calendar date `YYYY-MM-DD` from Date (browser/API server locale). */
export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function availabilityPeriodFromSlot(
  startTime: string,
  explicit?: string | null,
): AvailabilityPeriod {
  if (
    explicit === "MORNING" ||
    explicit === "AFTERNOON" ||
    explicit === "NIGHT"
  ) {
    return explicit;
  }
  const part = startTime.split(":")[0];
  const h = parseInt(part ?? "0", 10);
  if (Number.isNaN(h)) return "NIGHT";
  if (h >= 6 && h < 14) return "MORNING";
  if (h >= 14 && h < 22) return "AFTERNOON";
  return "NIGHT";
}
