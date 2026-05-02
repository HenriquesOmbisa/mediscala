import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ShiftGridRow } from "@/lib/shift-calendar";
import { assignedCount } from "@/lib/shift-calendar";

export function ShiftFillBadge({
  shift,
  className = "",
}: {
  shift: ShiftGridRow;
  className?: string;
}) {
  const assigned = assignedCount(shift);
  const required = Number(shift.required_count);

  const base =
    "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border";

  if (assigned >= required) {
    return (
      <span
        className={`${base} text-emerald-700 bg-emerald-50/90 border-emerald-200/80 ${className}`}
      >
        <CheckCircle2 className="size-3 shrink-0 opacity-90" />
        Completo · {assigned}/{required}
      </span>
    );
  }
  if (assigned > 0) {
    return (
      <span
        className={`${base} text-amber-800 bg-amber-50/90 border-amber-200/70 ${className}`}
      >
        <AlertTriangle className="size-3 shrink-0 opacity-90" />
        Parcial · {assigned}/{required}
      </span>
    );
  }
  return (
    <span
      className={`${base} text-rose-800 bg-rose-50/90 border-rose-200/70 ${className}`}
    >
      <XCircle className="size-3 shrink-0 opacity-90" />
      Em falta · 0/{required}
    </span>
  );
}
