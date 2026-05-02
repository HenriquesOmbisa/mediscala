import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Plus, CheckCircle } from "lucide-react";
import { formatDate, formatCurrency } from "../lib/utils";

interface Payment {
  id: string;
  amount: number;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  tenant: { id: string; name: string; slug: string };
}

interface Tenant { id: string; name: string }

function RecordPaymentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    tenantId: "",
    amount: "",
    dueDate: "",
    notes: "",
  });
  const [error, setError] = useState("");

  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["tenants-select"],
    queryFn: async () => {
      const { data } = await api.get("/tenants");
      const payload = data?.data ?? data;
      return Array.isArray(payload) ? payload : [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/payments", {
        tenantId: form.tenantId,
        amount: Number(form.amount),
        dueDate: form.dueDate || null,
        notes: form.notes || null,
        status: "PENDING",
      });
    },
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: any) => setError(err.response?.data?.message ?? "Erro"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Registar Pagamento</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Empresa</label>
            <select className="input" value={form.tenantId} onChange={set("tenantId")}>
              <option value="">Seleccionar empresa...</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (AOA)</label>
              <input className="input" type="number" value={form.amount} onChange={set("amount")} />
            </div>
            <div>
              <label className="label">Data de vencimento</label>
              <input className="input" type="date" value={form.dueDate} onChange={set("dueDate")} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.tenantId || !form.amount}
            className="btn-primary"
          >
            {mutation.isPending ? "A guardar..." : "Registar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default function PaymentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Payment[]>({
    queryKey: ["payments", { status: statusFilter }],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const { data } = await api.get(`/payments${params}`);
      const payload = data?.data ?? data;
      if (!Array.isArray(payload)) return [];
      return payload.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount ?? 0),
        status: p.status,
        dueDate: p.dueDate,
        paidAt: p.paidAt,
        notes: p.notes,
        tenant: {
          id: p.tenantId,
          name: p.tenantName,
          slug: p.tenantSlug,
        },
      }));
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/payments/${id}`, { status: "PAID", paidAt: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.length ?? 0} pagamento(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input text-sm py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os estados</option>
            <option value="PENDING">Pendentes</option>
            <option value="PAID">Pagos</option>
            <option value="OVERDUE">Em atraso</option>
          </select>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Registar
          </button>
        </div>
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
                <th className="text-left px-5 py-3 font-medium text-gray-600">Valor</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Vencimento</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Pago em</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{p.tenant?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-700 font-medium">{formatCurrency(p.amount)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(p.dueDate)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(p.paidAt)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[p.status] ?? "bg-gray-100"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.status === "PENDING" && (
                      <button
                        onClick={() => markPaidMutation.mutate(p.id)}
                        className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 hover:bg-green-50 px-2 py-1 rounded-md transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Marcar pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    Nenhum pagamento encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <RecordPaymentModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["payments"] })}
        />
      )}
    </div>
  );
}
