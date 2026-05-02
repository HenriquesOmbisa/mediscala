import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Shield, Clock, CheckCircle2, XCircle, Ban, Users, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  OPEN: {
    label: "Aberta",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  FILLED: {
    label: "Preenchida",
    className: "bg-teal-50 text-teal-700 border-teal-200",
    icon: CheckCircle2,
  },
  EXPIRED: {
    label: "Expirada",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelada",
    className: "bg-slate-100 text-slate-500 border-slate-200",
    icon: Ban,
  },
};

export function CoveragePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["coverage"],
    queryFn: async () => (await api.get("/coverage")).data.data as any[],
    refetchInterval: 15_000,
  });

  const openCount = data?.filter((r: any) => r.status === "OPEN").length ?? 0;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-1.5">
            Substituições
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Cobertura</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Pedidos de substituição de turno
          </p>
        </div>
        {openCount > 0 && (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded-xl font-semibold">
            {openCount} aberta{openCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* ── Cards ── */}
      <div className="space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-slate-200/70 shadow-sm">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </CardContent>
            </Card>
          ))}

        {!isLoading && !data?.length && (
          <Card className="rounded-2xl border-slate-200/70 shadow-sm">
            <CardContent className="py-16 text-center">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Shield size={32} className="opacity-20" />
                <p className="text-sm font-medium">Sem pedidos de cobertura</p>
                <p className="text-xs text-slate-300">
                  Quando surgir uma substituição, aparecerá aqui.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {data?.map((req: any) => {
          const cfg = statusConfig[req.status] ?? statusConfig.OPEN;
          const StatusIcon = cfg.icon;
          return (
            <Card
              key={req.id}
              className={cn(
                "rounded-2xl border-slate-200/70 shadow-sm hover:shadow-md transition-shadow",
                req.status === "OPEN" && "border-l-4 border-l-amber-400",
                req.status === "FILLED" && "border-l-4 border-l-teal-400",
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Status + shift name */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-semibold gap-1.5 py-1 px-2.5", cfg.className)}
                      >
                        <StatusIcon size={11} />
                        {cfg.label}
                      </Badge>
                      <span className="text-sm font-semibold text-slate-700">
                        {req.shift_name}
                      </span>
                    </div>

                    {/* Absent user */}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                        Ausente
                      </span>
                      <span className="font-medium text-slate-800">{req.absent_user_name}</span>
                    </div>

                    {/* Date range */}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CalendarClock size={13} />
                      <span>
                        {new Intl.DateTimeFormat("pt-PT", {
                          dateStyle: "full",
                          timeStyle: "short",
                        }).format(new Date(req.start_datetime))}
                        {" → "}
                        {new Intl.DateTimeFormat("pt-PT", {
                          timeStyle: "short",
                        }).format(new Date(req.end_datetime))}
                      </span>
                    </div>
                  </div>

                  {/* Candidate stats */}
                  <div className="flex gap-4 shrink-0 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1">
                        Pendentes
                      </span>
                      <span className="text-lg font-bold text-slate-700 tabular-nums">
                        {req.pending_candidates}
                      </span>
                    </div>
                    <Separator orientation="vertical" className="h-10 self-center" />
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1">
                        Aceites
                      </span>
                      <span className="text-lg font-bold text-teal-600 tabular-nums">
                        {req.accepted_candidates}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}