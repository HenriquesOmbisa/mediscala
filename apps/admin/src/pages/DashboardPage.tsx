import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CreditCard,
  Receipt,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";

type TenantStatus = "ACTIVE" | "TRIAL" | "SUSPENDED";
type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
type PaymentStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
type PaymentSubmissionStatus = "SUBMITTED" | "APPROVED" | "REJECTED";

interface Stats {
  tenants: { ACTIVE: number; SUSPENDED: number; TRIAL: number; total: number };
  subscriptions: { ACTIVE: number; EXPIRED: number; CANCELLED: number };
  payments: { PENDING: number; PAID: number; OVERDUE: number };
  recentTenants: Array<{ id: string; name: string; slug: string; status: string; createdAt: string }>;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
}

interface SubscriptionRow {
  tenantId: string;
  status: SubscriptionStatus;
  endsAt: string;
  planName: string;
}

interface PaymentRow {
  tenantId: string;
  status: PaymentStatus;
  submissionStatus: PaymentSubmissionStatus;
  amount: number;
  createdAt: string;
}

interface TenantHealthRow {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planName: string;
  endsAt: string;
  lastPaymentStatus: PaymentStatus | null;
  lastPaymentAmount: number;
  riskLevel: "HEALTHY" | "ATTENTION" | "CRITICAL";
}

const EMPTY_STATS: Stats = {
  tenants: { ACTIVE: 0, SUSPENDED: 0, TRIAL: 0, total: 0 },
  subscriptions: { ACTIVE: 0, EXPIRED: 0, CANCELLED: 0 },
  payments: { PENDING: 0, PAID: 0, OVERDUE: 0 },
  recentTenants: [],
};

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

