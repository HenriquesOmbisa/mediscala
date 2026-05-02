import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Plus, Search, Eye, MoreVertical } from "lucide-react";
import { formatDate } from "../lib/utils";
import { Link } from "react-router-dom";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  dbName: string;
  status: "ACTIVE" | "SUSPENDED" | "TRIAL";
  contactEmail: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  TRIAL: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-red-100 text-red-700",
};

function CreateTenantModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    contactEmail: "",
    planCode: "STARTER",
    notes: "",
    adminEmail: "",
    adminPassword: "",
    adminName: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      await api.post("/tenants", data);
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message ?? "Erro ao criar empresa");
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Nova Empresa</h2>

        <div className="space-y-3">
          <div>
            <label className="label">Nome da Empresa</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => {
                set("name")(e);
                setForm((f) => ({ ...f, slug: autoSlug(e.target.value) }));
              }}
            />
          </div>
          <div>
            <label className="label">Slug (identificador)</label>
            <input className="input" value={form.slug} onChange={set("slug")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email de Contacto</label>
              <input className="input" type="email" value={form.contactEmail} onChange={set("contactEmail")} />
            </div>
            <div>
              <label className="label">Plano</label>
              <select className="input" value={form.planCode} onChange={set("planCode")}>
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Administrador Inicial</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nome</label>
                <input className="input" value={form.adminName} onChange={set("adminName")} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.adminEmail} onChange={set("adminEmail")} />
              </div>
              <div className="col-span-2">
                <label className="label">Palavra-passe</label>
                <input className="input" type="password" value={form.adminPassword} onChange={set("adminPassword")} />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? "A criar..." : "Criar Empresa"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Tenant[]>({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data } = await api.get("/tenants");
      const payload = data?.data ?? data;
      return Array.isArray(payload) ? payload : [];
    },
  });

  const filtered = data?.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.includes(search.toLowerCase()),
  );

  const suspendMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/tenants/${id}`, { status: "SUSPENDED" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants"] }),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.length ?? 0} empresa(s) registada(s)</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Empresa
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Pesquisar por nome ou slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                <th className="text-left px-5 py-3 font-medium text-gray-600">Slug / BD</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Criada em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered?.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.contactEmail}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-gray-700 font-mono text-xs">{t.slug}</p>
                    <p className="text-gray-400 font-mono text-xs">{t.dbName}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[t.status]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(t.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Link
                        to={`/tenants/${t.id}`}
                        className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {t.status !== "SUSPENDED" && (
                        <button
                          onClick={() => {
                            if (confirm(`Suspender "${t.name}"?`)) suspendMutation.mutate(t.id);
                          }}
                          className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                          title="Suspender"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered?.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    Nenhuma empresa encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["tenants"] })}
        />
      )}
    </div>
  );
}
