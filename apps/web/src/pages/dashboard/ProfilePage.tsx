import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, KeyRound, Loader2, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { publicAssetUrl } from "@/lib/public-url";
import { useAuthStore } from "@/store/auth.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type MeRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  specialty: string | null;
  contract_hours_week: number;
  department_id: string | null;
  department_name: string | null;
  active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

const ROLE_PT: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HOSPITAL_ADMIN: "Administrador",
  MANAGER: "Gestor",
  COLLABORATOR: "Colaborador",
};

/** A single read-only info row with an optional edit button */
function InfoRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="flex-1 text-sm font-medium text-slate-900 text-right truncate">
        {value}
      </span>
      {onEdit && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0 gap-1.5 h-7 px-2"
          onClick={onEdit}
        >
          <Pencil size={13} />
          Editar
        </Button>
      )}
    </div>
  );
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);
  const sessionUser = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dialog open state
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editSpecialtyOpen, setEditSpecialtyOpen] = useState(false);
  const [editAvatarOpen, setEditAvatarOpen] = useState(false);
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);

  // Edit name fields
  const [draftName, setDraftName] = useState("");

  // Edit specialty fields
  const [draftSpecialty, setDraftSpecialty] = useState("");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  // Avatar preview
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const { data: me, isLoading } = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => {
      const res = await api.get("/users/me");
      return res.data.data as MeRow;
    },
  });

  const initials =
    sessionUser?.name
      ?.split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() ?? "U";

  const avatarSrc =
    publicAssetUrl(me?.avatar_url ?? sessionUser?.avatarUrl ?? null) ??
    undefined;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveName = useMutation({
    mutationFn: async () =>
      api.patch("/users/me", { name: draftName.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      patchUser({ name: draftName.trim() });
      setEditNameOpen(false);
    },
  });

  const saveSpecialty = useMutation({
    mutationFn: async () =>
      api.patch("/users/me", {
        specialty: draftSpecialty.trim() === "" ? null : draftSpecialty.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      patchUser({
        specialty: draftSpecialty.trim() === "" ? null : draftSpecialty.trim(),
      });
      setEditSpecialtyOpen(false);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/users/me/avatar", fd);
      return res.data.data as { avatar_url: string | null };
    },
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      patchUser({ avatarUrl: row.avatar_url ?? null });
      setAvatarFile(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }
      setEditAvatarOpen(false);
    },
  });

  const changePassword = useMutation({
    mutationFn: async () =>
      api.patch("/users/me/password", { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwError(null);
      setEditPasswordOpen(false);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Erro ao atualizar a palavra-passe.";
      setPwError(msg);
    },
  });

  // Cleanup avatar blob when dialog closes
  useEffect(() => {
    if (!editAvatarOpen && avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      setAvatarFile(null);
    }
  }, [editAvatarOpen, avatarPreview]);

  // Reset pw fields when dialog closes
  useEffect(() => {
    if (!editPasswordOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwError(null);
    }
  }, [editPasswordOpen]);

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados da sua conta. Email e função são definidos pela equipa administrativa.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
          <Loader2 className="size-5 animate-spin" />
          <span>A carregar…</span>
        </div>
      )}

      {!isLoading && me && (
        <>
          {/* ── Profile card ── */}
          <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-base font-semibold text-slate-800">
                Informação pessoal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Avatar row */}
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
                <span className="text-sm text-muted-foreground w-40 shrink-0">Foto</span>
                <div className="flex-1 flex justify-end">
                  <Avatar className="size-12 rounded-xl border border-slate-200">
                    <AvatarImage src={avatarSrc} alt="" className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-teal-500/15 text-teal-800 font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0 gap-1.5 h-7 px-2"
                  onClick={() => setEditAvatarOpen(true)}
                >
                  <Camera size={13} />
                  Alterar
                </Button>
              </div>

              {/* Other fields */}
              <div className="px-6">
                <InfoRow
                  label="Nome"
                  value={me.name}
                  onEdit={() => {
                    setDraftName(me.name);
                    setEditNameOpen(true);
                  }}
                />
                <InfoRow
                  label="Especialidade"
                  value={me.specialty ?? <span className="text-slate-400">—</span>}
                  onEdit={() => {
                    setDraftSpecialty(me.specialty ?? "");
                    setEditSpecialtyOpen(true);
                  }}
                />
                <InfoRow label="Email" value={me.email} />
                <InfoRow
                  label="Função"
                  value={
                    <Badge variant="secondary" className="rounded-lg">
                      {ROLE_PT[me.role] ?? me.role}
                    </Badge>
                  }
                />
                <InfoRow label="Departamento" value={me.department_name ?? "—"} />
                <InfoRow
                  label="Horas contrato / semana"
                  value={`${me.contract_hours_week} h`}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Security card ── */}
          <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <KeyRound size={15} className="text-slate-400" />
                Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-0">
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Palavra-passe</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Altere regularmente para manter a segurança da sua conta.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl shrink-0"
                  onClick={() => setEditPasswordOpen(true)}
                >
                  Alterar senha
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ══ Dialog: Edit name ══════════════════════════════════════════════════ */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar nome</DialogTitle>
            <DialogDescription>
              O nome é visível a toda a equipa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="dlg-name">Nome completo</Label>
            <Input
              id="dlg-name"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              className="rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftName.trim()) saveName.mutate();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditNameOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={saveName.isPending || !draftName.trim() || draftName.trim() === me?.name}
              onClick={() => saveName.mutate()}
            >
              {saveName.isPending ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Dialog: Edit specialty ════════════════════════════════════════════ */}
      <Dialog open={editSpecialtyOpen} onOpenChange={setEditSpecialtyOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar especialidade</DialogTitle>
            <DialogDescription>
              Visível no perfil e na listagem da equipa. Pode deixar em branco.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="dlg-specialty">Especialidade / função</Label>
            <Input
              id="dlg-specialty"
              value={draftSpecialty}
              autoFocus
              placeholder="Opcional"
              onChange={(e) => setDraftSpecialty(e.target.value)}
              className="rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSpecialty.mutate();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditSpecialtyOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={
                saveSpecialty.isPending ||
                (draftSpecialty.trim() === "" ? null : draftSpecialty.trim()) ===
                  me?.specialty
              }
              onClick={() => saveSpecialty.mutate()}
            >
              {saveSpecialty.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Dialog: Avatar ════════════════════════════════════════════════════ */}
      <Dialog open={editAvatarOpen} onOpenChange={setEditAvatarOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar foto de perfil</DialogTitle>
            <DialogDescription>JPEG, PNG ou WebP até 2 MB.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-5 py-4">
            <Avatar className="size-28 rounded-2xl border border-slate-200">
              <AvatarImage
                src={avatarPreview ?? avatarSrc}
                alt=""
                className="object-cover"
              />
              <AvatarFallback className="rounded-2xl bg-teal-500/15 text-teal-800 text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                setAvatarPreview(URL.createObjectURL(f));
                setAvatarFile(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={15} />
              Escolher ficheiro
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditAvatarOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={!avatarFile || uploadAvatar.isPending}
              onClick={() => avatarFile && uploadAvatar.mutate(avatarFile)}
            >
              {uploadAvatar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Guardar foto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Dialog: Change password ═══════════════════════════════════════════ */}
      <Dialog open={editPasswordOpen} onOpenChange={setEditPasswordOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar palavra-passe</DialogTitle>
            <DialogDescription>
              Introduza a palavra-passe atual para confirmar a alteração.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {pwError && (
              <Alert variant="destructive">
                <AlertDescription>{pwError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="dlg-pw-current">Palavra-passe atual</Label>
              <Input
                id="dlg-pw-current"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dlg-pw-new">Nova palavra-passe</Label>
              <Input
                id="dlg-pw-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-xl"
              />
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="text-xs text-red-500">Mínimo 8 caracteres.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dlg-pw-confirm">Confirmar nova palavra-passe</Label>
              <Input
                id="dlg-pw-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-xl"
              />
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500">As palavras-passe não coincidem.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditPasswordOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={
                changePassword.isPending ||
                !currentPassword ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
              onClick={() => changePassword.mutate()}
            >
              {changePassword.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Atualizar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

