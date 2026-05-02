import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
  addWeeks,
  endOfDay,
  startOfWeek,
} from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { publicAssetUrl } from "@/lib/public-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPeriod } from "@/lib/shift-calendar";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

export type UserSheetRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  specialty: string | null;
  contract_hours_week: number;
  department_name: string | null;
  avatar_url: string | null;
  active: boolean;
};

type UserShiftApiRow = {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime: string;
  department_name: string;
  required_specialty?: string | null;
  required_count: number | string;
  assignment_status: string;
};

type LeaveBlockRow = {
  id: string;
  starts_on: string;
  ends_on: string;
  type: string;
  status: string;
  reason: string | null;
};

type AvailabilityRow = {
  day_of_week: string;
  start_time: string;
  end_time: string;
  period: string | null;
};

const ROLES_PT: Record<string, string> = {
  HOSPITAL_ADMIN: "Admin",
  MANAGER: "Manager",
  COLLABORATOR: "Colaborador",
};

const DAY_PT: Record<string, string> = {
  MON: "Segunda",
  TUE: "Terça",
  WED: "Quarta",
  THU: "Quinta",
  FRI: "Sexta",
  SAT: "Sábado",
  SUN: "Domingo",
};

const PERIOD_PT: Record<string, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  NIGHT: "Noite",
};

const ABSENCE_PT: Record<string, string> = {
  SICK: "Baixa médica",
  PERSONAL: "Pessoal",
  EMERGENCY: "Emergência",
  VACATION: "Férias",
  OTHER: "Outro",
};

function shiftRangeIso() {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const until = endOfDay(addWeeks(monday, 5));
  return { from: monday.toISOString(), to: until.toISOString() };
}

