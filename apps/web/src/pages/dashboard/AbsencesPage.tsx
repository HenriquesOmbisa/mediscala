import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "../../lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import {
  CheckCircle2,
  MinusCircle,
  FileX,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const typeConfig: Record<
  string,
  { label: string; className: string }
> = {
  SICK: { label: "Doença", className: "bg-red-50 text-red-700 border-red-200" },
  PERSONAL: {
    label: "Pessoal",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  EMERGENCY: {
    label: "Emergência",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  VACATION: {
    label: "Férias",
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
  OTHER: {
    label: "Outro",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

export function AbsencesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["absences"],
    queryFn: async () => (await api.get("/absences")).data.data as Record<
      string,
      unknown
    >[],
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-1.5">
            Registo
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Faltas
          </h2>
          <p className="text-slate-500 mt-1 text-sm max-w-xl">
            Ausências registadas em turnos — histórico por colaborador e tipo.
          </p>
        </div>
        <Link
          to="/dashboard/leave-requests"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "rounded-xl gap-2 border-amber-200/70 bg-amber-50/40 hover:bg-amber-50/80 shrink-0 self-start",
          )}
        >
          <CalendarClock className="size-4 text-amber-800" />
          Pedidos de indisponibilidade
          <ArrowRight className="size-4 opacity-70" />
        </Link>
      </div>

      {/* ── Stats row ── */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(typeConfig).map(([key, { label, className }]) => {
            const count = data.filter((a) => a.type === key).length;
            return (
              <Card key={key} className="rounded-2xl border-slate-200/70 shadow-sm">
                <CardContent className="p-4">
                  <Badge
                    variant="outline"
                    className={cn("text-xs mb-2 font-medium", className)}
                  >
                    {label}
                  </Badge>
                  <p className="text-2xl font-bold text-slate-800 tabular-nums">
                    {count}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Table ── */}
      <Card className="rounded-2xl border-slate-200/70 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-sm font-semibold text-slate-700">
            Todas as ausências
          </CardTitle>
          <CardDescription className="text-xs">
            {isLoading ? "A carregar..." : `${data?.length ?? 0} registos`}
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Colaborador
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Turno
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Data
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Tipo
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Motivo
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Aprovação
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!isLoading && !data?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FileX size={28} className="opacity-30" />
                      <span className="text-sm">Sem faltas registadas</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {data?.map((absence) => {
                const cfg = typeConfig[String(absence.type)] ?? typeConfig.OTHER;
                return (
                  <TableRow
                    key={String(absence.id)}
                    className="border-slate-50 hover:bg-slate-50/80 transition-colors"
                  >
                    <TableCell className="font-medium text-slate-800 text-sm">
                      {String(absence.user_name ?? "—")}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {String(absence.shift_name ?? "—")}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm tabular-nums">
                      {new Intl.DateTimeFormat("pt-PT", {
                        dateStyle: "short",
                      }).format(new Date(String(absence.start_datetime)))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-medium", cfg.className)}
                      >
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm max-w-[200px] truncate">
                      {absence.reason != null &&
                      String(absence.reason).length > 0 ? (
                        String(absence.reason)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {absence.approved_by ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-teal-600 font-medium">
                          <CheckCircle2 size={13} />
                          Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                          <MinusCircle size={13} />
                          Pendente
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