function StatCard({
  label,
  value,
  icon: Icon,
  helper,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  helper: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  TRIAL: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-rose-100 text-rose-700",
};

const riskClasses: Record<TenantHealthRow["riskLevel"], string> = {
  HEALTHY: "bg-emerald-100 text-emerald-700",
  ATTENTION: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-rose-100 text-rose-700",
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await api.get("/stats");
      const payload =
        typeof response.data === "object" && response.data !== null && "data" in response.data
          ? (response.data as { data?: unknown }).data
          : response.data;

      const row = (payload ?? {}) as Record<string, unknown>;
      const tenants = (row.tenants ?? {}) as Record<string, unknown>;
      const subscriptions = (row.subscriptions ?? {}) as Record<string, unknown>;
      const payments = (row.payments ?? {}) as Record<string, unknown>;
      const recentTenants = Array.isArray(row.recentTenants)
        ? (row.recentTenants as Array<Record<string, unknown>>).map((tenant) => ({
            id: getString(tenant.id),
            name: getString(tenant.name),
            slug: getString(tenant.slug),
            status: getString(tenant.status, "TRIAL"),
            createdAt: getString(tenant.createdAt),
          }))
        : [];

      return {
        tenants: {
          total: getNumber(tenants.total),
          ACTIVE: getNumber(tenants.ACTIVE ?? tenants.active),
          TRIAL: getNumber(tenants.TRIAL ?? tenants.trial),
          SUSPENDED: getNumber(tenants.SUSPENDED ?? tenants.suspended),
        },
        subscriptions: {
          ACTIVE: getNumber(subscriptions.ACTIVE ?? subscriptions.active),
          EXPIRED: getNumber(subscriptions.EXPIRED ?? subscriptions.expired),
          CANCELLED: getNumber(subscriptions.CANCELLED ?? subscriptions.cancelled),
        },
        payments: {
          PENDING: getNumber(payments.PENDING ?? payments.pending),
          PAID: getNumber(payments.PAID ?? payments.paid),
          OVERDUE: getNumber(payments.OVERDUE ?? payments.overdue),
        },
        recentTenants,
      };
    },
  });

  const stats = data ?? EMPTY_STATS;

  const { data: tenants = [] } = useQuery<TenantRow[]>({
    queryKey: ["dashboard", "tenants"],
    queryFn: async () => {
      const response = await api.get("/tenants");
      return getPayloadArray(response.data).map((row) => ({
        id: getString(row.id),
        name: getString(row.name),
        slug: getString(row.slug),
        status: getString(row.status, "TRIAL") as TenantStatus,
      }));
    },
  });

  const { data: subscriptions = [] } = useQuery<SubscriptionRow[]>({
    queryKey: ["dashboard", "subscriptions"],
    queryFn: async () => {
      const response = await api.get("/subscriptions");
      return getPayloadArray(response.data).map((row) => ({
        tenantId: getString(row.tenantId),
        status: getString(row.status, "ACTIVE") as SubscriptionStatus,
        endsAt: getString(row.endsAt),
        planName: getString(row.planName, "Plano"),
      }));
    },
  });

  const { data: payments = [] } = useQuery<PaymentRow[]>({
    queryKey: ["dashboard", "payments"],
    queryFn: async () => {
      const response = await api.get("/payments");
      return getPayloadArray(response.data).map((row) => ({
        tenantId: getString(row.tenantId),
        status: getString(row.status, "PENDING") as PaymentStatus,
        submissionStatus: getString(
          row.submissionStatus,
          "SUBMITTED",
        ) as PaymentSubmissionStatus,
        amount: getNumber(row.amount),
        createdAt: getString(row.createdAt),
      }));
    },
  });

  const tenantHealth = useMemo(() => {
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

    const rows: TenantHealthRow[] = tenants.map((tenant) => {
      const subscription = latestSubscriptionByTenant.get(tenant.id);
      const payment = latestPaymentByTenant.get(tenant.id);

      if (!subscription) {
        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          planName: "Sem subscrição",
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
        planName: subscription.planName,
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
  }, [payments, subscriptions, tenants]);

  const criticalTenants = tenantHealth.filter((row) => row.riskLevel === "CRITICAL").length;
  const pendingApprovals = payments.filter((payment) => payment.submissionStatus === "SUBMITTED").length;
  const monthlyPaid = payments
    .filter((payment) => payment.status === "PAID")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const expiringSoon = subscriptions.filter((subscription) => {
    const daysLeft =
      (new Date(subscription.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return subscription.status === "ACTIVE" && daysLeft <= 20;
  }).length;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-56 rounded bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {["a", "b", "c", "d"].map((slot) => (
              <div key={slot} className="h-28 rounded-2xl bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Executivo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitoramento operacional de empresas, tenants, consumo de plano e risco financeiro.
          </p>
        </div>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Ver analytics completo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Empresas registadas"
          value={stats.tenants.total}
          icon={Building2}
          tone="bg-blue-50 text-blue-600"
          helper={`${stats.tenants.ACTIVE} ativas • ${stats.tenants.TRIAL} trial`}
        />
        <StatCard
          label="Subscrições ativas"
          value={stats.subscriptions.ACTIVE}
          icon={TrendingUp}
          tone="bg-emerald-50 text-emerald-600"
          helper={`${expiringSoon} em renovação próxima`}
        />
        <StatCard
          label="Valor pago acumulado"
          value={formatCurrency(monthlyPaid)}
          icon={CreditCard}
          tone="bg-teal-50 text-teal-600"
          helper={`${stats.payments.PAID} pagamentos liquidados`}
        />
        <StatCard
          label="Aprovações pendentes"
          value={pendingApprovals}
          icon={Receipt}
          tone="bg-amber-50 text-amber-600"
          helper={`${stats.payments.PENDING} com status financeiro pendente`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link
          to="/tenants"
          className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-teal-300 hover:shadow-sm transition"
        >
          <Building2 className="h-5 w-5 text-teal-600" />
          <p className="mt-2 font-semibold text-slate-900">Gerenciamento das empresas</p>
          <p className="mt-1 text-xs text-slate-500">
            Criar, atualizar e monitorar o ciclo de vida de cada tenant.
          </p>
        </Link>

        <Link
          to="/subscriptions"
          className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition"
        >
          <Sparkles className="h-5 w-5 text-blue-600" />
          <p className="mt-2 font-semibold text-slate-900">Consumo de planos</p>
          <p className="mt-1 text-xs text-slate-500">
            Acompanhe vencimentos, estado de subscrição e risco de renovação.
          </p>
        </Link>

        <Link
          to="/payments"
          className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-amber-300 hover:shadow-sm transition"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <p className="mt-2 font-semibold text-slate-900">Monitoramento financeiro</p>
          <p className="mt-1 text-xs text-slate-500">
            Gestão de pagamentos, aprovações e pendências críticas.
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white xl:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Monitoramento de status de consumo</h2>
              <p className="text-xs text-slate-500 mt-1">
                Tenants com maior risco para ação imediata.
              </p>
            </div>
            <span className="text-xs text-slate-500">Top {Math.min(8, tenantHealth.length)}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {tenantHealth.slice(0, 8).map((tenant) => (
              <div key={tenant.tenantId} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{tenant.tenantName}</p>
                  <p className="text-xs text-slate-500">
                    {tenant.planName} • até {formatDate(tenant.endsAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600">
                    {tenant.lastPaymentStatus ?? "Sem pagamento"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses[tenant.riskLevel]}`}>
                    {tenant.riskLevel}
                  </span>
                  <Link
                    to={`/tenants/${tenant.tenantId}`}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    Ver
                  </Link>
                </div>
              </div>
            ))}

            {!tenantHealth.length && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                Ainda não há tenants para monitoramento.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Empresas recentes</h2>
          </div>

          <div className="divide-y divide-slate-100">
            {stats.recentTenants.map((tenant) => (
              <div key={tenant.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{tenant.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[tenant.status] ?? "bg-slate-100 text-slate-700"}`}>
                    {tenant.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{tenant.slug} • {formatDate(tenant.createdAt)}</p>
              </div>
            ))}

            {!stats.recentTenants.length && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Sem empresas recentes.</p>
            )}
          </div>
        </div>
      </div>

      {criticalTenants > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <ShieldAlert className="h-4 w-4" />
          Existem {criticalTenants} tenant(s) em estado crítico de consumo ou cobrança.
        </div>
      )}
    </div>
  );
}
