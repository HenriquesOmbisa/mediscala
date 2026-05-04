import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { CheckCircle2, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  department_id?: string | null;
  assignments: AssignmentDetail[] | string | null;
};

type Candidate = {
  id: string;
  name: string;
  specialty: string | null;
  contractHoursWeek: number;
  workedHoursWeek: number;
  shiftsThisWeek: number;
  hoursSinceLastShift: number;
  score: number;
  status: "ideal" | "warning" | "critical";
  reasons?: string[];
};

function toDatetimeLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function safeFormatDateTime(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "PPp", { locale: pt });
}

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

function SelectableCandidateCard({
  candidate,
  selected,
  onToggle,
}: {
  candidate: Candidate;
  selected: boolean;
  onToggle: () => void;
}) {
  const pct = Math.min(
    100,
    Math.round(
      (candidate.workedHoursWeek / (candidate.contractHoursWeek || 40)) * 100,
    ),
  );

  const statusStyles = {
    ideal: {
      badge: "text-emerald-800 bg-emerald-50/95 border-emerald-200/80",
      bar: "bg-emerald-500",
      label: "Ideal",
    },
    warning: {
      badge: "text-amber-900 bg-amber-50/95 border-amber-200/75",
      bar: "bg-amber-400",
      label: "Quase no limite",
    },
    critical: {
      badge: "text-rose-900 bg-rose-50/95 border-rose-200/75",
      bar: "bg-rose-500",
      label: "Não recomendado",
    },
  }[candidate.status];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left p-3.5 rounded-2xl border transition-all shadow-sm ${
        selected
          ? "border-teal-300 bg-teal-50/70 ring-2 ring-teal-100"
          : "border-slate-200/70 bg-card hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {candidate.name}
          </p>
          {candidate.specialty && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {candidate.specialty}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-100 border border-teal-200 px-2 py-1 rounded-full">
              <CheckCircle2 className="size-3.5" />
              Selecionado
            </span>
          )}
          <span
            className={`text-[11px] font-medium border px-2.5 py-1 rounded-full shrink-0 ${statusStyles.badge}`}
          >
            {statusStyles.label}
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Horas esta semana</span>
          <span>
            {candidate.workedHoursWeek}h / {candidate.contractHoursWeek}h
          </span>
        </div>
        <div className="h-2 bg-muted/80 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${statusStyles.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {candidate.reasons && candidate.reasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
          {candidate.reasons.slice(0, 2).map((reason) => (
            <li key={`${candidate.id}-${reason}`} className="flex gap-2">
              <span className="text-teal-600 shrink-0">·</span>
              <span className="leading-snug">{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </button>
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
  const canManage =
    authRole === "HOSPITAL_ADMIN" || authRole === "MANAGER";

  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTab, setEditTab] = useState("dados");
  const [editCandidateSearch, setEditCandidateSearch] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSelectedUsers, setEditSelectedUsers] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({
    name: "",
    departmentId: undefined as string | undefined,
    startDatetime: "",
    endDatetime: "",
    requiredSpecialty: "",
    requiredCount: 1,
  });

  const { data: editCandidates, isLoading: editCandidatesLoading } = useQuery({
    queryKey: [
      "shift-edit-suggest",
      shiftId,
      editForm.departmentId,
      editForm.startDatetime,
      editForm.endDatetime,
      editForm.requiredSpecialty,
      editForm.requiredCount,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (editForm.departmentId) params.set("departmentId", editForm.departmentId);
      if (editForm.startDatetime)
        params.set("startDatetime", new Date(editForm.startDatetime).toISOString());
      if (editForm.endDatetime)
        params.set("endDatetime", new Date(editForm.endDatetime).toISOString());
      if (editForm.requiredSpecialty.trim())
        params.set("requiredSpecialty", editForm.requiredSpecialty.trim());
      params.set("requiredCount", String(Math.max(1, editForm.requiredCount || 1)));
      if (shiftId) params.set("excludeShiftId", shiftId);
      const res = await api.get(`/shifts/suggest?${params.toString()}`);
      return res.data.data as Candidate[];
    },
    enabled:
      showEdit &&
      !!editForm.departmentId &&
      !!editForm.startDatetime &&
      !!editForm.endDatetime,
  });

  const filteredEditCandidates = useMemo(() => {
    const q = editCandidateSearch.trim().toLowerCase();
    if (!editCandidates) return [] as Candidate[];
    if (!q) return editCandidates;
    return editCandidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.specialty ?? "").toLowerCase().includes(q),
    );
  }, [editCandidates, editCandidateSearch]);

  const deleteShift = useMutation({
    mutationFn: (id: string) => api.delete(`/shifts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["department-shifts"] });
      onOpenChange(false);
    },
  });

  const editShift = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name: string;
      requiredSpecialty: string | null;
      requiredCount: number;
    }) => api.patch(`/shifts/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-detail", shiftId] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["department-shifts"] });
    },
  });

  const assignUsers = useMutation({
    mutationFn: ({ sid, userIds }: { sid: string; userIds: string[] }) =>
      api.post(`/shifts/${sid}/assign`, { userIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-detail", shiftId] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["department-shifts"] });
    },
  });

  const unassignUser = useMutation({
    mutationFn: ({ sid, userId }: { sid: string; userId: string }) =>
      api.delete(`/shifts/${sid}/assign/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-detail", shiftId] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["department-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["coverage"] });
    },
  });

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
  const assignedUserIds = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.user_id))),
    [assignments],
  );

  const candidateById = useMemo(() => {
    const m = new Map<string, Candidate>();
    for (const c of editCandidates ?? []) m.set(c.id, c);
    return m;
  }, [editCandidates]);

  const assignmentNameByUser = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assignments) {
      m.set(a.user_id, a.user_name ?? a.user_email ?? "Utilizador");
    }
    return m;
  }, [assignments]);

  const normalizedSelectedUsers = useMemo(
    () => Array.from(new Set(editSelectedUsers)),
    [editSelectedUsers],
  );

  const toAddUserIds = useMemo(
    () => normalizedSelectedUsers.filter((id) => !assignedUserIds.includes(id)),
    [normalizedSelectedUsers, assignedUserIds],
  );

  const toRemoveUserIds = useMemo(
    () => assignedUserIds.filter((id) => !normalizedSelectedUsers.includes(id)),
    [assignedUserIds, normalizedSelectedUsers],
  );

  const hasSubstitutions = toAddUserIds.length > 0 && toRemoveUserIds.length > 0;
  const editSaving =
    editShift.isPending || assignUsers.isPending || unassignUser.isPending;

  function toggleEditCandidate(id: string) {
    setEditSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

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
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg rounded-l-3xl border-l border-slate-200/70 overflow-y-auto">
        <SheetHeader className="text-left pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="text-lg">Detalhe do turno</SheetTitle>
              <SheetDescription>
                Informação da escala e colaboradores atribuídos.
                {canMarkAttendance && (
                  <span className="block mt-1">
                    Marque presença no dia — compareceu ou não compareceu.
                  </span>
                )}
              </SheetDescription>
            </div>
            {canManage && shift && (
              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-500 hover:text-[#0B1F3A]"
                  onClick={() => {
                    setEditForm({
                      name: shift.name,
                      departmentId: shift.department_id ?? undefined,
                      startDatetime: toDatetimeLocalInput(shift.start_datetime),
                      endDatetime: toDatetimeLocalInput(shift.end_datetime),
                      requiredSpecialty: shift.required_specialty ?? "",
                      requiredCount: Number(shift.required_count),
                    });
                    setEditSelectedUsers(
                      Array.from(new Set(assignments.map((a) => a.user_id))),
                    );
                    setEditCandidateSearch("");
                    setEditTab("dados");
                    setEditError(null);
                    setShowEdit(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-500 hover:text-red-600"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
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

    {/* ── Delete confirmation ── */}
    <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar turno?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acção é irreversível. O turno e todas as atribuições serão
            apagados permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-red-600 hover:bg-red-700"
            disabled={deleteShift.isPending}
            onClick={() => {
              if (shiftId) deleteShift.mutate(shiftId);
            }}
          >
            {deleteShift.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Eliminar"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* ── Edit dialog ── */}
    <Dialog open={showEdit} onOpenChange={setShowEdit}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar turno</DialogTitle>
        </DialogHeader>
        <Tabs value={editTab} onValueChange={setEditTab} className="py-2 min-h-0 flex-1 flex flex-col">
          <TabsList className="grid grid-cols-2 w-full rounded-xl gap-2 p-1 h-auto">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="utilizadores">Selecionar utilizadores</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4 min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-1.5 md:col-span-2">
                <Label>Nome</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="rounded-xl h-10"
                />
              </div>
              <div className="grid gap-1.5 md:col-span-2">
                <Label>Horário</Label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {safeFormatDateTime(editForm.startDatetime)} →{" "}
                  {safeFormatDateTime(editForm.endDatetime)}
                </div>
                <p className="text-xs text-slate-500">
                  Departamento e datas são fixos na edição deste turno.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label>Especialidade</Label>
                <Input
                  value={editForm.requiredSpecialty}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      requiredSpecialty: e.target.value,
                    }))
                  }
                  className="rounded-xl h-10"
                  placeholder="Opcional"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Nº de vagas</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={editForm.requiredCount}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      requiredCount: Number(e.target.value),
                    }))
                  }
                  className="rounded-xl h-10"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="utilizadores" className="mt-4 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Colaboradores do departamento com estado de disponibilidade.
                Ao guardar, aplicamos adições, remoções e substituições.
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-700">
                Selecionados: <span className="font-semibold">{normalizedSelectedUsers.length}</span>
                {hasSubstitutions && (
                  <span className="ml-2 text-teal-700 font-medium">• com substituições automáticas</span>
                )}
                {toAddUserIds.length > 0 && (
                  <span className="ml-2">• +{toAddUserIds.length} adicionar</span>
                )}
                {toRemoveUserIds.length > 0 && (
                  <span className="ml-2">• -{toRemoveUserIds.length} remover</span>
                )}
              </div>

              <div className="max-w-sm">
                <Input
                  value={editCandidateSearch}
                  onChange={(e) => setEditCandidateSearch(e.target.value)}
                  className="rounded-xl h-10"
                  placeholder="Pesquisar colaborador ou especialidade"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {normalizedSelectedUsers.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Nenhum utilizador selecionado.
                  </span>
                )}
                {normalizedSelectedUsers.map((uid) => (
                  <Badge
                    key={uid}
                    variant="secondary"
                    className="rounded-full border border-teal-200 bg-teal-50 text-teal-700"
                  >
                    <CheckCircle2 className="mr-1 size-3.5" />
                    {candidateById.get(uid)?.name ?? assignmentNameByUser.get(uid) ?? "Utilizador"}
                    <button
                      type="button"
                      onClick={() =>
                        setEditSelectedUsers((prev) => prev.filter((x) => x !== uid))
                      }
                      className="ml-1 inline-flex items-center justify-center rounded-full p-0.5 text-teal-700/80 hover:bg-teal-200/70 hover:text-teal-900"
                      aria-label="Remover utilizador selecionado"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {!editForm.departmentId && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Seleciona primeiro o departamento na tab Dados para obter sugestões.
                </p>
              )}

              {editCandidatesLoading && (
                <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm">A calcular sugestões...</span>
                </div>
              )}

              {!editCandidatesLoading && filteredEditCandidates.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum colaborador encontrado para este filtro.
                </p>
              )}

              {!editCandidatesLoading && filteredEditCandidates.length > 0 && (
                <ScrollArea className="h-[42vh] max-h-[22rem] rounded-xl border border-slate-200/70 p-3">
                  <div className="space-y-3">
                    {filteredEditCandidates.map((c) => (
                      <SelectableCandidateCard
                        key={c.id}
                        candidate={c}
                        selected={normalizedSelectedUsers.includes(c.id)}
                        onToggle={() => toggleEditCandidate(c.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
        {editError && <p className="text-xs text-red-600">{editError}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setShowEdit(false)}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-xl bg-[#0B1F3A] hover:bg-[#0f2a4d]"
            disabled={
              editSaving ||
              !editForm.name.trim() ||
              editForm.requiredCount < 1
            }
            onClick={async () => {
              if (!shiftId) return;
              const nextCount = Math.max(1, Math.round(editForm.requiredCount));
              setEditError(null);
              try {
                await editShift.mutateAsync({
                  id: shiftId,
                  name: editForm.name.trim(),
                  requiredSpecialty: editForm.requiredSpecialty.trim() || null,
                  requiredCount: nextCount,
                });

                for (const userId of toRemoveUserIds) {
                  await unassignUser.mutateAsync({ sid: shiftId, userId });
                }

                if (toAddUserIds.length > 0) {
                  await assignUsers.mutateAsync({
                    sid: shiftId,
                    userIds: toAddUserIds,
                  });
                }

                setShowEdit(false);
                setEditError(null);
              } catch {
                setEditError(
                  "Não foi possível guardar todas as alterações da equipa. Verifica disponibilidade e tenta novamente.",
                );
              }
            }}
          >
            {editSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
