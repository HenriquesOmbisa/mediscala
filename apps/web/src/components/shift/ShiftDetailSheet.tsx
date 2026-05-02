import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShiftFillBadge } from "@/components/shift/ShiftFillBadge";
import type { ShiftGridRow } from "@/lib/shift-calendar";
import { useAuthStore } from "@/store/auth.store";

type AssignmentDetail = {
  id: string;
  user_id: string;
  status: string;
  attendance_present?: boolean | null;
  user_name?: string | null;
  user_email?: string | null;
};

type ShiftDetailRow = ShiftGridRow & {
  assignments: AssignmentDetail[] | string | null;
};

function parseAssignments(
  raw: ShiftDetailRow["assignments"],
): AssignmentDetail[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw) as AssignmentDetail[];
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }
  return [];
}

function AttendanceBadge({
  attendancePresent,
}: {
  attendancePresent: boolean | null | undefined;
}) {
  if (attendancePresent === true) {
    return (
      <Badge className="mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-600">
        Compareceu
      </Badge>
    );
  }
  if (attendancePresent === false) {
    return (
      <Badge variant="destructive" className="mt-2 rounded-lg">
        Não compareceu
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="mt-2 rounded-lg">
      Por marcar
    </Badge>
  );
}

export function ShiftDetailSheet({
  shiftId,
  open,
  onOpenChange,
}: {
  shiftId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const authRole = useAuthStore((s) => s.user?.role);
  const canMarkAttendance =
    authRole === "HOSPITAL_ADMIN" || authRole === "MANAGER";

  const markAttendance = useMutation({
    mutationFn: async ({
      assignmentId,
      present,
      sid,
    }: {
      assignmentId: string;
      present: boolean;
      sid: string;
    }) => {
      await api.patch(
        `/shifts/${sid}/assignments/${assignmentId}/attendance`,
        { present },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-detail", shiftId] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["department-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["coverage"] });
    },
  });

  const { data: shift, isLoading } = useQuery({
    queryKey: ["shift-detail", shiftId],
    queryFn: async () => {
      const res = await api.get(`/shifts/${shiftId}/detail`);
      return res.data.data as ShiftDetailRow;
    },
    enabled: !!shiftId && open,
  });

  const assignments = shift ? parseAssignments(shift.assignments) : [];

  const gridShift: ShiftGridRow | null = shift
    ? {
        id: shift.id,
        name: shift.name,
        start_datetime: shift.start_datetime,
        end_datetime: shift.end_datetime,
        department_name: shift.department_name,
        required_specialty: shift.required_specialty,
        required_count: shift.required_count,
        assignments: assignments.map((a) => ({
          id: a.id,
          user_id: a.user_id,
          status: a.status,
        })),
      }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg rounded-l-3xl border-l border-slate-200/70 overflow-y-auto">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="text-lg">Detalhe do turno</SheetTitle>
          <SheetDescription>
            Informação da escala e colaboradores atribuídos.
            {canMarkAttendance && (
              <span className="block mt-1">
                Marque presença no dia — compareceu ou não compareceu.
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-12 text-muted-foreground justify-center">
            <Loader2 className="size-5 animate-spin" />
            <span>A carregar…</span>
          </div>
        )}

        {!isLoading && shift && gridShift && (
          <div className="space-y-5 pt-2">
            <div>
              <p className="text-base font-semibold text-slate-900 leading-snug">
                {shift.name}
              </p>
              <Badge variant="secondary" className="mt-2 rounded-lg">
                {shift.department_name}
              </Badge>
            </div>

            <div className="text-sm text-slate-600 space-y-1">
              <p>
                <span className="font-medium text-slate-700">Início: </span>
                {format(new Date(shift.start_datetime), "PPp", { locale: pt })}
              </p>
              <p>
                <span className="font-medium text-slate-700">Fim: </span>
                {format(new Date(shift.end_datetime), "PPp", { locale: pt })}
              </p>
              {shift.required_specialty && (
                <p>
                  <span className="font-medium text-slate-700">
                    Especialidade:{" "}
                  </span>
                  {shift.required_specialty}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ShiftFillBadge shift={gridShift} />
              <Badge variant="outline" className="rounded-full tabular-nums">
                Vagas necessárias: {String(shift.required_count)}
              </Badge>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-semibold text-slate-800 mb-3">
                Equipa ({assignments.length})
              </p>
              <ScrollArea className="max-h-72 rounded-xl border border-slate-200/60">
                <ul className="p-3 space-y-2">
                  {assignments.length === 0 && (
                    <li className="text-sm text-muted-foreground py-6 text-center">
                      Sem colaboradores atribuídos.
                    </li>
                  )}
                  {assignments.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm"
                    >
                      <p className="font-medium text-slate-900">
                        {a.user_name ?? "Utilizador"}
                      </p>
                      {a.user_email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {a.user_email}
                        </p>
                      )}
                      <AttendanceBadge attendancePresent={a.attendance_present} />
                      {canMarkAttendance && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                            disabled={
                              markAttendance.isPending ||
                              a.attendance_present === true
                            }
                            onClick={() => {
                              if (!shiftId) return;
                              markAttendance.mutate({
                                assignmentId: a.id,
                                present: true,
                                sid: shiftId,
                              });
                            }}
                          >
                            {markAttendance.isPending &&
                            markAttendance.variables?.assignmentId === a.id &&
                            markAttendance.variables?.present === true ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Compareceu"
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg border-red-200 text-red-800 hover:bg-red-50"
                            disabled={
                              markAttendance.isPending ||
                              a.attendance_present === false
                            }
                            onClick={() => {
                              if (!shiftId) return;
                              markAttendance.mutate({
                                assignmentId: a.id,
                                present: false,
                                sid: shiftId,
                              });
                            }}
                          >
                            {markAttendance.isPending &&
                            markAttendance.variables?.assignmentId === a.id &&
                            markAttendance.variables?.present === false ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Não compareceu"
                            )}
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
