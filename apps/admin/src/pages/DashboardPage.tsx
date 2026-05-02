import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Building2, CreditCard, AlertCircle, TrendingUp } from "lucide-react";
import { formatDate } from "../lib/utils";

interface Stats {
  tenants: { ACTIVE: number; SUSPENDED: number; TRIAL: number; total: number };
  subscriptions: { ACTIVE: number; EXPIRED: number; CANCELLED: number };
  payments: { PENDING: number; PAID: number };
  recentTenants: Array<{ id: string; name: string; slug: string; status: string; createdAt: string }>;
}

const EMPTY_STATS: Stats = {
  tenants: { ACTIVE: 0, SUSPENDED: 0, TRIAL: 0, total: 0 },
  subscriptions: { ACTIVE: 0, EXPIRED: 0, CANCELLED: 0 },
  payments: { PENDING: 0, PAID: 0 },
  recentTenants: [],
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  TRIAL: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data } = await api.get("/stats");

      const payload = (data?.data ?? data ?? {}) as {
        tenants?: {
          total?: number;
          active?: number;
          trial?: number;
          suspended?: number;
          ACTIVE?: number;
          TRIAL?: number;
          SUSPENDED?: number;
        };
        subscriptions?: {
          active?: number;
          expired?: number;
          cancelled?: number;
          ACTIVE?: number;
          EXPIRED?: number;
          CANCELLED?: number;
        };
        payments?: {
          pending?: number;
          paid?: number;
          overdue?: number;
          PENDING?: number;
          PAID?: number;
        };
        recentTenants?: Array<{ id: string; name: string; slug: string; status: string; createdAt: string }>;
      };

      return {
        tenants: {
          total: Number(payload.tenants?.total ?? 0),
          ACTIVE: Number(payload.tenants?.ACTIVE ?? payload.tenants?.active ?? 0),
          TRIAL: Number(payload.tenants?.TRIAL ?? payload.tenants?.trial ?? 0),
          SUSPENDED: Number(payload.tenants?.SUSPENDED ?? payload.tenants?.suspended ?? 0),
        },
        subscriptions: {
          ACTIVE: Number(payload.subscriptions?.ACTIVE ?? payload.subscriptions?.active ?? 0),
          EXPIRED: Number(payload.subscriptions?.EXPIRED ?? payload.subscriptions?.expired ?? 0),
          CANCELLED: Number(payload.subscriptions?.CANCELLED ?? payload.subscriptions?.cancelled ?? 0),
        },
        payments: {
          PENDING: Number(payload.payments?.PENDING ?? payload.payments?.pending ?? 0),
          PAID: Number(payload.payments?.PAID ?? payload.payments?.paid ?? 0),
        },
        recentTenants: payload.recentTenants ?? [],
      };
    },
  });

  const stats = data ?? EMPTY_STATS;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total de Empresas"
          value={stats.tenants.total}
          icon={Building2}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Subscrições Activas"
          value={stats.subscriptions.ACTIVE}
          icon={TrendingUp}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Pagamentos Pendentes"
          value={stats.payments.PENDING}
          icon={AlertCircle}
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          label="Pagamentos Recebidos"
          value={stats.payments.PAID}
          icon={CreditCard}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Tenant breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Activas", count: stats.tenants.ACTIVE, color: "text-green-600 bg-green-50" },
          { label: "Trial", count: stats.tenants.TRIAL, color: "text-blue-600 bg-blue-50" },
          { label: "Suspensas", count: stats.tenants.SUSPENDED, color: "text-red-600 bg-red-50" },
        ].map(({ label, count, color }) => (
          <div key={label} className={`rounded-xl p-5 ${color}`}>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-3xl font-bold mt-1">{count}</p>
          </div>
        ))}
      </div>

      {/* Recent tenants */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Empresas Recentes</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {stats.recentTenants.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">{t.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[t.status] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {t.status}
                </span>
                <span className="text-xs text-gray-400">{formatDate(t.createdAt)}</span>
              </div>
            </div>
          ))}
          {!stats.recentTenants.length && (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">Nenhuma empresa ainda</p>
          )}
        </div>
      </div>
    </div>
  );
}
