import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Plus, Pencil } from "lucide-react";
import { formatCurrency } from "../lib/utils";

interface Plan {
  id: string;
  name: string;
  code: string;
  price: number;
  maxUsers: number;
  maxDepartments: number;
  maxShiftsPerMonth: number;
  active: boolean;
}

function PlanModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan?: Plan;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: plan?.name ?? "",
    code: plan?.code ?? "",
    price: plan?.price?.toString() ?? "0",
    maxUsers: plan?.maxUsers?.toString() ?? "10",
    maxDepartments: plan?.maxDepartments?.toString() ?? "5",
    maxShiftsPerMonth: plan?.maxShiftsPerMonth?.toString() ?? "100",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const body = {
        name: data.name,
        code: data.code,
        priceMonthly: String(Number(data.price)),
        maxUsers: Number(data.maxUsers),
        maxDepartments: Number(data.maxDepartments),
        maxShiftsPerMonth: Number(data.maxShiftsPerMonth),
      };
      if (plan) {
        await api.patch(`/plans/${plan.id}`, body);
      } else {
        await api.post("/plans", body);
      }
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message ?? "Erro");
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">{plan ? "Editar Plano" : "Novo Plano"}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={set("name")} />
            </div>
            <div>
              <label className="label">Código</label>
              <input className="input" value={form.code} onChange={set("code")} disabled={!!plan} />
            </div>
          </div>
          <div>
            <label className="label">Preço (AOA/mês)</label>
            <input className="input" type="number" value={form.price} onChange={set("price")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Max Utilizadores</label>
              <input className="input" type="number" value={form.maxUsers} onChange={set("maxUsers")} />
            </div>
            <div>
              <label className="label">Max Departamentos</label>
              <input className="input" type="number" value={form.maxDepartments} onChange={set("maxDepartments")} />
            </div>
            <div>
              <label className="label">Max Turnos/Mês</label>
              <input className="input" type="number" value={form.maxShiftsPerMonth} onChange={set("maxShiftsPerMonth")} />
            </div>
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? "A guardar..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [modal, setModal] = useState<{ open: boolean; plan?: Plan }>({ open: false });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await api.get("/plans");
      const payload = data?.data ?? data;
      if (!Array.isArray(payload)) return [];
      return payload.map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        price: Number(p.priceMonthly ?? p.price ?? 0),
        maxUsers: Number(p.maxUsers ?? 0),
        maxDepartments: Number(p.maxDepartments ?? 0),
        maxShiftsPerMonth: Number(p.maxShiftsPerMonth ?? 0),
        active: Boolean(p.active ?? true),
      }));
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planos</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.length ?? 0} plano(s)</p>
        </div>
        <button onClick={() => setModal({ open: true })} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Plano
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((plan) => (
            <div key={plan.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{plan.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{plan.code}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!plan.active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                  <button
                    onClick={() => setModal({ open: true, plan })}
                    className="p-1 hover:bg-gray-100 rounded-md"
                  >
                    <Pencil className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(plan.price)}<span className="text-sm font-normal text-gray-400">/mês</span></p>
              <div className="mt-3 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Utilizadores</span>
                  <span className="font-medium">{plan.maxUsers === 999999 ? "∞" : plan.maxUsers}</span>
                </div>
                <div className="flex justify-between">
                  <span>Departamentos</span>
                  <span className="font-medium">{plan.maxDepartments === 999999 ? "∞" : plan.maxDepartments}</span>
                </div>
                <div className="flex justify-between">
                  <span>Turnos/mês</span>
                  <span className="font-medium">{plan.maxShiftsPerMonth === 999999 ? "∞" : plan.maxShiftsPerMonth}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <PlanModal
          plan={modal.plan}
          onClose={() => setModal({ open: false })}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["plans"] })}
        />
      )}
    </div>
  );
}
