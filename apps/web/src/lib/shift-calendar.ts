import {
  endOfDay,
  startOfDay,
} from "date-fns";

export type ShiftAssignmentLite = {
  id: string;
  user_id: string;
  status: string;
};

export type ShiftGridRow = {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime: string;
  department_name: string;
  required_specialty?: string | null;
  required_count: number | string;
  assignments: ShiftAssignmentLite[] | null;
};

export const PERIODS = ["Manhã", "Tarde", "Noite"] as const;
export type ShiftPeriod = (typeof PERIODS)[number];

export const PERIOD_CONFIG: Record<
  ShiftPeriod,
  { startH: number; endH: number; endNextDay: boolean; label: string }
> = {
  Manhã: { startH: 8, endH: 16, endNextDay: false, label: "08:00 – 16:00" },
  Tarde: { startH: 16, endH: 0, endNextDay: true, label: "16:00 – 00:00" },
  Noite: { startH: 0, endH: 8, endNextDay: false, label: "00:00 – 08:00" },
};

export function shiftOverlapsDay(shift: ShiftGridRow, day: Date): boolean {
  const start = new Date(shift.start_datetime);
  const end = new Date(shift.end_datetime);
  return start < endOfDay(day) && end > startOfDay(day);
}

/** Maps shift start hour to Manhã / Tarde / Noite (aligned with hospital-style blocks). */
export function getPeriod(isoStart: string): ShiftPeriod {
  const h = new Date(isoStart).getHours();
  if (h >= 6 && h < 14) return "Manhã";
  if (h >= 14 && h < 22) return "Tarde";
  return "Noite";
}

export function datetimeForPeriod(
  day: Date,
  period: ShiftPeriod,
): { start: string; end: string } {
  const cfg = PERIOD_CONFIG[period];
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const startD = new Date(day);
  startD.setHours(cfg.startH, 0, 0, 0);

  const endD = new Date(day);
  if (cfg.endNextDay) endD.setDate(endD.getDate() + 1);
  endD.setHours(cfg.endH, 0, 0, 0);

  return { start: fmt(startD), end: fmt(endD) };
}

export function assignedCount(shift: ShiftGridRow): number {
  return shift.assignments?.filter((a) => a.status === "ASSIGNED").length ?? 0;
}

export function shiftFillState(shift: ShiftGridRow): "full" | "partial" | "empty" {
  const assigned = assignedCount(shift);
  const required = Number(shift.required_count);
  if (assigned >= required) return "full";
  if (assigned > 0) return "partial";
  return "empty";
}
