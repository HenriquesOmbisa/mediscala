import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Wallet, Users, Building2, CalendarRange, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function BillingPlanPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["billing", "current-plan"],
    queryFn: async () => {
      const res = await api.get("/billing/current-plan");
      return res.data.data as {
        tenant: { name: string; slug: string; status: string };
        subscription: null | {
          planName: string;
          planCode: string;
          priceMonthly: string;
          startsAt: string;
          endsAt?: string | null;
          maxUsers: number;
          maxDepartments: number;
          maxShiftsPerMonth: number;
        };
      };
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ["users", "count"],
    queryFn: async () => {
      const res = await api.get("/users?pageSize=1");
      return res.data as { total?: number };
    },
  });

  const { data: deptsData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await api.get("/departments");
      return res.data.data as unknown[];
    },
  });

  const userCount = usersData?.total ?? 0;
  const deptCount = Array.isArray(deptsData) ? deptsData.length : 0;
  const sub = data?.subscription;

  return (
    <div className="p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-2">Financeiro</p>
          <h1 className="text-2xl font-bold text-slate-900">Plano e limites</h1>
          <p className="text-slate-500 mt-1">Gestão do plano ativo da empresa</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/billing/payments"
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Pagamentos
          </Link>
          <Link
            to="/dashboard/billing/upgrade"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#0B1F3A] px-3 text-sm font-medium text-white hover:bg-[#0f2a4d]"
          >
            Upgrade
          </Link>
        </div>
      </div>

      <Card className="rounded-3xl border-slate-200/70 shadow-sm bg-white/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Wallet size={18} className="text-teal-600" />
            Plano atual
          </CardTitle>
          <CardDescription>
            {data?.tenant?.name ?? "Empresa"} ({data?.tenant?.slug ?? "-"})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">A carregar...</p>
          ) : sub ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xl font-bold text-slate-900">{sub.planName}</p>
                  <p className="text-sm text-slate-500">Código: {sub.planCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-teal-700">
                    {formatCurrency(Number(sub.priceMonthly))}
                    <span className="text-sm text-slate-500 font-medium">/mês</span>
                  </p>
                  <Badge className="mt-1 bg-teal-500/15 text-teal-700 hover:bg-teal-500/15">ATIVO</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Users */}
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Users size={12} className="text-slate-400" />
                      Utilizadores
                    </p>
                    <span className="text-xs font-medium text-slate-500">
                      {userCount} / {sub.maxUsers}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{userCount}</p>
                  <Progress
                    value={sub.maxUsers > 0 ? (userCount / sub.maxUsers) * 100 : 0}
                    className="h-1.5"
                  />
                </div>

                {/* Departments */}
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Building2 size={12} className="text-slate-400" />
                      Departamentos
                    </p>
                    <span className="text-xs font-medium text-slate-500">
                      {deptCount} / {sub.maxDepartments}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{deptCount}</p>
                  <Progress
                    value={sub.maxDepartments > 0 ? (deptCount / sub.maxDepartments) * 100 : 0}
                    className="h-1.5"
                  />
                </div>

                {/* Shifts per month */}
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <CalendarRange size={12} className="text-slate-400" />
                      Limite turnos/mês
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{sub.maxShiftsPerMonth}</p>
                  <p className="text-xs text-slate-400">máximo mensal do plano</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Link
                  to="/dashboard/billing/upgrade"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#0B1F3A] px-3 text-sm font-medium text-white hover:bg-[#0f2a4d]"
                >
                  Solicitar upgrade
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nenhuma subscrição ativa encontrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
