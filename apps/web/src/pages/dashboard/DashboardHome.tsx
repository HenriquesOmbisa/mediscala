import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  eachDayOfInterval,
  endOfMonth,
  startOfMonth,
  endOfWeek,
  startOfWeek,
  format,
  addWeeks,
  subWeeks,
} from "date-fns";
import { pt } from "date-fns/locale";
import { api } from "../../lib/api";
import {
  Calendar as CalendarIcon,
  Users,
  AlertCircle,
  Shield,
  Clock,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ShiftFillBadge } from "@/components/shift/ShiftFillBadge";
import { ShiftDetailSheet } from "@/components/shift/ShiftDetailSheet";
import {
  PERIODS,
  PERIOD_CONFIG,
  assignedCount,
  getPeriod,
  shiftOverlapsDay,
  type ShiftGridRow,
} from "@/lib/shift-calendar";

function StatCard({
  label,
  value,
  icon: Icon,
  description,
  variant,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
  variant: "default" | "teal" | "amber" | "red";
  loading?: boolean;
}) {
  const iconClass = {
    default: "bg-[#0B1F3A]/95 text-white",
    teal: "bg-teal-500/90 text-white",
    amber: "bg-amber-500/85 text-white",
    red: "bg-rose-500/85 text-white",
  }[variant];

  return (
    <Card className="rounded-3xl border-slate-200/55 shadow-sm hover:shadow-md/80 transition-shadow bg-white/90 backdrop-blur-sm">
      <CardContent className="p-7">
        <div className="flex items-start justify-between mb-5">
          <div
            className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm",
              iconClass,
            )}
          >
            <Icon size={20} />
          </div>
          <ArrowUpRight size={15} className="text-slate-300 mt-1" />
        </div>
        {loading ? (
          <>
            <Skeleton className="h-9 w-20 mb-2 rounded-lg" />
            <Skeleton className="h-3.5 w-28 rounded-md" />
          </>
        ) : (
          <>
            <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
              {value}
            </p>
            <p className="text-xs font-medium text-slate-500 mt-2 uppercase tracking-wide">
              {label}
            </p>
            {description && (
              <p className="text-xs text-slate-400 mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardHome() {
  const { user } = useAuthStore();
  const [dashMonth, setDashMonth] = useState(() => new Date());
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const rangeWeek = useMemo(() => {
    const from = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
    const to = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
    return { from, to };
  }, []);

  const dashboardWeekRange = useMemo(() => {
    const ws = startOfWeek(weekAnchor, { weekStartsOn: 1 });
    const we = endOfWeek(weekAnchor, { weekStartsOn: 1 });
    return { from: ws.toISOString(), to: we.toISOString() };
  }, [weekAnchor]);

  const rangeMonth = useMemo(() => {
    const from = startOfMonth(dashMonth).toISOString();
    const to = endOfMonth(dashMonth).toISOString();
    return { from, to };
  }, [dashMonth]);

  const { data: shiftsData, isLoading: shiftsLoading } = useQuery({
    queryKey: ["shifts", "dashboard-week", rangeWeek.from, rangeWeek.to],
    queryFn: async () => {
      const res = await api.get(
        `/shifts?from=${encodeURIComponent(rangeWeek.from)}&to=${encodeURIComponent(rangeWeek.to)}`,
      );
      return res.data.data as ShiftGridRow[];
    },
  });

  const { data: gridShifts, isLoading: gridLoading } = useQuery({
    queryKey: [
      "shifts",
      "dashboard-grid",
      dashboardWeekRange.from,
      dashboardWeekRange.to,
    ],
    queryFn: async () => {
      const res = await api.get(
        `/shifts?from=${encodeURIComponent(dashboardWeekRange.from)}&to=${encodeURIComponent(dashboardWeekRange.to)}`,
      );
      return res.data.data as ShiftGridRow[];
    },
  });

  const { data: monthShifts } = useQuery({
    queryKey: ["shifts", "dashboard-month", rangeMonth.from, rangeMonth.to],
    queryFn: async () => {
      const res = await api.get(
        `/shifts?from=${encodeURIComponent(rangeMonth.from)}&to=${encodeURIComponent(rangeMonth.to)}`,
      );
      return res.data.data as ShiftGridRow[];
    },
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.get("/users");
      return res.data;
    },
    enabled: ["HOSPITAL_ADMIN", "MANAGER"].includes(user?.role ?? ""),
  });

  const { data: coverageData, isLoading: coverageLoading } = useQuery({
    queryKey: ["coverage"],
    queryFn: async () => {
      const res = await api.get("/coverage");
      return res.data.data as { status: string }[];
    },
    enabled: ["HOSPITAL_ADMIN", "MANAGER"].includes(user?.role ?? ""),
  });

  const openCoverage =
    coverageData?.filter((c) => c.status === "OPEN").length ?? 0;

  const daysWithShifts = useMemo(() => {
    if (!monthShifts?.length) return [] as Date[];
    const start = startOfMonth(dashMonth);
    const end = endOfMonth(dashMonth);
    return eachDayOfInterval({ start, end }).filter((d) =>
      monthShifts.some((s) => shiftOverlapsDay(s, d)),
    );
  }, [monthShifts, dashMonth]);

  const weekDays = useMemo(() => {
    const ws = startOfWeek(weekAnchor, { weekStartsOn: 1 });
    const we = endOfWeek(weekAnchor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: ws, end: we });
  }, [weekAnchor]);

  /** Stable bounds — do not derive from `new Date()` each render or the query key churns and floods the API (429). */
  const shiftsStripRange = useMemo(() => {
    const start = new Date();
    return {
      from: start.toISOString(),
      to: addWeeks(start, 1).toISOString(),
    };
  }, []);

  const { data: shifts7d, isLoading: shifts7dLoading } = useQuery({
    queryKey: [
      "shifts",
      "dashboard-strip",
      shiftsStripRange.from,
      shiftsStripRange.to,
    ],
    queryFn: async () => {
      const res = await api.get(
        `/shifts?from=${encodeURIComponent(shiftsStripRange.from)}&to=${encodeURIComponent(shiftsStripRange.to)}`,
      );
      return res.data.data as ShiftGridRow[];
    },
    staleTime: 60_000,
  });

  const firstName = user?.name?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-2">
            Painel principal
          </p>
          <h2 className="text-[1.65rem] font-bold text-slate-900 tracking-tight">
            {greeting}, {firstName}
          </h2>
          <p className="text-slate-500 mt-2 text-[15px]">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className="text-teal-700 border-teal-200/70 bg-teal-50/90 text-xs py-2 px-4 rounded-full font-medium"
          >
            <span className="w-2 h-2 rounded-full bg-teal-500 mr-2 opacity-90" />
            Sistema ativo
          </Badge>
          <Link
            to="/dashboard/shifts"
            search={{ departmentId: undefined }}
            className={cn(
              buttonVariants({ size: "lg" }),
              "rounded-2xl h-11 px-6 text-[15px] bg-[#0B1F3A] hover:bg-[#0a1a33] shadow-sm no-underline",
            )}
          >
            Gerir turnos
          </Link>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Turnos esta semana"
          value={shiftsData?.length ?? 0}
          icon={CalendarIcon}
          variant="default"
          loading={shiftsLoading}
        />
        <StatCard
          label="Colaboradores"
          value={usersData?.total ?? "—"}
          icon={Users}
          variant="teal"
          loading={usersLoading}
        />
        <StatCard
          label="Coberturas abertas"
          value={openCoverage}
          icon={Shield}
          variant={openCoverage > 0 ? "amber" : "teal"}
          loading={coverageLoading}
        />
        <StatCard
          label="Faltas registadas"
          value="—"
          icon={AlertCircle}
          variant="red"
        />
      </div>

      {/* ── Weekly operational grid ─────────────────────── */}
      <Card className="rounded-3xl border-slate-200/55 shadow-sm overflow-hidden bg-white/95">
        <CardHeader className="border-b border-slate-100/90 pb-5 px-8 pt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <CalendarIcon size={17} className="text-teal-600 shrink-0" />
                Vista semanal · períodos
              </CardTitle>
              <CardDescription className="text-[13px] mt-2 leading-relaxed">
                Colunas = dias úteis da semana · Linhas = manhã, tarde e noite.
                Cada bloco mostra equipa atribuída vs vagas necessárias.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="icon-lg"
                className="rounded-2xl border-slate-200/80 size-11"
                onClick={() => setWeekAnchor((a) => subWeeks(a, 1))}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <Button
                variant="outline"
                size="icon-lg"
                className="rounded-2xl border-slate-200/80 size-11"
                onClick={() => setWeekAnchor((a) => addWeeks(a, 1))}
              >
                <ChevronRight className="size-5" />
              </Button>
              <span className="text-sm font-semibold text-slate-700 tabular-nums min-w-[10rem]">
                {format(startOfWeek(weekAnchor, { weekStartsOn: 1 }), "d MMM", {
                  locale: pt,
                })}{" "}
                —{" "}
                {format(endOfWeek(weekAnchor, { weekStartsOn: 1 }), "d MMM yyyy", {
                  locale: pt,
                })}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 lg:p-8">
          {gridLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-slate-500 rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/50">
              <Loader2 className="size-9 animate-spin text-teal-600/90" />
              <span className="text-sm font-medium">A carregar escalas da semana…</span>
            </div>
          )}
          {!gridLoading && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/45 bg-slate-50/40">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-white/85">
                  <th className="w-28 border-b border-r border-slate-200/50 px-4 py-4 text-left rounded-tl-2xl" />
                  {weekDays.map((day, di) => {
                    const isToday =
                      format(day, "yyyy-MM-dd") ===
                      format(new Date(), "yyyy-MM-dd");
                    return (
                      <th
                        key={day.toISOString()}
                        className={`border-b border-r border-slate-200/50 px-3 py-4 text-center last:border-r-0 min-w-[8.5rem] ${
                          di === weekDays.length - 1 ? "rounded-tr-2xl" : ""
                        }`}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {format(day, "EEE", { locale: pt })}
                        </p>
                        <p
                          className={`text-xl font-bold tabular-nums mt-1 ${
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
                      className={`border-r border-slate-200/50 px-4 py-4 align-top bg-white/70 ${
                        pi < PERIODS.length - 1 ? "border-b border-slate-200/45" : ""
                      } ${pi === PERIODS.length - 1 ? "rounded-bl-2xl" : ""}`}
                    >
                      <p className="text-sm font-semibold text-slate-800">
                        {period}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 whitespace-nowrap">
                        {PERIOD_CONFIG[period].label}
                      </p>
                    </td>
                    {weekDays.map((day, di) => {
                      const cellShifts = (gridShifts ?? []).filter(
                        (s) =>
                          shiftOverlapsDay(s, day) &&
                          getPeriod(s.start_datetime) === period,
                      );
                      const lastRow = pi === PERIODS.length - 1;
                      const lastCol = di === weekDays.length - 1;
                      return (
                        <td
                          key={day.toISOString()}
                          className={`p-2.5 align-top bg-white/40 ${
                            pi < PERIODS.length - 1
                              ? "border-b border-slate-200/45"
                              : ""
                          } ${di < weekDays.length - 1 ? "border-r border-slate-200/45" : ""} ${
                            lastRow && lastCol ? "rounded-br-2xl" : ""
                          }`}
                        >
                          <div className="min-h-[5.5rem] space-y-2">
                            {cellShifts.length === 0 && (
                              <p className="text-xs text-slate-400 text-center pt-8">
                                —
                              </p>
                            )}
                            {cellShifts.map((s) => (
                                <div
                                  key={s.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedShiftId(s.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setSelectedShiftId(s.id);
                                    }
                                  }}
                                  className="rounded-xl bg-white border border-slate-200/55 shadow-sm px-3 py-3 space-y-2 cursor-pointer text-left outline-none transition hover:border-teal-300/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#0B1F3A]/25"
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
                                </div>
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
          )}
        </CardContent>
      </Card>

      {/* ── Calendar + Upcoming ─────────────────────────── */}
      <div className="grid gap-7 lg:grid-cols-5">
        <Card className="lg:col-span-2 rounded-3xl border-slate-200/55 shadow-sm bg-white/95">
          <CardHeader className="pb-3 border-b border-slate-100/90 px-7 pt-7">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CalendarIcon size={16} className="text-teal-600" />
              Calendário mensal
            </CardTitle>
            <CardDescription className="text-[13px]">
              Dias com turnos marcados
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <Calendar
              mode="single"
              month={dashMonth}
              onMonthChange={setDashMonth}
              selected={new Date()}
              locale={pt}
              modifiers={{ hasShift: daysWithShifts }}
              modifiersClassNames={{
                hasShift:
                  "relative after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-teal-500/90",
              }}
              className="rounded-2xl"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 rounded-3xl border-slate-200/55 shadow-sm overflow-hidden bg-white/95">
          <CardHeader className="border-b border-slate-100/90 pb-5 px-8 pt-8">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock size={16} className="text-teal-600" />
                  Próximos turnos
                </CardTitle>
                <CardDescription className="text-[13px] mt-2">
                  Próximos 7 dias · só colaboradores em estado ASSIGNED contam
                  para vagas preenchidas
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className="text-xs font-semibold tabular-nums px-4 py-2 rounded-full bg-slate-100 text-slate-700 border-0"
              >
                {shifts7d?.length ?? 0} turno{shifts7d?.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <div className="overflow-x-auto px-2 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-4">
                    Turno
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-4">
                    Departamento
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-4">
                    Início
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-4">
                    Fim
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-4">
                    Atribuições
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts7dLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="border-slate-50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j} className="py-5">
                          <Skeleton className="h-4 w-full rounded-md" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                {!shifts7dLoading && !shifts7d?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <CalendarIcon size={28} className="opacity-25" />
                        <span className="text-sm">
                          Sem turnos nos próximos 7 dias
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {shifts7d?.map((shift) => {
                  const assigned = assignedCount(shift);
                  const required = Number(shift.required_count);
                  const isFull = assigned >= required;
                  return (
                    <TableRow
                      key={shift.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedShiftId(shift.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedShiftId(shift.id);
                        }
                      }}
                      className="border-slate-50 hover:bg-slate-50/70 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B1F3A]/20"
                    >
                      <TableCell className="font-medium text-slate-800 text-sm py-5">
                        {shift.name}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm py-5">
                        {shift.department_name}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs tabular-nums py-5">
                        {new Intl.DateTimeFormat("pt-PT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(shift.start_datetime))}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs tabular-nums py-5">
                        {new Intl.DateTimeFormat("pt-PT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(shift.end_datetime))}
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-semibold tabular-nums px-3 py-1.5 rounded-full border",
                            isFull
                              ? "bg-teal-50/90 text-teal-800 border-teal-200/70"
                              : "bg-amber-50/90 text-amber-900 border-amber-200/65",
                          )}
                        >
                          {assigned} / {required}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <ShiftDetailSheet
        shiftId={selectedShiftId}
        open={selectedShiftId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedShiftId(null);
        }}
      />
    </div>
  );
}
