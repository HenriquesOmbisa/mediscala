import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { formatDate, formatCurrency } from "../lib/utils";

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  dbName: string;
  status: string;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
}

interface Subscription {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  plan: { name: string; code: string };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  TRIAL: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-gray-100 text-gray-600",
  PENDING: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: tenant, isLoading } = useQuery<TenantDetail>({
    queryKey: ["tenant", id],
    queryFn: async () => {
      const { data } = await api.get(`/tenants/${id}`);
      return (data?.data ?? data) as TenantDetail;
    },
  });

  const { data: subscriptions } = useQuery<Subscription[]>({
    queryKey: ["subscriptions", { tenantId: id }],
    queryFn: async () => {
      const { data } = await api.get(`/subscriptions?tenantId=${id}`);
      const payload = data?.data ?? data;
      if (!Array.isArray(payload)) return [];
      return payload.map((s: any) => ({
        id: s.id,
        status: s.status,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        plan: {
          name: s.planName,
          code: s.planCode,
        },
      }));
    },
  });

  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["payments", { tenantId: id }],
    queryFn: async () => {
      const { data } = await api.get(`/payments?tenantId=${id}`);
      const payload = data?.data ?? data;
      if (!Array.isArray(payload)) return [];
      return payload.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount ?? 0),
        status: p.status,
        dueDate: p.dueDate,
        paidAt: p.paidAt,
        notes: p.notes,
      }));
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => api.patch(`/tenants/${id}`, { status: "ACTIVE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", id] }),
  });

  const suspendMutation = useMutation({
    mutationFn: async () => api.patch(`/tenants/${id}`, { status: "SUSPENDED" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", id] }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => api.patch(`/payments/${paymentId}`, { status: "PAID", paidAt: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments", { tenantId: id }] }),
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/tenants" className="p-1.5 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
          <p className="text-sm text-gray-500">{tenant.slug}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColors[tenant.status]}`}>
            {tenant.status}
          </span>
          {tenant.status !== "ACTIVE" && (
            <button onClick={() => activateMutation.mutate()} className="btn-primary text-sm">
              Activar
            </button>
          )}
          {tenant.status === "ACTIVE" && (
            <button onClick={() => suspendMutation.mutate()} className="btn-danger text-sm">
              Suspender
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Email de contacto</p>
          <p className="font-medium text-gray-900">{tenant.contactEmail ?? "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">Base de dados</p>
          <p className="font-mono text-gray-900">{tenant.dbName}</p>
        </div>
        <div>
          <p className="text-gray-500">Registada em</p>
          <p className="font-medium text-gray-900">{formatDate(tenant.createdAt)}</p>
        </div>
        {tenant.notes && (
          <div className="col-span-2">
            <p className="text-gray-500">Notas</p>
            <p className="text-gray-900">{tenant.notes}</p>
          </div>
        )}
      </div>

      {/* Subscriptions */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Subscrições</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {subscriptions?.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{s.plan.name}</p>
                <p className="text-xs text-gray-400">{formatDate(s.startsAt)} → {formatDate(s.endsAt)}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[s.status]}`}>
                {s.status}
              </span>
            </div>
          ))}
          {!subscriptions?.length && (
            <p className="px-5 py-4 text-sm text-gray-400">Nenhuma subscrição</p>
          )}
        </div>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Pagamentos</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {payments?.map((p) => (
            <div key={p.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(p.amount)}</p>
                <p className="text-xs text-gray-400">
                  Vence: {formatDate(p.dueDate)} {p.paidAt ? `• Pago: ${formatDate(p.paidAt)}` : ""}
                </p>
                {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[p.status]}`}>
                  {p.status}
                </span>
                {p.status === "PENDING" && (
                  <button
                    onClick={() => markPaidMutation.mutate(p.id)}
                    className="p-1 hover:bg-green-50 hover:text-green-600 rounded-md"
                    title="Marcar como pago"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {!payments?.length && (
            <p className="px-5 py-4 text-sm text-gray-400">Nenhum pagamento</p>
          )}
        </div>
      </div>
    </div>
  );
}
