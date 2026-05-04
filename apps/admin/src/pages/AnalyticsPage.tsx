import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, ArrowUpRight, Building2, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";

type TenantStatus = "ACTIVE" | "TRIAL" | "SUSPENDED";
type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
type PaymentStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
type PaymentSubmissionStatus = "SUBMITTED" | "APPROVED" | "REJECTED";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
}

interface SubscriptionRow {
  id: string;
  tenantId: string;
  tenantName: string;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string;
  planId: string;
  planName: string;
}

interface PaymentRow {
  id: string;
  tenantId: string;
  tenantName: string;
  status: PaymentStatus;
  submissionStatus: PaymentSubmissionStatus;
  amount: number;
  createdAt: string;
  dueDate: string | null;
}

interface PlanRow {
  id: string;
  name: string;
  code: string;
  priceMonthly: number;
}

interface PlanConsumptionRow {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planName: string;
  planCode: string;
  subscriptionStatus: SubscriptionStatus;
  endsAt: string;
  lastPaymentStatus: PaymentStatus | null;
  lastPaymentAmount: number;
  riskLevel: "HEALTHY" | "ATTENTION" | "CRITICAL";
}

function getPayloadArray(value: unknown): Array<Record<string, unknown>> {
  const payload =
    typeof value === "object" && value !== null && "data" in value
      ? (value as { data?: unknown }).data
      : value;

  if (!Array.isArray(payload)) return [];
  return payload as Array<Record<string, unknown>>;
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getMonthKey(dateInput: string | Date): string {
  const date = new Date(dateInput);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("pt-AO", { month: "short" }).format(date);
}

function getLastMonths(size: number): string[] {
  const now = new Date();
  const months: string[] = [];

  for (let i = size - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthKey(date));
  }

  return months;
}

