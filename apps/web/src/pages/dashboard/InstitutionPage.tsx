import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building,
  Mail,
  MapPin,
  FileText,
  Phone,
  Briefcase,
  CalendarDays,
  BadgeCheck,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { publicAssetUrl } from "@/lib/public-url";

type InstitutionData = {
  tenant: {
    name: string;
    slug: string;
    status: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    nif?: string | null;
    address?: string | null;
    areaOfActivity?: string | null;
    logoUrl?: string | null;
    brandDisplayMode?: "LOGO_AND_NAME" | "LOGO_ONLY" | null;
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  subscription: null | {
    planName: string;
    maxUsers: number;
    maxDepartments: number;
  };
};

type InstitutionForm = {
  name: string;
  nif: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  areaOfActivity: string;
  brandDisplayMode: "LOGO_AND_NAME" | "LOGO_ONLY";
  notes: string;
};

type PartialInstitutionSaveError = Error & { partialSave?: boolean };

function formatDate(date?: string) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function statusLabel(status?: string) {
  if (status === "ACTIVE") return "Ativa";
  if (status === "TRIAL") return "Trial";
  if (status === "SUSPENDED") return "Suspensa";
  return status ?? "-";
}

function parseApiMessage(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
  }
  return fallback;
}

export function InstitutionPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const canEditInstitution = user?.role === "HOSPITAL_ADMIN";

  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoBlobRef = useRef<string | null>(null);

  const [form, setForm] = useState<InstitutionForm>({
    name: "",
    nif: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    areaOfActivity: "",
    brandDisplayMode: "LOGO_AND_NAME",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["billing", "current-plan"],
    queryFn: async () => {
      const res = await api.get("/billing/current-plan");
      return res.data.data as InstitutionData;
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ["users", "count"],
    queryFn: async () => {
      const res = await api.get("/users?pageSize=1");
      return (res.data as { total: number }).total;
    },
  });

  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () =>
      (await api.get("/departments")).data.data as { id: string }[],
  });

  useEffect(() => {
    const tenant = data?.tenant;
    if (!tenant) return;
    setForm({
      name: tenant.name ?? "",
      nif: tenant.nif ?? "",
      address: tenant.address ?? "",
      contactEmail: tenant.contactEmail ?? "",
      contactPhone: tenant.contactPhone ?? "",
      areaOfActivity: tenant.areaOfActivity ?? "",
      brandDisplayMode: tenant.brandDisplayMode ?? "LOGO_AND_NAME",
      notes: tenant.notes ?? "",
    });
  }, [data]);

  const saveInstitution = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        nif: form.nif.trim() || null,
        address: form.address.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        areaOfActivity: form.areaOfActivity.trim() || null,
        brandDisplayMode: form.brandDisplayMode,
        notes: form.notes.trim() || null,
      };

      await api.patch("/billing/institution", payload);

      if (logoFile) {
        const body = new FormData();
        body.append("file", logoFile);
        try {
          await api.post("/billing/institution/logo", body);
        } catch (err) {
          const message = parseApiMessage(err, "falha ao atualizar a logo da instituição");
          const partialError = new Error(
            `Os dados da instituição foram guardados, mas houve ${message}.`,
          ) as PartialInstitutionSaveError;
          partialError.partialSave = true;
          throw partialError;
        }
      }
    },
    onSuccess: async () => {
      setError("");
      setSuccess("Dados da instituição guardados com sucesso.");
      setLogoFile(null);
      setLogoPreview(null);
      if (logoBlobRef.current) {
        URL.revokeObjectURL(logoBlobRef.current);
        logoBlobRef.current = null;
      }
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["billing", "current-plan"] });
    },
    onError: (err: unknown) => {
      setSuccess("");
      if (
        err instanceof Error &&
        "partialSave" in err &&
        (err as PartialInstitutionSaveError).partialSave
      ) {
        setError(err.message);
        void qc.invalidateQueries({ queryKey: ["billing", "current-plan"] });
        return;
      }
      setError(parseApiMessage(err, "Falha ao atualizar dados da instituição."));
    },
  });

  const tenant = data?.tenant;
  const logoSrc = publicAssetUrl(tenant?.logoUrl);
  const totalUsers = usersData ?? 0;
  const totalDepartments = departmentsData?.length ?? 0;
  const maxUsers = data?.subscription?.maxUsers;
  const maxDepartments = data?.subscription?.maxDepartments;

  return (
    <div className="p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-2">Configuração</p>
          <h1 className="text-2xl font-bold text-slate-900">Instituição</h1>
          <p className="text-slate-500 mt-1">Dados institucionais da organização hospitalar.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          {canEditInstitution ? (
            <DialogTrigger render={<Button className="bg-[#0B1F3A] hover:bg-[#0f2a4d]" />}>
              Editar instituição
            </DialogTrigger>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Apenas administradores podem editar os dados da instituição.
            </div>
          )}
          <DialogContent className="sm:max-w-3xl max-h-[86vh] overflow-auto" showCloseButton>
            <DialogHeader>
              <DialogTitle>Editar dados da instituição</DialogTitle>
              <DialogDescription>
                Atualize os dados e escolha a forma de exibição da marca no painel.
              </DialogDescription>
            </DialogHeader>

            <form
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                setSuccess("");
                if (!form.name.trim()) {
                  setError("O nome da instituição é obrigatório.");
                  return;
                }
                if (!canEditInstitution) {
                  setError("Apenas administradores podem editar os dados da instituição.");
                  return;
                }
                saveInstitution.mutate();
              }}
            >
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="inst-name">Nome da instituição</Label>
                <Input
                  id="inst-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Hospital Central de Luanda"
                  disabled={saveInstitution.isPending || !canEditInstitution}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst-nif">NIF</Label>
                <Input
                  id="inst-nif"
                  value={form.nif}
                  onChange={(e) => setForm((prev) => ({ ...prev, nif: e.target.value }))}
                  placeholder="5000000000"
                  disabled={saveInstitution.isPending || !canEditInstitution}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst-phone">Contacto telefónico</Label>
                <Input
                  id="inst-phone"
                  value={form.contactPhone}
                  onChange={(e) => setForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
                  placeholder="+244 900 000 000"
                  disabled={saveInstitution.isPending || !canEditInstitution}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst-email">Email institucional</Label>
                <Input
                  id="inst-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                  placeholder="admin@hospital.ao"
                  disabled={saveInstitution.isPending || !canEditInstitution}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst-area">Área de atuação</Label>
                <Input
                  id="inst-area"
                  value={form.areaOfActivity}
                  onChange={(e) => setForm((prev) => ({ ...prev, areaOfActivity: e.target.value }))}
                  placeholder="Hospital geral e especialidades"
                  disabled={saveInstitution.isPending || !canEditInstitution}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="inst-address">Localização</Label>
                <Input
                  id="inst-address"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Luanda, Ingombota"
                  disabled={saveInstitution.isPending || !canEditInstitution}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-mode">Exibição da marca no sidebar</Label>
                <Select
                  value={form.brandDisplayMode}
                  onValueChange={(v) =>
                    v && setForm((prev) => ({ ...prev, brandDisplayMode: v as InstitutionForm["brandDisplayMode"] }))
                  }
                  disabled={saveInstitution.isPending || !canEditInstitution}
                >
                  <SelectTrigger id="brand-mode" className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="LOGO_AND_NAME">Logo + nome da instituição</SelectItem>
                    <SelectItem value="LOGO_ONLY">Apenas logo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst-logo">Logo da instituição</Label>
                {logoPreview ? (
                  <div className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 bg-slate-50">
                    <img
                      src={logoPreview}
                      alt="Pré-visualização"
                      className="w-12 h-12 object-contain rounded-lg border border-slate-100 bg-white"
                    />
                    <span className="text-xs text-slate-600 truncate flex-1">{logoFile?.name}</span>
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                        if (logoBlobRef.current) {
                          URL.revokeObjectURL(logoBlobRef.current);
                          logoBlobRef.current = null;
                        }
                      }}
                    >
                      Remover
                    </button>
                  </div>
                ) : null}
                <Input
                  id="inst-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setLogoFile(file);
                    if (logoBlobRef.current) {
                      URL.revokeObjectURL(logoBlobRef.current);
                      logoBlobRef.current = null;
                    }
                    if (file) {
                      const url = URL.createObjectURL(file);
                      logoBlobRef.current = url;
                      setLogoPreview(url);
                    } else {
                      setLogoPreview(null);
                    }
                  }}
                  disabled={saveInstitution.isPending || !canEditInstitution}
                  className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                />
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <ImagePlus size={13} /> PNG, JPEG, WebP ou SVG até 4MB.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="inst-notes">Notas adicionais</Label>
                <Textarea
                  id="inst-notes"
                  rows={4}
                  className="resize-none"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Dados relevantes para faturação, operação ou contacto institucional."
                  disabled={saveInstitution.isPending || !canEditInstitution}
                />
              </div>

              {error ? (
                <Alert variant="destructive" className="md:col-span-2 rounded-xl py-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={saveInstitution.isPending || !canEditInstitution}
                  className="bg-[#0B1F3A] hover:bg-[#0f2a4d]"
                >
                  {saveInstitution.isPending ? "A guardar..." : "Guardar alterações"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {success ? (
        <Alert className="border-teal-200 bg-teal-50 text-teal-800 rounded-2xl">
          <CheckCircle2 className="h-4 w-4 text-teal-600" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {!canEditInstitution ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800 rounded-2xl">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            O seu perfil permite consultar os dados da instituição, mas não alterá-los.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-3xl border-slate-200/70 shadow-sm bg-white/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Building size={18} className="text-teal-600" />
            Perfil institucional
          </CardTitle>
          <CardDescription>
            Informações legais, operacionais e de contacto da instituição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">A carregar dados da instituição...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoItem icon={<Building size={15} />} label="Nome da instituição" value={tenant?.name ?? user?.tenantSlug ?? "-"} />
              <InfoItem
                icon={<BadgeCheck size={15} />}
                label="Estado"
              >
                <Badge
                  className={
                    tenant?.status === "ACTIVE"
                      ? "bg-teal-500/15 text-teal-700 border-teal-500/30"
                      : tenant?.status === "SUSPENDED"
                        ? "bg-red-100 text-red-700 border-red-300"
                        : "bg-amber-100 text-amber-700 border-amber-300"
                  }
                >
                  {statusLabel(tenant?.status)}
                </Badge>
              </InfoItem>
              <InfoItem icon={<FileText size={15} />} label="NIF" value={tenant?.nif ?? "Não informado"} />
              <InfoItem icon={<MapPin size={15} />} label="Localização" value={tenant?.address ?? "Não informada"} />
              <InfoItem icon={<Phone size={15} />} label="Contacto telefónico" value={tenant?.contactPhone ?? "Não informado"} />
              <InfoItem icon={<Mail size={15} />} label="Email institucional" value={tenant?.contactEmail ?? user?.email ?? "Não informado"} />
              <InfoItem icon={<Briefcase size={15} />} label="Área de atuação" value={tenant?.areaOfActivity ?? "Prestação de cuidados de saúde"} />
              <InfoItem icon={<CalendarDays size={15} />} label="Cliente desde" value={formatDate(tenant?.createdAt)} />
              <InfoItem icon={<RefreshCw size={15} />} label="Última atualização" value={formatDate(tenant?.updatedAt)} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Brand Card ── */}
      <Card className="rounded-3xl border-slate-200/70 shadow-sm bg-white/90">
        <CardHeader>
          <CardTitle className="text-slate-900">Marca</CardTitle>
          <CardDescription>Visual da marca no painel e identidade da organização.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-5">
            <Avatar className="w-20 h-20 rounded-2xl border border-slate-200 bg-white shrink-0">
              <AvatarImage src={logoSrc ?? undefined} alt={tenant?.name ?? "Instituição"} className="object-contain p-1" />
              <AvatarFallback className="bg-white p-2 rounded-2xl">
                <img src="/logo.png" alt="MediScala" className="w-full h-full object-contain" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Logo:</span>{" "}
                {tenant?.logoUrl ? "Logo personalizada em uso" : "Sem logo própria — a usar logo MediScala"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Modo de exibição:</span>{" "}
                {tenant?.brandDisplayMode === "LOGO_ONLY" ? "Apenas logo" : "Logo + nome"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Slug técnico:</span>{" "}
                <code className="text-xs bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                  {tenant?.slug ?? user?.tenantSlug ?? "-"}
                </code>
              </p>
              {tenant?.notes?.trim() ? (
                <p className="text-slate-600 italic">{tenant.notes}</p>
              ) : (
                <p className="text-slate-400 italic">Sem notas institucionais registadas.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Plano e utilização ── */}
      <Card className="rounded-3xl border-slate-200/70 shadow-sm bg-white/90">
        <CardHeader>
          <CardTitle className="text-slate-900">Plano e utilização</CardTitle>
          <CardDescription>Subscrição ativa e limites de capacidade da organização.</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.subscription ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Plano</p>
                <p className="text-lg font-bold text-slate-900">{data.subscription.planName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <Users size={12} /> Utilizadores
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-slate-900">{totalUsers}</span>
                  <span className="text-sm text-slate-400 pb-0.5">/ {maxUsers ?? "∞"}</span>
                </div>
                {maxUsers ? (
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all"
                      style={{ width: `${Math.min(100, (totalUsers / maxUsers) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <Layers size={12} /> Departamentos
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-slate-900">{totalDepartments}</span>
                  <span className="text-sm text-slate-400 pb-0.5">/ {maxDepartments ?? "∞"}</span>
                </div>
                {maxDepartments ? (
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all"
                      style={{ width: `${Math.min(100, (totalDepartments / maxDepartments) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">Sem subscrição ativa. Contacte a MediScala para mais informações.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  children,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
        <span className="text-slate-400">{icon}</span>
        {label}
      </p>
      {children ? (
        <div className="text-[15px] font-medium">{children}</div>
      ) : (
        <p className="text-[15px] text-slate-900 font-medium">{value}</p>
      )}
    </div>
  );
}
