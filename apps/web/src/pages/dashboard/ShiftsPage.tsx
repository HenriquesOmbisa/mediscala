import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { pt } from "date-fns/locale";
import { api } from "../../lib/api";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShiftFillBadge } from "@/components/shift/ShiftFillBadge";
import { ShiftDetailSheet } from "@/components/shift/ShiftDetailSheet";
import { DatePickerField } from "@/components/ui/date-picker";
import {
  PERIODS,
  PERIOD_CONFIG,
  assignedCount,
  datetimeForPeriod,
  getPeriod,
  shiftOverlapsDay,
  type ShiftGridRow,
  type ShiftPeriod,
} from "@/lib/shift-calendar";
import { departmentTriggerLabel } from "@/lib/department-label";

type ShiftRow = ShiftGridRow;

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

type Period = ShiftPeriod;

const fmtShort = (iso: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));

// ─── Candidate card ───────────────────────────────────────────────────────────

function CandidateCard({
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
      className={`w-full text-left p-4 rounded-2xl border transition-all shadow-sm ${
        selected
          ? "border-slate-400/80 bg-slate-50 ring-2 ring-slate-200/90"
          : "border-slate-200/70 bg-card hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
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
        <span
          className={`text-[11px] font-medium border px-2.5 py-1 rounded-full shrink-0 ${statusStyles.badge}`}
        >
          {statusStyles.label}
        </span>
      </div>
      <div className="space-y-2">
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
        <ul className="mt-3 space-y-1.5 text-[11px] text-slate-600 border-t border-slate-100 pt-3">
          {candidate.reasons.map((line, ri) => (
            <li key={ri} className="flex gap-2">
              <span className="text-teal-600 shrink-0">·</span>
              <span className="leading-snug">{line}</span>
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

// ─── Default form ─────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name: "",
  departmentId: undefined as string | undefined,
  day: undefined as Date | undefined,
  period: undefined as Period | undefined,
  requiredSpecialty: "",
  requiredCount: 1,
  startDatetime: "",
  endDatetime: "",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function ShiftsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const departmentFilter = useRouterState({
    select: (st) =>
      (st.location.search as { departmentId?: string }).departmentId,
  });

  // ── View state
  const [view, setView] = useState<"week" | "month" | "list">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [monthPick, setMonthPick] = useState<Date>(() => new Date());
  const [pickDay, setPickDay] = useState<Date>(() => new Date());

  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  // ── Dialog state
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );

  // ── Date range for shifts
  const range = useMemo(() => {
    if (view === "month") {
      return {
        from: startOfMonth(monthPick).toISOString(),
        to: endOfMonth(monthPick).toISOString(),
      };
    }
    if (view === "week") {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = endOfWeek(anchor, { weekStartsOn: 1 });
      return { from: ws.toISOString(), to: we.toISOString() };
    }
    const now = new Date();
    return {
      from: subDays(now, 30).toISOString(),
      to: addDays(now, 120).toISOString(),
    };
  }, [view, anchor, monthPick]);

  // ── Shifts query
  const { data: shifts, isLoading } = useQuery({
    queryKey: ["shifts", range.from, range.to, departmentFilter],
    queryFn: async () => {
      let url = `/shifts?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      if (departmentFilter) {
        url += `&departmentId=${encodeURIComponent(departmentFilter)}`;
      }
      return (await api.get(url)).data.data as ShiftRow[];
    },
  });

  // ── Departments query
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () =>
      (await api.get("/departments")).data.data as {
        id: string;
        name: string;
      }[],
  });

  // ── Suggest query (only runs on step 2)
  const { data: candidates, isLoading: suggestLoading } = useQuery({
    queryKey: [
      "shifts-suggest",
      form.departmentId,
      form.startDatetime,
      form.endDatetime,
      form.requiredSpecialty,
      form.requiredCount,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (form.departmentId) params.set("departmentId", form.departmentId);
      if (form.startDatetime)
        params.set(
          "startDatetime",
          new Date(form.startDatetime).toISOString(),
        );
      if (form.endDatetime)
        params.set("endDatetime", new Date(form.endDatetime).toISOString());
      if (form.requiredSpecialty)
        params.set("requiredSpecialty", form.requiredSpecialty);
      params.set("requiredCount", String(form.requiredCount));
      return (await api.get(`/shifts/suggest?${params}`))
        .data.data as Candidate[];
    },
    enabled: step === 2 && !!form.departmentId && !!form.startDatetime,
    staleTime: 0,
  });

  // Auto-select top N when candidates load
  useEffect(() => {
    if (!candidates) return;
    const top = candidates.slice(0, form.requiredCount).map((c) => c.id);
    setSelectedUserIds(new Set(top));
  }, [candidates, form.requiredCount]);

  // ── Create mutation
  const create = useMutation({
    mutationFn: async () => {
      const shiftRes = await api.post("/shifts", {
        name: form.name,
        departmentId: form.departmentId,
        startDatetime: new Date(form.startDatetime).toISOString(),
        endDatetime: new Date(form.endDatetime).toISOString(),
        requiredSpecialty: form.requiredSpecialty || null,
        requiredCount: form.requiredCount,
      });
      const shiftId: string = shiftRes.data.data.id;
      const userIds = [...selectedUserIds];
      if (userIds.length > 0) {
        await api.post(`/shifts/${shiftId}/assign`, { userIds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      closeDialog();
    },
  });

  // ── Week grid
  const weekDays = useMemo(() => {
    const ws = startOfWeek(anchor, { weekStartsOn: 1 });
    const we = endOfWeek(anchor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: ws, end: we });
  }, [anchor]);

  // ── Month calendar
  const daysWithShifts = useMemo(() => {
    if (!shifts?.length) return [] as Date[];
    const days = eachDayOfInterval({
      start: startOfMonth(monthPick),
      end: endOfMonth(monthPick),
    });
    return days.filter((d) => shifts.some((s) => shiftOverlapsDay(s, d)));
  }, [shifts, monthPick]);

  const pickedShifts = useMemo(
    () => shifts?.filter((s) => shiftOverlapsDay(s, pickDay)) ?? [],
    [shifts, pickDay],
  );

  // ── Dialog helpers
  function openDialog() {
    setForm(DEFAULT_FORM);
    setSelectedUserIds(new Set());
    setStep(1);
    setShowForm(true);
  }

  function closeDialog() {
    setShowForm(false);
    setStep(1);
    setForm(DEFAULT_FORM);
    setSelectedUserIds(new Set());
  }

  function handleDayChange(d: Date | undefined) {
    setForm((f) => {
      const next = { ...f, day: d };
      if (d && next.period) {
        const { start, end } = datetimeForPeriod(d, next.period);
        next.startDatetime = start;
        next.endDatetime = end;
      }
      return next;
    });
  }

  function handlePeriodChange(p: Period) {
    setForm((f) => {
      const next = { ...f, period: p };
      if (next.day) {
        const { start, end } = datetimeForPeriod(next.day, p);
        next.startDatetime = start;
        next.endDatetime = end;
      }
      return next;
    });
  }

  function goToStep2() {
    setSelectedUserIds(new Set());
    setStep(2);
  }

  function toggleCandidate(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const step1Valid =
    !!form.name &&
    !!form.departmentId &&
    !!form.day &&
    !!form.period &&
    !!form.startDatetime &&
    !!form.endDatetime;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-10 max-w-[92rem] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 mb-2">
            Gestão
          </p>
          <h2 className="text-[1.65rem] font-bold tracking-tight text-slate-900">
            Turnos e escalas
          </h2>
          <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
            Grelha semanal por período, vista mensal ou lista — com sugestão
            inteligente de equipa no segundo passo.
          </p>
        </div>
        <Button
          size="lg"
          className="gap-2.5 rounded-2xl h-11 px-7 text-[15px] bg-[#0B1F3A] hover:bg-[#0a1a33] shadow-sm shrink-0"
          onClick={openDialog}
        >
          <Plus className="size-5" />
          Criar turno
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/55 bg-white/90 px-5 py-4 shadow-sm">
        <p className="text-sm text-slate-600 shrink-0">
          Filtrar escalas por departamento
        </p>
        <Select
          value={departmentFilter ?? "__all__"}
          onValueChange={(v) => {
            navigate({
              to: "/dashboard/shifts",
              search:
                !v || v === "__all__"
                  ? { departmentId: undefined }
                  : { departmentId: v },
              replace: true,
            });
          }}
        >
          <SelectTrigger className="w-full sm:w-80 rounded-xl h-11 border-slate-200/70">
            <SelectValue placeholder="Todos os departamentos">
              {departmentFilter
                ? departmentTriggerLabel(
                    departmentFilter,
                    departments,
                    "Departamento",
                  )
                : "Todos os departamentos"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="__all__">Todos os departamentos</SelectItem>
            {departments?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as typeof view)}
        className="space-y-4"
      >
        <TabsList className="flex w-full max-w-2xl flex-wrap sm:flex-nowrap gap-1 rounded-2xl bg-slate-100/70 border border-slate-200/60 p-1.5 min-h-[3rem]">
          <TabsTrigger
            value="week"
            className="flex-1 rounded-xl gap-2 text-[13px] sm:text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5"
          >
            <LayoutGrid className="size-4 shrink-0 opacity-80" />
            Semana
          </TabsTrigger>
          <TabsTrigger
            value="month"
            className="flex-1 rounded-xl gap-2 text-[13px] sm:text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5"
          >
            <CalendarDays className="size-4 shrink-0 opacity-80" />
            Mês
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className="flex-1 rounded-xl gap-2 text-[13px] sm:text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5"
          >
            <List className="size-4 shrink-0 opacity-80" />
            Lista
          </TabsTrigger>
        </TabsList>

        {/* ─── WEEK GRID ────────────────────────────────────────────────────── */}
        <TabsContent value="week" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-2xl border-slate-200/80 size-11"
              onClick={() => setAnchor((a) => subWeeks(a, 1))}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-2xl border-slate-200/80 size-11"
              onClick={() => setAnchor((a) => addWeeks(a, 1))}
            >
              <ChevronRight className="size-5" />
            </Button>
            <span className="text-sm font-semibold text-slate-700 capitalize tabular-nums">
              {format(startOfWeek(anchor, { weekStartsOn: 1 }), "d MMM", {
                locale: pt,
              })}{" "}
              —{" "}
              {format(endOfWeek(anchor, { weekStartsOn: 1 }), "d MMM yyyy", {
                locale: pt,
              })}
            </span>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200/50 bg-white shadow-sm">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/90">
                  <th className="w-28 border-b border-r border-slate-200/55 px-4 py-4" />
                  {weekDays.map((day) => {
                    const isToday =
                      format(day, "yyyy-MM-dd") ===
                      format(new Date(), "yyyy-MM-dd");
                    return (
                      <th
                        key={day.toISOString()}
                        className="border-b border-r border-slate-200/55 px-3 py-4 text-center last:border-r-0 min-w-[8.5rem]"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {format(day, "EEE", { locale: pt })}
                        </p>
                        <p
                          className={`text-xl font-bold tabular-nums ${
                            isToday ? "text-teal-600" : "text-slate-800"
                          }`}
                        >
                          {format(day, "d")}
                        </p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period, pi) => (
                  <tr key={period}>
                    <td
                      className={`border-r border-slate-200/55 px-4 py-4 align-top bg-slate-50/50 ${
                        pi < PERIODS.length - 1 ? "border-b border-slate-200/45" : ""
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-800">
                        {period}
                      </p>
                      <p className="text-[11px] text-slate-500 whitespace-nowrap mt-1">
                        {PERIOD_CONFIG[period].label}
                      </p>
                    </td>
                    {weekDays.map((day, di) => {
                      const cellShifts = (shifts ?? []).filter(
                        (s) =>
                          shiftOverlapsDay(s, day) &&
                          getPeriod(s.start_datetime) === period,
                      );
                      return (
                        <td
                          key={day.toISOString()}
                          className={`p-2.5 align-top bg-white/40 ${
                            pi < PERIODS.length - 1 ? "border-b border-slate-200/45" : ""
                          } ${di < weekDays.length - 1 ? "border-r border-slate-200/45" : ""}`}
                        >
                          <div className="min-h-[5.5rem] space-y-2">
                            {cellShifts.length === 0 && (
                              <p className="text-xs text-slate-400 text-center pt-8">
                                —
                              </p>
                            )}
                            {cellShifts.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setSelectedShiftId(s.id)}
                                className="w-full text-left rounded-xl bg-white border border-slate-200/55 shadow-sm px-3 py-3 space-y-2 transition-colors hover:bg-slate-50/90 hover:border-slate-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                              >
                                <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
                                  {s.name}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-normal px-2 py-0.5 rounded-lg border-slate-200/70 bg-slate-50/80 truncate max-w-full block"
                                >
                                  {s.department_name}
                                </Badge>
                                <p className="text-[11px] text-slate-600 tabular-nums">
                                  Equipa: {assignedCount(s)}/
                                  {Number(s.required_count)}
                                </p>
                                <ShiftFillBadge shift={s} />
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> A carregar...
            </p>
          )}
        </TabsContent>

        {/* ─── MONTH ────────────────────────────────────────────────────────── */}
        <TabsContent value="month" className="space-y-6 mt-4">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <Card className="rounded-2xl border-border/80 shadow-sm">
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  month={monthPick}
                  onMonthChange={(m) => {
                    setMonthPick(m);
                    setPickDay((prev) =>
                      prev && isSameMonth(prev, m) ? prev : startOfMonth(m),
                    );
                  }}
                  selected={pickDay}
                  onSelect={(d) => d && setPickDay(d)}
                  locale={pt}
                  modifiers={{ hasShift: daysWithShifts }}
                  modifiersClassNames={{
                    hasShift:
                      "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-teal-500",
                  }}
                  className="rounded-xl"
                />
              </CardContent>
            </Card>

            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setMonthPick((m) => subMonths(m, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setMonthPick((m) => addMonths(m, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold capitalize">
                  {format(monthPick, "MMMM yyyy", { locale: pt })}
                </span>
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground capitalize">
                {format(pickDay, "EEEE d MMMM", { locale: pt })}
              </p>
              <ScrollArea className="h-85 rounded-xl border bg-muted/20">
                <div className="p-3 space-y-2">
                  {pickedShifts.length === 0 && (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Sem turnos neste dia.
                    </p>
                  )}
                  {pickedShifts.map((s) => (
                    <Card
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedShiftId(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setSelectedShiftId(s.id);
                      }}
                      className="rounded-xl border-teal-100 bg-card shadow-none cursor-pointer hover:bg-slate-50/80 transition-colors"
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between gap-2 flex-wrap">
                          <span className="font-semibold">{s.name}</span>
                          <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="outline">
                              {getPeriod(s.start_datetime)}
                            </Badge>
                            <Badge variant="secondary">
                              {s.department_name}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fmtShort(s.start_datetime)} —{" "}
                          {fmtShort(s.end_datetime)}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <ShiftFillBadge shift={s} />
                          {s.required_specialty && (
                            <span className="text-xs text-muted-foreground">
                              · {s.required_specialty}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        {/* ─── LIST ─────────────────────────────────────────────────────────── */}
        <TabsContent value="list" className="mt-4">
          <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/40">
                    <TableHead>Nome</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Vagas</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <Loader2
                          size={16}
                          className="animate-spin inline mr-2"
                        />
                        A carregar...
                      </TableCell>
                    </TableRow>
                  )}
                  {shifts?.map((shift) => (
                    <TableRow
                      key={shift.id}
                      className="cursor-pointer hover:bg-slate-50/90"
                      onClick={() => setSelectedShiftId(shift.id)}
                    >
                      <TableCell className="font-medium">
                        {shift.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {shift.department_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getPeriod(shift.start_datetime)}
                        </Badge>
                      </TableCell>
                      <TableCell>{fmtShort(shift.start_datetime)}</TableCell>
                      <TableCell>{fmtShort(shift.end_datetime)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {assignedCount(shift)}/
                          {String(shift.required_count)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ShiftFillBadge shift={shift} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>

      <ShiftDetailSheet
        shiftId={selectedShiftId}
        open={!!selectedShiftId}
        onOpenChange={(open) => {
          if (!open) setSelectedShiftId(null);
        }}
      />

      {/* ─── CREATE DIALOG ────────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-2xl rounded-3xl border-slate-200/70 shadow-xl">
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-lg font-semibold">
              {step === 1
                ? "Novo turno — Configuração"
                : "Novo turno — Sugestão de equipa"}
            </DialogTitle>
            <div className="flex gap-2 mt-1">
              <div
                className={`h-2 flex-1 rounded-full transition-colors ${
                  step >= 1 ? "bg-teal-600/85" : "bg-slate-200"
                }`}
              />
              <div
                className={`h-2 flex-1 rounded-full transition-colors ${
                  step >= 2 ? "bg-teal-600/85" : "bg-slate-200"
                }`}
              />
            </div>
          </DialogHeader>

          {/* Step 1 */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-5 py-2">
              <div className="col-span-2 space-y-2">
                <Label className="text-sm font-medium">Nome do turno</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded-xl h-11 text-[15px]"
                  placeholder="Ex: Turno Manhã — Cardiologia"
                />
              </div>

              <div className="space-y-2">
                <Label>Dia</Label>
                <DatePickerField
                  date={form.day}
                  onSelect={(d) => handleDayChange(d)}
                  placeholder="Escolher dia"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <Select
                  value={form.period ?? ""}
                  onValueChange={(v) => handlePeriodChange(v as Period)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p} — {PERIOD_CONFIG[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={form.departmentId ?? "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      departmentId:
                        !v || v === "__none__" ? undefined : v,
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecionar departamento">
                      {departmentTriggerLabel(form.departmentId, departments)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Especialidade</Label>
                <Input
                  value={form.requiredSpecialty}
                  onChange={(e) =>
                    setForm({ ...form, requiredSpecialty: e.target.value })
                  }
                  className="rounded-xl"
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-2">
                <Label>Nº de vagas</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.requiredCount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      requiredCount: Number(e.target.value),
                    })
                  }
                  className="rounded-xl"
                />
              </div>

              {form.startDatetime && form.endDatetime && (
                <div className="col-span-2 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 text-xs text-teal-700">
                  Horário:{" "}
                  <span className="font-medium">
                    {form.startDatetime.replace("T", " ")}
                  </span>{" "}
                  →{" "}
                  <span className="font-medium">
                    {form.endDatetime.replace("T", " ")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Colaboradores disponíveis ordenados por carga horária. Os{" "}
                {form.requiredCount} melhores estão pré-selecionados — ajuste
                conforme necessário.
              </p>

              {suggestLoading && (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">A calcular sugestões...</span>
                </div>
              )}

              {!suggestLoading && candidates?.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-xl bg-muted/20">
                  Nenhum colaborador disponível para este turno.
                  <br />
                  <span className="text-xs mt-1 block">
                    Verifique a disponibilidade semanal dos colaboradores.
                  </span>
                </div>
              )}

              {!suggestLoading && candidates && candidates.length > 0 && (
                <ScrollArea className="h-[22rem] pr-2 rounded-2xl border border-slate-200/50 bg-slate-50/30">
                  <div className="space-y-2">
                    {candidates.map((c) => (
                      <CandidateCard
                        key={c.id}
                        candidate={c}
                        selected={selectedUserIds.has(c.id)}
                        onToggle={() => toggleCandidate(c.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Users size={12} />
                <span>
                  {selectedUserIds.size} colaborador
                  {selectedUserIds.size !== 1 ? "es" : ""} selecionado
                  {selectedUserIds.size !== 1 ? "s" : ""} de{" "}
                  {form.requiredCount} vaga
                  {form.requiredCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 pt-4 border-t border-slate-100 mt-2">
            {step === 1 ? (
              <>
                <Button variant="outline" onClick={closeDialog} className="rounded-xl h-11 px-6">
                  Cancelar
                </Button>
                <Button
                  className="rounded-xl h-11 px-8 text-[15px] bg-[#0B1F3A] hover:bg-[#0a1a33]"
                  disabled={!step1Valid}
                  onClick={goToStep2}
                >
                  Seguinte
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={create.isPending}
                  className="rounded-xl h-11 px-6"
                >
                  Voltar
                </Button>
                <Button
                  className="rounded-xl h-11 px-8 text-[15px] bg-[#0B1F3A] hover:bg-[#0a1a33]"
                  disabled={create.isPending}
                  onClick={() => create.mutate()}
                >
                  {create.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-1.5" />
                      A criar...
                    </>
                  ) : (
                    "Criar turno"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}