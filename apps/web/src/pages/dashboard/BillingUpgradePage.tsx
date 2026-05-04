import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export function BillingUpgradePage() {
  const qc = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const { data: plans, isLoading } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: async () => {
      const res = await api.get("/billing/plans");
      return (res.data.data ?? []) as Array<{
        id: string;
        name: string;
        code: string;
        priceMonthly: string;
        maxUsers: number;
        maxDepartments: number;
        maxShiftsPerMonth: number;
      }>;
    },
  });

  const selectedPlan = useMemo(
    () => plans?.find((p) => p.id === selectedPlanId),
    [plans, selectedPlanId],
  );

  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!selectedPlanId || !amount || !method || !file) {
        throw new Error("Preencha todos os campos obrigatórios e anexe o comprovativo");
      }
      const form = new FormData();
      form.append("requestedPlanId", selectedPlanId);
      form.append("amount", amount);
      form.append("method", method);
      if (reference.trim()) form.append("reference", reference.trim());
      if (notes.trim()) form.append("notes", notes.trim());
      form.append("file", file);

      await api.post("/billing/payments/submit", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      setError("");
      setReference("");
      setNotes("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["billing", "payments"] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.message ?? "Falha ao submeter pagamento");
    },
  });

  return (
    <div className="p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-2">Financeiro</p>
          <h1 className="text-2xl font-bold text-slate-900">Upgrade e submissão de pagamento</h1>
          <p className="text-slate-500 mt-1">Selecione um plano e envie o comprovativo para aprovação.</p>
        </div>
        <Link
          to="/dashboard/billing/payments"
          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Ver histórico
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 rounded-3xl border-slate-200/70 shadow-sm bg-white/90">
          <CardHeader>
            <CardTitle>Selecionar plano</CardTitle>
            <CardDescription>Todos os planos ativos disponíveis para sua empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-slate-500">A carregar planos...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plans?.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      setAmount(String(Number(plan.priceMonthly)));
                    }}
                    className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                      selectedPlanId === plan.id
                        ? "border-teal-400 bg-teal-50/50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{plan.name}</p>
                      <Badge variant="outline">{plan.code}</Badge>
                    </div>
                    <p className="text-sm text-teal-700 font-semibold mt-1">
                      {formatCurrency(Number(plan.priceMonthly))}/mês
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {plan.maxUsers} utilizadores • {plan.maxDepartments} departamentos • {plan.maxShiftsPerMonth} turnos/mês
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200/70 shadow-sm bg-white/90">
          <CardHeader>
            <CardTitle>Submeter comprovativo</CardTitle>
            <CardDescription>Campos obrigatórios para aprovação rápida</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Plano selecionado</Label>
              <Input value={selectedPlan ? `${selectedPlan.name} (${selectedPlan.code})` : ""} readOnly placeholder="Selecione um plano" />
            </div>
            <div className="space-y-2">
              <Label>Valor (AOA)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <select
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="TRANSFER">Transferência</option>
                <option value="CASH">Dinheiro</option>
                <option value="EXPRESS">Express</option>
                <option value="MULTICAIXA">Multicaixa</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Referência</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex.: TRX-2026-001" />
            </div>
            <div className="space-y-2">
              <Label>Comprovativo (obrigatório)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <Button
              onClick={() => submitPayment.mutate()}
              disabled={submitPayment.isPending}
              className="w-full rounded-xl bg-[#0B1F3A] hover:bg-[#0f2a4d]"
            >
              {submitPayment.isPending ? "A submeter..." : "Submeter pagamento"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
