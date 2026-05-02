import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { publicAssetUrl } from "@/lib/public-url";
import { useAuthStore } from "@/store/auth.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export function ProfilePage() {
  const queryClient = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);
  const sessionUser = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const { data: me, isLoading } = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => {
      const res = await api.get("/users/me");
      return res.data.data as MeRow;
    },
  });

  useEffect(() => {
    if (!me) return;
    setName(me.name);
    setSpecialty(me.specialty ?? "");
  }, [me]);

  const initials =
    sessionUser?.name
      ?.split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() ?? "U";

  const saveProfile = useMutation({
    mutationFn: async () => {
      await api.patch("/users/me", {
        name: name.trim(),
        specialty: specialty.trim() === "" ? null : specialty.trim(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      patchUser({
        name: name.trim(),
        specialty: specialty.trim() === "" ? null : specialty.trim(),
      });
      setSavedHint("Perfil atualizado.");
      setTimeout(() => setSavedHint(null), 3500);
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
      patchUser({
        avatarUrl: row.avatar_url ?? null,
      });
      setSavedHint("Foto atualizada.");
      setTimeout(() => setSavedHint(null), 3500);
    },
  });

  const avatarSrc =
    publicAssetUrl(me?.avatar_url ?? sessionUser?.avatarUrl ?? null) ??
    undefined;

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Perfil
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados da sua conta neste hospital. Email e função são definidos pela
          equipa administrativa.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="size-5 animate-spin" />
          <span>A carregar…</span>
        </div>
      )}

      {!isLoading && me && (
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Identidade</CardTitle>
            <CardDescription>Foto, nome e especialidade visível na equipa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-5">
              <Avatar className="size-20 rounded-2xl border border-slate-200">
                <AvatarImage src={avatarSrc} alt="" className="object-cover" />
                <AvatarFallback className="rounded-2xl bg-teal-500/15 text-teal-800 text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar.mutate(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2"
                  disabled={uploadAvatar.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadAvatar.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Alterar foto
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG ou WebP até 2&nbsp;MB.
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-specialty">Especialidade / função</Label>
              <Input
                id="profile-specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Opcional"
                className="rounded-xl"
              />
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-slate-900 text-right truncate">
                  {me.email}
                </span>
              </div>
              <div className="flex justify-between gap-4 items-center">
                <span className="text-muted-foreground">Função</span>
                <Badge variant="secondary" className="rounded-lg shrink-0">
                  {ROLE_PT[me.role] ?? me.role}
                </Badge>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Departamento</span>
                <span className="font-medium text-slate-900 text-right truncate">
                  {me.department_name ?? "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Horas contrato / semana
                </span>
                <span className="tabular-nums font-medium text-slate-900">
                  {me.contract_hours_week} h
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-2 border-t bg-slate-50/50 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="rounded-xl"
                disabled={
                  saveProfile.isPending ||
                  !name.trim() ||
                  (name.trim() === me.name &&
                    (specialty.trim() === "" ? null : specialty.trim()) ===
                      me.specialty)
                }
                onClick={() => saveProfile.mutate()}
              >
                {saveProfile.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Guardar alterações"
                )}
              </Button>
              {savedHint && (
                <span className="text-sm text-emerald-700">{savedHint}</span>
              )}
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
