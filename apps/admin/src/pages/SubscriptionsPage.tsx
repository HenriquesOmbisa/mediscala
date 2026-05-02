import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Plus } from "lucide-react";
import { formatDate } from "../lib/utils";

interface Subscription {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  tenant: { id: string; name: string; slug: string };
  plan: { name: string; code: string };
}

interface Tenant { id: string; name: string; slug: string }
interface Plan { id: string; name: string; code: string }

function CreateSubscriptionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tenantId, setTenantId] = useState("");
  const [planId, setPlanId] = useState("");
  const [days, setDays] = useState("30");
  const [error, setError] = useState("");

  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["tenants-select"],
    queryFn: async () => {
      const { data } = await api.get("/tenants");
      const payload = data?.data ?? data;
      return Array.isArray(payload) ? payload : [];
    },
  });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await api.get("/plans");
      const payload = data?.data ?? data;
      return Array.isArray(payload) ? payload : [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const startsAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + Number(days) * 86400000).toISOString();
      await api.post("/subscriptions", { tenantId, planId, startsAt, endsAt, status: "ACTIVE" });
    },
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: any) => setError(err.response?.data?.message ?? "Erro"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Nova Subscrição</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Empresa</label>
            <select className="input" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">Seleccionar empresa...</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Plano</label>
            <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Seleccionar plano...</option>
              {plans?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Duração (dias)</label>
            <input className="input" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !tenantId || !planId} className="btn-primary">
            {mutation.isPending ? "A criar..." : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  EXPIRED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function SubscriptionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data } = await api.get("/subscriptions");
      const payload = data?.data ?? data;
      if (!Array.isArray(payload)) return [];
      return payload.map((s: any) => ({
        id: s.id,
        status: s.status,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        tenant: {
          id: s.tenantId,
          name: s.tenantName,
          slug: s.tenantSlug,
        },
        plan: {
          name: s.planName,
          code: s.planCode,
        },
      }));
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscrições</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.length ?? 0} subscrição(ões)</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Subscrição
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Empresa</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Plano</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Período</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{s.tenant?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-700">{s.plan?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {formatDate(s.startsAt)} → {formatDate(s.endsAt)}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                    Nenhuma subscrição
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateSubscriptionModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["subscriptions"] })}
        />
      )}
    </div>
  );
}