function getRiskLevel(args: {
  tenantStatus: TenantStatus;
  subscriptionStatus: SubscriptionStatus;
  endsAt: string;
  paymentStatus: PaymentStatus | null;
}): "HEALTHY" | "ATTENTION" | "CRITICAL" {
  const daysLeft = Math.ceil(
    (new Date(args.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  if (
    args.tenantStatus === "SUSPENDED" ||
    args.subscriptionStatus !== "ACTIVE" ||
    args.paymentStatus === "OVERDUE" ||
    daysLeft <= 7
  ) {
    return "CRITICAL";
  }

  if (args.paymentStatus === "PENDING" || daysLeft <= 20) {
    return "ATTENTION";
  }

  return "HEALTHY";
}

function AreaChartCard({
  title,
  subtitle,
  data,
  series,
}: {
  title: string;
  subtitle: string;
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; color: string; name: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
            <defs>
              {series.map((item) => (
                <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={item.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={item.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "#64748B" }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748B" }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                borderColor: "#E2E8F0",
                boxShadow: "0 10px 25px rgba(2, 6, 23, 0.08)",
              }}
            />
            {series.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.name}
                stroke={item.color}
                strokeWidth={2}
                fill={`url(#fill-${item.key})`}
                fillOpacity={1}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const riskClasses: Record<PlanConsumptionRow["riskLevel"], string> = {
  HEALTHY: "bg-emerald-100 text-emerald-700",
  ATTENTION: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-rose-100 text-rose-700",
};

export default function AnalyticsPage() {
  const { data: tenants = [] } = useQuery<TenantRow[]>({
    queryKey: ["analytics", "tenants"],
    queryFn: async () => {
      const response = await api.get("/tenants");
      return getPayloadArray(response.data).map((row) => ({
        id: getString(row.id),
        name: getString(row.name),
        slug: getString(row.slug),
        status: getString(row.status, "TRIAL") as TenantStatus,
        createdAt: getString(row.createdAt),
      }));
    },
  });

  const { data: subscriptions = [] } = useQuery<SubscriptionRow[]>({
    queryKey: ["analytics", "subscriptions"],
    queryFn: async () => {
      const response = await api.get("/subscriptions");
      return getPayloadArray(response.data).map((row) => ({
        id: getString(row.id),
        tenantId: getString(row.tenantId),
        tenantName: getString(row.tenantName),
        status: getString(row.status, "ACTIVE") as SubscriptionStatus,
        startsAt: getString(row.startsAt),
        endsAt: getString(row.endsAt),
        planId: getString(row.planId),
        planName: getString(row.planName),
      }));
    },
  });

  const { data: payments = [] } = useQuery<PaymentRow[]>({
    queryKey: ["analytics", "payments"],
    queryFn: async () => {
      const response = await api.get("/payments");
      return getPayloadArray(response.data).map((row) => ({
        id: getString(row.id),
        tenantId: getString(row.tenantId),
        tenantName: getString(row.tenantName),
        status: getString(row.status, "PENDING") as PaymentStatus,
        submissionStatus: getString(
          row.submissionStatus,
          "SUBMITTED",
        ) as PaymentSubmissionStatus,
        amount: getNumber(row.amount),
        createdAt: getString(row.createdAt),
        dueDate: getNullableString(row.dueDate),
      }));
    },
  });

  const { data: plans = [] } = useQuery<PlanRow[]>({
    queryKey: ["analytics", "plans"],
    queryFn: async () => {
      const response = await api.get("/plans");
      return getPayloadArray(response.data).map((row) => ({
        id: getString(row.id),
        name: getString(row.name),
        code: getString(row.code),
        priceMonthly: getNumber(row.priceMonthly ?? row.price),
      }));
    },
  });

  const growthData = useMemo(() => {
    const monthKeys = getLastMonths(6);
    let cumulative = 0;

    return monthKeys.map((monthKey) => {
      const monthCount = tenants.filter((tenant) => getMonthKey(tenant.createdAt) === monthKey).length;
      cumulative += monthCount;
      return {
        month: getMonthLabel(monthKey),
        novasEmpresas: monthCount,
        totalAcumulado: cumulative,
      };
    });
  }, [tenants]);

  const revenueData = useMemo(() => {
    const monthKeys = getLastMonths(6);

    return monthKeys.map((monthKey) => {
      const items = payments.filter((payment) => getMonthKey(payment.createdAt) === monthKey);
      const pago = items
        .filter((item) => item.status === "PAID")
        .reduce((total, item) => total + item.amount, 0);
      const pendente = items
        .filter((item) => item.status === "PENDING" || item.status === "OVERDUE")
        .reduce((total, item) => total + item.amount, 0);

      return {
        month: getMonthLabel(monthKey),
        pago,
        pendente,
      };
    });
  }, [payments]);

  const consumptionRows = useMemo(() => {
    const latestSubscriptionByTenant = new Map<string, SubscriptionRow>();
    for (const subscription of subscriptions) {
      const existing = latestSubscriptionByTenant.get(subscription.tenantId);
      if (!existing || new Date(subscription.endsAt).getTime() > new Date(existing.endsAt).getTime()) {
        latestSubscriptionByTenant.set(subscription.tenantId, subscription);
      }
    }

    const latestPaymentByTenant = new Map<string, PaymentRow>();
    for (const payment of payments) {
      const existing = latestPaymentByTenant.get(payment.tenantId);
      if (!existing || new Date(payment.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        latestPaymentByTenant.set(payment.tenantId, payment);
      }
    }

    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    const rows: PlanConsumptionRow[] = tenants.map((tenant) => {
      const subscription = latestSubscriptionByTenant.get(tenant.id);
      const payment = latestPaymentByTenant.get(tenant.id);
      const plan = subscription ? planById.get(subscription.planId) : null;

      if (!subscription) {
        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          planName: "Sem plano",
          planCode: "—",
          subscriptionStatus: "EXPIRED",
          endsAt: "",
          lastPaymentStatus: payment?.status ?? null,
          lastPaymentAmount: payment?.amount ?? 0,
          riskLevel: "CRITICAL",
        };
      }

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        planName: subscription.planName || plan?.name || "Plano",
        planCode: plan?.code ?? "—",
        subscriptionStatus: subscription.status,
        endsAt: subscription.endsAt,
        lastPaymentStatus: payment?.status ?? null,
        lastPaymentAmount: payment?.amount ?? 0,
        riskLevel: getRiskLevel({
          tenantStatus: tenant.status,
          subscriptionStatus: subscription.status,
          endsAt: subscription.endsAt,
          paymentStatus: payment?.status ?? null,
        }),
      };
    });

    const order = { CRITICAL: 0, ATTENTION: 1, HEALTHY: 2 };
    rows.sort((a, b) => order[a.riskLevel] - order[b.riskLevel]);

    return rows;
  }, [payments, plans, subscriptions, tenants]);

  const analyticsKpis = useMemo(() => {
    const activeTenants = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "ACTIVE").length;
    const pendingApprovals = payments.filter((payment) => payment.submissionStatus === "SUBMITTED").length;

    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const estimatedMrr = subscriptions
      .filter((subscription) => subscription.status === "ACTIVE")
      .reduce((sum, subscription) => sum + (planById.get(subscription.planId)?.priceMonthly ?? 0), 0);

    return {
      activeTenants,
      activeSubscriptions,
      pendingApprovals,
      estimatedMrr,
      criticalTenants: consumptionRows.filter((row) => row.riskLevel === "CRITICAL").length,
    };
  }, [consumptionRows, payments, plans, subscriptions, tenants]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tendências de crescimento, receita, risco de consumo e saúde de tenants.
          </p>
        </div>
        <Link
          to="/tenants"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Gerir empresas
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Empresas ativas</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{analyticsKpis.activeTenants}</p>
          <p className="text-xs text-slate-500 mt-1">de {tenants.length} tenants</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Subscrições ativas</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{analyticsKpis.activeSubscriptions}</p>
          <p className="text-xs text-slate-500 mt-1">estado operacional</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">MRR estimado</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(analyticsKpis.estimatedMrr)}</p>
          <p className="text-xs text-slate-500 mt-1">base em subscrições ativas</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Aprovações pendentes</p>
          <p className="text-2xl font-bold text-amber-700 mt-2">{analyticsKpis.pendingApprovals}</p>
          <p className="text-xs text-slate-500 mt-1">pagamentos submetidos</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs uppercase tracking-wider text-rose-600">Tenants críticos</p>
          <p className="text-2xl font-bold text-rose-700 mt-2">{analyticsKpis.criticalTenants}</p>
          <p className="text-xs text-rose-600/80 mt-1">necessitam ação imediata</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AreaChartCard
          title="Crescimento de empresas"
          subtitle="Novas ativações e evolução acumulada nos últimos 6 meses"
          data={growthData}
          series={[
            { key: "novasEmpresas", color: "#14B8A6", name: "Novas" },
            { key: "totalAcumulado", color: "#0B1F3A", name: "Total" },
          ]}
        />
        <AreaChartCard
          title="Receita vs pendências"
          subtitle="Comparativo mensal de pagamentos pagos e em aberto"
          data={revenueData}
          series={[
            { key: "pago", color: "#0F766E", name: "Pago" },
            { key: "pendente", color: "#F59E0B", name: "Pendente" },
          ]}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Monitoramento de consumo do plano</p>
            <p className="text-xs text-slate-500 mt-1">
              Estado de risco por tenant com base em subscrição, vencimento e pagamento.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Saudável
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Atenção
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Crítico
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-slate-600">Empresa</th>
                <th className="px-5 py-3 text-left font-medium text-slate-600">Plano</th>
                <th className="px-5 py-3 text-left font-medium text-slate-600">Subscrição</th>
                <th className="px-5 py-3 text-left font-medium text-slate-600">Último pagamento</th>
                <th className="px-5 py-3 text-left font-medium text-slate-600">Valor</th>
                <th className="px-5 py-3 text-left font-medium text-slate-600">Nível de risco</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {consumptionRows.slice(0, 12).map((row) => (
                <tr key={row.tenantId} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{row.tenantName}</p>
                    <p className="text-xs text-slate-500">{row.tenantSlug}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-slate-800">{row.planName}</p>
                    <p className="text-xs text-slate-500">{row.planCode}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-slate-800">{row.subscriptionStatus}</p>
                    <p className="text-xs text-slate-500">Até {formatDate(row.endsAt)}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{row.lastPaymentStatus ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-700">{formatCurrency(row.lastPaymentAmount)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses[row.riskLevel]}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/tenants/${row.tenantId}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
                    >
                      Ver tenant
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!consumptionRows.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">
                    Ainda não existem dados suficientes para monitoramento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/tenants"
          className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-teal-300 hover:shadow-sm transition"
        >
          <Building2 className="h-5 w-5 text-teal-600" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Gestão de Empresas</p>
          <p className="text-xs text-slate-500 mt-1">Criação, suspensão e detalhe operacional de tenants.</p>
        </Link>

        <Link
          to="/subscriptions"
          className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition"
        >
          <Activity className="h-5 w-5 text-blue-600" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Ciclo de Subscrições</p>
          <p className="text-xs text-slate-500 mt-1">Renovações, estados e previsão de vencimentos.</p>
        </Link>

        <Link
          to="/payments"
          className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition"
        >
          <Wallet className="h-5 w-5 text-amber-600" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Pagamentos e Aprovações</p>
          <p className="text-xs text-slate-500 mt-1">Conciliação financeira e análise de submissões pendentes.</p>
        </Link>
      </div>

      {analyticsKpis.criticalTenants > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2 text-rose-700 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Existem {analyticsKpis.criticalTenants} tenant(s) em nível crítico. Recomendado revisar imediatamente.
        </div>
      )}
    </div>
  );
}
