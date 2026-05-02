import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarClock, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export type DepartmentSheetRow = {
  id: string;
  name: string;
  collaborator_count?: number;
};

type DepartmentShiftRow = {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime: string;
  required_count?: number;
  assignments?: Array<{ id: string; status: string }> | string | null;
};

function parseAssignmentsCount(assignments: DepartmentShiftRow["assignments"]): number {
  if (!assignments) return 0;
  if (Array.isArray(assignments)) return assignments.length;
  if (typeof assignments === "string") {
    try {
      const parsed = JSON.parse(assignments) as unknown;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

export function DepartmentDetailSheet({
  department,
  open,
  onOpenChange,
}: {
  department: DepartmentSheetRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: shifts, isLoading } = useQuery({
    queryKey: ["department-shifts", department?.id],
    enabled: open && !!department?.id,
    queryFn: async () => {
      const res = await api.get(`/departments/${department?.id}/shifts`);
      return (res.data.data ?? []) as DepartmentShiftRow[];
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg rounded-l-3xl border-l border-slate-200/70 overflow-y-auto">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-[#0B1F3A]" />
            {department?.name ?? "Departamento"}
          </SheetTitle>
          <SheetDescription>
            {department?.collaborator_count ?? 0} colaborador
            {(department?.collaborator_count ?? 0) === 1 ? "" : "es"}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-10 justify-center text-slate-500">
            <Loader2 className="size-5 animate-spin" />
            <span>A carregar turnos...</span>
          </div>
        )}

        {!isLoading && (
          <div className="pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Turnos deste departamento</p>
              <Badge variant="secondary" className="rounded-lg">
                {shifts?.length ?? 0}
              </Badge>
            </div>

            <Separator />

            <ul className="space-y-2">
              {!shifts?.length && (
                <li className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-200 rounded-xl">
                  Sem turnos registados.
                </li>
              )}

              {shifts?.map((shift) => {
                const assigned = parseAssignmentsCount(shift.assignments);
                const required = shift.required_count ?? 0;
                return (
                  <li
                    key={shift.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-3"
                  >
                    <p className="text-sm font-medium text-slate-900">{shift.name}</p>
                    <p className="mt-1 text-xs text-slate-600 flex items-center gap-1.5">
                      <CalendarClock size={13} />
                      {format(new Date(shift.start_datetime), "dd/MM/yyyy HH:mm", { locale: pt })}
                      {" - "}
                      {format(new Date(shift.end_datetime), "dd/MM/yyyy HH:mm", { locale: pt })}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="rounded-lg text-[11px]">
                        Necessários: {required}
                      </Badge>
                      <Badge variant="outline" className="rounded-lg text-[11px]">
                        Atribuídos: {assigned}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
