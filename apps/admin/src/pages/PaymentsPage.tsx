import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Plus, CheckCircle, XCircle, Eye } from "lucide-react";
import { formatDate, formatCurrency } from "../lib/utils";

interface Payment {
  id: string;
  amount: number;
  status: string;
  submissionStatus: "SUBMITTED" | "APPROVED" | "REJECTED";
  dueDate: string | null;
  paidAt: string | null;
  proofUrl: string | null;
  reviewReason: string | null;
  requestedPlanName: string | null;
  requestedPlanCode: string | null;
  requestedPlanId: string | null;
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
        submissionStatus: "APPROVED",
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

const submissionColors: Record<string, string> = {
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

export default function PaymentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [submissionFilter, setSubmissionFilter] = useState("SUBMITTED");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Payment[]>({
    queryKey: ["payments", { status: statusFilter, submissionStatus: submissionFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (submissionFilter) params.set("submissionStatus", submissionFilter);
      const query = params.toString();
      const { data } = await api.get(`/payments${query ? `?${query}` : ""}`);
      const payload = data?.data ?? data;
      if (!Array.isArray(payload)) return [];
      return payload.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount ?? 0),
        status: p.status,
        submissionStatus: p.submissionStatus,
        dueDate: p.dueDate,
        paidAt: p.paidAt,
        proofUrl: p.proofUrl ?? null,
        reviewReason: p.reviewReason ?? null,
        requestedPlanName: p.requestedPlanName ?? null,
        requestedPlanCode: p.requestedPlanCode ?? null,
        requestedPlanId: p.requestedPlanId ?? null,
        notes: p.notes,
        tenant: {
          id: p.tenantId,
          name: p.tenantName,
          slug: p.tenantSlug,
        },
      }));
    },
  });

  const submittedCount = useMemo(
    () => data?.filter((p) => p.submissionStatus === "SUBMITTED").length ?? 0,
    [data],
  );

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/payments/${id}`, { status: "PAID", paidAt: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });

  const approveMutation = useMutation({
    mutationFn: async (payment: Payment) =>
      api.post(`/payments/${payment.id}/approve`, {
        planId: payment.requestedPlanId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      api.post(`/payments/${paymentId}/reject`, { reviewReason: reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.length ?? 0} registo(s) • {submittedCount} pendente(s) de análise
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input text-sm py-2"
            value={submissionFilter}
            onChange={(e) => setSubmissionFilter(e.target.value)}
          >
            <option value="">Todas as submissões</option>
            <option value="SUBMITTED">Submetidos</option>
            <option value="APPROVED">Aprovados</option>
            <option value="REJECTED">Rejeitados</option>
          </select>
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
                <th className="text-left px-5 py-3 font-medium text-gray-600">Plano solicitado</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Valor</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Submissão</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Vencimento</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Pago em</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Contábil</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{p.tenant?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {p.requestedPlanName ? `${p.requestedPlanName} (${p.requestedPlanCode ?? "-"})` : "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-700 font-medium">{formatCurrency(p.amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${submissionColors[p.submissionStatus] ?? "bg-gray-100"}`}>
                      {p.submissionStatus}
                    </span>
                    {p.reviewReason && (
                      <p className="text-xs text-rose-600 mt-1">{p.reviewReason}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(p.dueDate)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(p.paidAt)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[p.status] ?? "bg-gray-100"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.proofUrl && (
                        <a
                          href={p.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Prova
                        </a>
                      )}
                      {p.submissionStatus === "SUBMITTED" && (
                        <>
                          <button
                            onClick={() => approveMutation.mutate(p)}
                            disabled={approveMutation.isPending}
                            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 px-2 py-1 rounded-md transition-colors"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => {
                              const reason = window.prompt("Motivo da rejeição:");
                              if (!reason) return;
                              rejectMutation.mutate({ paymentId: p.id, reason });
                            }}
                            disabled={rejectMutation.isPending}
                            className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Rejeitar
                          </button>
                        </>
                      )}
                      {p.status === "PENDING" && p.submissionStatus !== "SUBMITTED" && (
                        <button
                          onClick={() => markPaidMutation.mutate(p.id)}
                          className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 hover:bg-green-50 px-2 py-1 rounded-md transition-colors"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Marcar pago
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-gray-400">
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