export function UserDetailSheet({
  user,
  open,
  onOpenChange,
}: {
  user: UserSheetRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const authRole = useAuthStore((s) => s.user?.role);
  const canManageLeaves =
    authRole === "HOSPITAL_ADMIN" || authRole === "MANAGER";

  const range = useMemo(() => shiftRangeIso(), []);

  const [leaveStart, setLeaveStart] = useState<Date | undefined>();
  const [leaveEnd, setLeaveEnd] = useState<Date | undefined>();
  const [leaveType, setLeaveType] = useState<string>("VACATION");
  const [leaveStatus, setLeaveStatus] = useState<string>("APPROVED");
  const [leaveReason, setLeaveReason] = useState("");

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["user-shifts", user?.id, range.from, range.to],
    queryFn: async () => {
      const res = await api.get(`/users/${user!.id}/shifts`, {
        params: { from: range.from, to: range.to },
      });
      return res.data.data as UserShiftApiRow[];
    },
    enabled: open && !!user,
  });

  const { data: leaves, isLoading: leavesLoading } = useQuery({
    queryKey: ["user-leave-blocks", user?.id],
    queryFn: async () => {
      const res = await api.get(`/users/${user!.id}/leave-blocks`);
      return res.data.data as LeaveBlockRow[];
    },
    enabled: open && !!user,
  });

  const { data: availability, isLoading: availLoading } = useQuery({
    queryKey: ["user-availability", user?.id],
    queryFn: async () => {
      const res = await api.get(`/users/${user!.id}/availability`);
      return res.data.data as AvailabilityRow[];
    },
    enabled: open && !!user,
  });

  const createLeave = useMutation({
    mutationFn: async () => {
      if (!user || !leaveStart || !leaveEnd) throw new Error("Datas obrigatórias");
      await api.post(`/users/${user.id}/leave-blocks`, {
        startsOn: format(leaveStart, "yyyy-MM-dd"),
        endsOn: format(leaveEnd, "yyyy-MM-dd"),
        type: leaveType,
        status: leaveStatus,
        reason: leaveReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-leave-blocks", user?.id],
      });
      setLeaveStart(undefined);
      setLeaveEnd(undefined);
      setLeaveReason("");
      setLeaveType("VACATION");
      setLeaveStatus("APPROVED");
    },
  });

  const patchLeave = useMutation({
    mutationFn: async ({
      blockId,
      status,
    }: {
      blockId: string;
      status: string;
    }) => api.patch(`/users/${user!.id}/leave-blocks/${blockId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-leave-blocks", user?.id],
      });
    },
  });

  const deleteLeave = useMutation({
    mutationFn: async (blockId: string) =>
      api.delete(`/users/${user!.id}/leave-blocks/${blockId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-leave-blocks", user?.id],
      });
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg rounded-l-3xl border-l border-slate-200/70 overflow-y-auto">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="text-lg">Perfil do utilizador</SheetTitle>
          <SheetDescription>
            Dados, turnos, ausências planeadas e disponibilidade.
          </SheetDescription>
        </SheetHeader>

        {!user && null}

        {user && (
          <Tabs defaultValue="dados" className="mt-2 flex flex-col gap-0">
            <TabsList className="flex w-full flex-wrap gap-x-1 gap-y-2 rounded-xl bg-slate-100/80 border border-slate-200/60 p-1.5 min-h-10 mb-6">
              <TabsTrigger
                value="dados"
                className="flex-1 rounded-lg text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Dados
              </TabsTrigger>
              <TabsTrigger
                value="turnos"
                className="flex-1 rounded-lg text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Turnos
              </TabsTrigger>
              <TabsTrigger
                value="ausencias"
                className="flex-1 rounded-lg text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Ausências
              </TabsTrigger>
              <TabsTrigger
                value="disponibilidade"
                className="flex-1 rounded-lg text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Disponibilidade
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-0 pt-0 outline-none">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Avatar className="h-12 w-12 border border-slate-200">
                  <AvatarImage
                    src={publicAssetUrl(user.avatar_url) ?? undefined}
                  />
                  <AvatarFallback className="bg-teal-50 text-teal-800 text-sm font-semibold">
                    {user.name?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <p>
                  <span className="font-medium text-slate-700">Função: </span>
                  {ROLES_PT[user.role] ?? user.role}
                </p>
                <p>
                  <span className="font-medium text-slate-700">
                    Horas / semana:{" "}
                  </span>
                  {user.contract_hours_week}
                </p>
                <p>
                  <span className="font-medium text-slate-700">
                    Especialidade:{" "}
                  </span>
                  {user.specialty ?? "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-700">
                    Departamento:{" "}
                  </span>
                  {user.department_name ?? "—"}
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">Estado: </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      user.active
                        ? "bg-teal-50 text-teal-700 border-teal-200"
                        : "bg-red-50 text-red-600 border-red-200",
                    )}
                  >
                    {user.active ? "Ativo" : "Inativo"}
                  </Badge>
                </p>
              </div>
            </TabsContent>

            <TabsContent value="turnos" className="space-y-3 mt-0 pt-0 outline-none">
              <p className="text-xs text-muted-foreground">
                Semana atual e próximas ~5 semanas.
              </p>
              {shiftsLoading && (
                <div className="flex items-center gap-2 py-10 text-muted-foreground justify-center">
                  <Loader2 className="size-5 animate-spin" />
                  A carregar…
                </div>
              )}
              {!shiftsLoading && (!shifts?.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sem turnos neste intervalo.
                </p>
              ) : (
                <ScrollArea className="max-h-[420px] rounded-xl border border-slate-200/60">
                  <ul className="p-3 space-y-2">
                    {shifts.map((s) => (
                      <li
                        key={`${s.id}-${s.assignment_status}`}
                        className="rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2.5 text-sm space-y-1"
                      >
                        <div className="flex justify-between gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">
                            {s.name}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {getPeriod(s.start_datetime)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(s.start_datetime), "PPp", {
                            locale: pt,
                          })}{" "}
                          →{" "}
                          {format(new Date(s.end_datetime), "PPp", {
                            locale: pt,
                          })}
                        </p>
                        <div className="flex flex-wrap gap-2 items-center pt-1">
                          <Badge variant="secondary" className="text-[10px]">
                            {s.department_name}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {s.assignment_status}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ))}
            </TabsContent>

            <TabsContent value="ausencias" className="space-y-4 mt-0 pt-0 outline-none">
              {!canManageLeaves && (
                <p className="text-sm text-muted-foreground">
                  Apenas gestores podem criar ou alterar ausências planeadas.
                </p>
              )}

              {canManageLeaves && (
                <div className="rounded-xl border border-slate-200/70 p-4 space-y-3 bg-slate-50/40">
                  <p className="text-sm font-semibold text-slate-800">
                    Nova ausência
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Início</Label>
                      <DatePickerField
                        date={leaveStart}
                        onSelect={setLeaveStart}
                        placeholder="Data inicial"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fim</Label>
                      <DatePickerField
                        date={leaveEnd}
                        onSelect={setLeaveEnd}
                        placeholder="Data final"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={leaveType}
                        onValueChange={(v) => {
                          if (v != null) setLeaveType(v);
                        }}
                      >
                        <SelectTrigger className="rounded-xl h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            ["VACATION", "SICK", "PERSONAL", "EMERGENCY", "OTHER"] as const
                          ).map((t) => (
                            <SelectItem key={t} value={t}>
                              {ABSENCE_PT[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Estado</Label>
                      <Select
                        value={leaveStatus}
                        onValueChange={(v) => {
                          if (v != null) setLeaveStatus(v);
                        }}
                      >
                        <SelectTrigger className="rounded-xl h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pendente</SelectItem>
                          <SelectItem value="APPROVED">Aprovado</SelectItem>
                          <SelectItem value="REJECTED">Rejeitado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Motivo (opcional)</Label>
                    <Input
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      className="rounded-xl h-10"
                      placeholder="Notas internas"
                    />
                  </div>
                  <Button
                    type="button"
                    className="rounded-xl bg-[#0B1F3A] hover:bg-[#0f2a4d]"
                    disabled={
                      createLeave.isPending || !leaveStart || !leaveEnd
                    }
                    onClick={() => createLeave.mutate()}
                  >
                    {createLeave.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />A
                        guardar…
                      </>
                    ) : (
                      "Registar ausência"
                    )}
                  </Button>
                </div>
              )}

              <Separator />

              {leavesLoading && (
                <div className="flex items-center gap-2 py-8 text-muted-foreground justify-center">
                  <Loader2 className="size-5 animate-spin" />
                  A carregar…
                </div>
              )}

              {!leavesLoading && (
                <ScrollArea className="max-h-72 rounded-xl border border-slate-200/60">
                  <ul className="p-3 space-y-2">
                    {!leaves?.length ? (
                      <li className="text-sm text-muted-foreground py-6 text-center">
                        Sem registos de ausências planeadas.
                      </li>
                    ) : (
                      leaves.map((b) => (
                        <li
                          key={b.id}
                          className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm space-y-2"
                        >
                          <div className="flex justify-between gap-2 flex-wrap items-start">
                            <div>
                              <p className="font-medium text-slate-900">
                                {format(new Date(b.starts_on), "d MMM yyyy", {
                                  locale: pt,
                                })}{" "}
                                —{" "}
                                {format(new Date(b.ends_on), "d MMM yyyy", {
                                  locale: pt,
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {ABSENCE_PT[b.type] ?? b.type}
                              </p>
                              {b.reason && (
                                <p className="text-xs text-slate-600 mt-1">
                                  {b.reason}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {canManageLeaves ? (
                                <Select
                                  value={b.status}
                                  onValueChange={(v) => {
                                    if (v == null) return;
                                    patchLeave.mutate({
                                      blockId: b.id,
                                      status: v,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-8 rounded-lg w-[120px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="PENDING">
                                      Pendente
                                    </SelectItem>
                                    <SelectItem value="APPROVED">
                                      Aprovado
                                    </SelectItem>
                                    <SelectItem value="REJECTED">
                                      Rejeitado
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  {b.status === "PENDING"
                                    ? "Pendente"
                                    : b.status === "APPROVED"
                                      ? "Aprovado"
                                      : b.status === "REJECTED"
                                        ? "Rejeitado"
                                        : b.status}
                                </Badge>
                              )}
                              {canManageLeaves && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:bg-red-50 rounded-lg"
                                  disabled={deleteLeave.isPending}
                                  onClick={() => deleteLeave.mutate(b.id)}
                                  aria-label="Eliminar ausência"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent
              value="disponibilidade"
              className="space-y-3 mt-0 pt-0 outline-none"
            >
              {availLoading && (
                <div className="flex items-center gap-2 py-10 text-muted-foreground justify-center">
                  <Loader2 className="size-5 animate-spin" />
                  A carregar…
                </div>
              )}
              {!availLoading && (!availability?.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sem disponibilidade definida.
                </p>
              ) : (
                <ScrollArea className="max-h-[420px] rounded-xl border border-slate-200/60">
                  <ul className="p-3 space-y-2">
                    {availability.map((row) => (
                      <li
                        key={`${row.day_of_week}-${row.start_time}`}
                        className="rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2 text-sm flex flex-wrap justify-between gap-2"
                      >
                        <span className="font-medium text-slate-800">
                          {DAY_PT[row.day_of_week] ?? row.day_of_week}
                        </span>
                        <span className="text-muted-foreground">
                          {row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}
                          {row.period
                            ? ` · ${PERIOD_PT[row.period] ?? row.period}`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
