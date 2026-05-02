import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
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
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2,
  CalendarClock,
  XCircle,
  ArrowRight,
  AlertCircle,
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

type PendingLeaveRow = {
  id: string;
  user_id: string;
  starts_on: string;
  ends_on: string;
  type: string;
  status: string;
  reason: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
};

function fmtRange(startsOn: string, endsOn: string) {
  const a = startsOn.includes("T") ? startsOn : `${startsOn}T12:00:00`;
  const b = endsOn.includes("T") ? endsOn : `${endsOn}T12:00:00`;
  return `${format(new Date(a), "d MMM yyyy", { locale: pt })} — ${format(new Date(b), "d MMM yyyy", { locale: pt })}`;
}

export function LeaveRequestsPage() {
  const queryClient = useQueryClient();

  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-leave-requests"],
    queryFn: async () =>
      (await api.get("/users/pending-leave-requests")).data
        .data as PendingLeaveRow[],
  });

  const decideLeave = useMutation({
    mutationFn: async ({
      userId,
      blockId,
      status,
    }: {
      userId: string;
      blockId: string;
      status: "APPROVED" | "REJECTED";
    }) =>
      api.patch(`/users/${userId}/leave-blocks/${blockId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["user-leave-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-1.5">
            Planeamento
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Pedidos de indisponibilidade
          </h2>
          <p className="text-slate-500 mt-1 text-sm max-w-xl">
            Pedidos enviados pelos colaboradores em estado pendente. Ao aprovar,
            passam a bloquear escalas e sugestões nas datas indicadas.
          </p>
        </div>
        <Link
          to="/dashboard/absences"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "rounded-xl gap-2 border-slate-200 shrink-0 self-start",
          )}
        >
          <AlertCircle className="size-4" />
          Ir para Faltas
          <ArrowRight className="size-4 opacity-70" />
        </Link>
      </div>

      <Card className="rounded-2xl border-slate-200/70 shadow-sm overflow-hidden border-amber-200/40 bg-amber-50/10">
        <CardHeader className="border-b border-amber-100/80 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <CalendarClock className="size-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <CardTitle className="text-sm font-semibold text-slate-800">
                  Fila de pedidos
                </CardTitle>
                <CardDescription className="text-xs mt-1 max-w-xl">
                  Estado{" "}
                  <span className="font-medium text-slate-600">PENDING</span>.
                  Aprovação atualiza o mesmo registo para{" "}
                  <span className="font-medium">APPROVED</span> — não duplica
                  linhas na base de dados.
                </CardDescription>
              </div>
            </div>
            {!pendingLoading && (
              <Badge
                variant="secondary"
                className="tabular-nums shrink-0 bg-amber-100/90 text-amber-900 border-amber-200/60"
              >
                {pending?.length ?? 0} pendente
                {(pending?.length ?? 0) !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Colaborador
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Período
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Tipo
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Motivo
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Pedido em
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">
                  Acções
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingLoading &&
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!pendingLoading && !(pending?.length ?? 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p className="text-sm text-slate-500">
                      Nenhum pedido pendente.
                    </p>
                  </TableCell>
                </TableRow>
              )}
              {pending?.map((row) => {
                const cfg = typeConfig[row.type] ?? typeConfig.OTHER;
                const busy =
                  decideLeave.isPending &&
                  decideLeave.variables?.blockId === row.id;
                return (
                  <TableRow
                    key={row.id}
                    className="border-slate-50 hover:bg-white/80 transition-colors"
                  >
                    <TableCell className="font-medium text-slate-800 text-sm">
                      <span className="block">{row.user_name}</span>
                      <span className="text-xs text-slate-400 font-normal truncate max-w-[14rem] block">
                        {row.user_email}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                      {fmtRange(row.starts_on, row.ends_on)}
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
                      {row.reason ?? (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs tabular-nums whitespace-nowrap">
                      {format(new Date(row.created_at), "dd/MM/yyyy HH:mm", {
                        locale: pt,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          className="rounded-xl border-teal-200 bg-teal-50/80 text-teal-900 hover:bg-teal-100 gap-1.5"
                          onClick={() =>
                            decideLeave.mutate({
                              userId: row.user_id,
                              blockId: row.id,
                              status: "APPROVED",
                            })
                          }
                        >
                          {busy &&
                          decideLeave.variables?.status === "APPROVED" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
                          onClick={() =>
                            decideLeave.mutate({
                              userId: row.user_id,
                              blockId: row.id,
                              status: "REJECTED",
                            })
                          }
                        >
                          {busy &&
                          decideLeave.variables?.status === "REJECTED" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <XCircle className="size-3.5" />
                          )}
                          Recusar
                        </Button>
                      </div>
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
