import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const submissionColor: Record<string, string> = {
  SUBMITTED: "bg-amber-500/15 text-amber-700",
  APPROVED: "bg-emerald-500/15 text-emerald-700",
  REJECTED: "bg-rose-500/15 text-rose-700",
};

export function BillingPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["billing", "payments"],
    queryFn: async () => {
      const res = await api.get("/billing/payments");
      return (res.data.data ?? []) as Array<{
        id: string;
        amount: string;
        status: string;
        submissionStatus: string;
        method: string | null;
        reference: string | null;
        proofUrl: string | null;
        reviewReason: string | null;
        requestedPlanName: string | null;
        requestedPlanCode: string | null;
        createdAt: string;
      }>;
    },
  });

  return (
    <div className="p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-2">Financeiro</p>
          <h1 className="text-2xl font-bold text-slate-900">Pagamentos</h1>
          <p className="text-slate-500 mt-1">Histórico e estado das submissões</p>
        </div>
        <Link
          to="/dashboard/billing/upgrade"
          className="inline-flex h-9 items-center justify-center rounded-xl bg-[#0B1F3A] px-3 text-sm font-medium text-white hover:bg-[#0f2a4d]"
        >
          Submeter pagamento
        </Link>
      </div>

      <Card className="rounded-3xl border-slate-200/70 shadow-sm bg-white/90">
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>{data?.length ?? 0} registo(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">A carregar...</p>
          ) : !data?.length ? (
            <p className="text-sm text-slate-500">Nenhum pagamento submetido.</p>
          ) : (
            <div className="space-y-3">
              {data.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(Number(p.amount))}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Plano: {p.requestedPlanName ?? "-"} ({p.requestedPlanCode ?? "-"})
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(p.createdAt)} • Método: {p.method ?? "-"} • Ref: {p.reference ?? "-"}
                    </p>
                    {p.reviewReason && (
                      <p className="text-xs text-rose-600 mt-1">Motivo: {p.reviewReason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={submissionColor[p.submissionStatus] ?? "bg-slate-100 text-slate-700"}>
                      {p.submissionStatus}
                    </Badge>
                    {p.proofUrl && (
                      <a
                        href={p.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#0B1F3A] font-medium underline"
                      >
                        Comprovativo
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
