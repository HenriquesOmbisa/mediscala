import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import { publicAssetUrl } from "../../lib/public-url";
import { cn } from "@/lib/utils";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
  UserCheck,
  UserX,
  PanelRightOpen,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserDetailSheet } from "@/components/user/UserDetailSheet";
import { departmentTriggerLabel } from "@/lib/department-label";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  specialty: string | null;
  contract_hours_week: number;
  department_id: string | null;
  department_name: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
};

const roles: Record<string, string> = {
  HOSPITAL_ADMIN: "Admin",
  MANAGER: "Manager",
  COLLABORATOR: "Colaborador",
};

const roleBadge: Record<string, string> = {
  HOSPITAL_ADMIN: "bg-[#0B1F3A]/10 text-[#0B1F3A] border-[#0B1F3A]/20",
  MANAGER: "bg-teal-50 text-teal-700 border-teal-200",
  COLLABORATOR: "bg-slate-100 text-slate-600 border-slate-200",
};

const emptyCreate = () => ({
  name: "",
  email: "",
  password: "",
  role: "COLLABORATOR",
  contractHoursWeek: 40,
  specialty: "",
  departmentId: undefined as string | undefined,
});

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [formError, setFormError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "COLLABORATOR",
    contractHoursWeek: 40,
    specialty: "",
    departmentId: "" as string | undefined,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserRow | null>(null);
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.get("/users");
      return res.data as {
        data: UserRow[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () =>
      (await api.get("/departments")).data.data as { id: string; name: string }[],
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeactivateUser(null);
    },
  });

  const createUser = useMutation({
    mutationFn: (body: ReturnType<typeof emptyCreate>) =>
      api.post("/users", {
        name: body.name,
        email: body.email,
        password: body.password,
        role: body.role,
        contractHoursWeek: body.contractHoursWeek,
        specialty: body.specialty.trim() ? body.specialty : null,
        departmentId: body.departmentId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      setCreateForm(emptyCreate());
      setFormError(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: unknown } } };
      const msg = e.response?.data?.message;
      setFormError(typeof msg === "string" ? msg : "Erro ao criar utilizador");
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      name?: string;
      email?: string;
      role?: string;
      contractHoursWeek?: number;
      specialty?: string | null;
      departmentId?: string | null;
    }) => api.patch(`/users/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
      setEditError(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: unknown } } };
      const msg = e.response?.data?.message;
      setEditError(typeof msg === "string" ? msg : "Erro ao atualizar");
    },
  });

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      role: u.role,
      contractHoursWeek: u.contract_hours_week,
      specialty: u.specialty ?? "",
      departmentId: u.department_id ?? undefined,
    });
    setEditError(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 mb-1.5">
            Gestão
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Utilizadores
          </h2>
          <p className="text-slate-500 mt-1 text-sm">Equipa e departamentos</p>
        </div>
        <Button
          className="gap-2 rounded-xl bg-[#0B1F3A] hover:bg-[#0f2a4d] shadow-sm"
          onClick={() => { setCreateOpen(true); setFormError(null); }}
        >
          <Plus size={16} />
          Novo utilizador
        </Button>
      </div>

      {/* ── Summary stats ── */}
      {!isLoading && data && (
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs font-semibold">
            {data.total} utilizadores
          </Badge>
          <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">
            {data.data.filter((u) => u.active).length} ativos
          </Badge>
        </div>
      )}

      {/* ── Table ── */}
      <Card className="rounded-2xl border-slate-200/70 shadow-sm overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="w-[52px]" />
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Nome</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Email</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Função</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Especialidade</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Departamento</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Estado</TableHead>
                <TableHead className="w-[104px] text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-50">
                    <TableCell><Skeleton className="w-9 h-9 rounded-full" /></TableCell>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))}

              {data?.data?.map((user) => (
                <TableRow
                  key={user.id}
                  className="border-slate-50 hover:bg-slate-50/80 transition-colors"
                >
                  <TableCell>
                    <Avatar className="h-9 w-9 border border-slate-100">
                      <AvatarImage
                        src={publicAssetUrl(user.avatar_url) ?? undefined}
                        alt=""
                      />
                      <AvatarFallback className="bg-teal-50 text-teal-800 text-xs font-semibold">
                        {user.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium text-slate-800 text-sm">
                    {user.name}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-xs font-medium", roleBadge[user.role])}
                    >
                      {roles[user.role] ?? user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {user.specialty ?? <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {user.department_name ?? <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-semibold gap-1.5",
                        user.active
                          ? "bg-teal-50 text-teal-700 border-teal-200"
                          : "bg-red-50 text-red-600 border-red-200",
                      )}
                    >
                      {user.active ? (
                        <><UserCheck size={11} /> Ativo</>
                      ) : (
                        <><UserX size={11} /> Inativo</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2 pr-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-slate-500 hover:text-[#0B1F3A] shrink-0"
                        onClick={() => setDetailUser(user)}
                        aria-label="Ver perfil"
                      >
                        <PanelRightOpen className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          type="button"
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                            "h-8 w-8 rounded-lg shrink-0",
                          )}
                        >
                          <MoreHorizontal className="h-4 w-4 text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="rounded-xl w-44 shadow-lg"
                        >
                          <DropdownMenuItem
                            onClick={() => openEdit(user)}
                            className="rounded-lg cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4 text-slate-400" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 rounded-lg cursor-pointer"
                            onClick={() => setDeactivateUser(user)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Desativar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-teal-600" />
              </div>
              Novo utilizador
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive" className="rounded-xl py-3">
              <AlertDescription className="text-sm">{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-1">
            <FormField label="Nome completo">
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-xl h-10"
                placeholder="Ana Silva"
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-xl h-10"
                placeholder="ana@hospital.pt"
              />
            </FormField>
            <FormField label="Password">
              <Input
                type="password"
                minLength={8}
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                className="rounded-xl h-10"
                placeholder="Mínimo 8 caracteres"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Função">
                <Select
                  value={createForm.role}
                  onValueChange={(v) => v && setCreateForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="HOSPITAL_ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="COLLABORATOR">Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Horas / semana">
                <Input
                  type="number"
                  min={0}
                  max={80}
                  value={createForm.contractHoursWeek}
                  onChange={(e) => setCreateForm((f) => ({ ...f, contractHoursWeek: Number(e.target.value) }))}
                  className="rounded-xl h-10"
                />
              </FormField>
            </div>
            <FormField label="Especialidade">
              <Input
                value={createForm.specialty}
                onChange={(e) => setCreateForm((f) => ({ ...f, specialty: e.target.value }))}
                placeholder="Opcional"
                className="rounded-xl h-10"
              />
            </FormField>
            <FormField label="Departamento">
              <Select
                value={createForm.departmentId ?? "__none__"}
                onValueChange={(v) => v && setCreateForm((f) => ({ ...f, departmentId: v === "__none__" ? undefined : v }))}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Sem departamento">
                    {departmentTriggerLabel(
                      createForm.departmentId,
                      departments,
                      "Sem departamento",
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="__none__">Sem departamento</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              disabled={createUser.isPending}
              onClick={() => createUser.mutate(createForm)}
              className="rounded-xl bg-[#0B1F3A] hover:bg-[#0f2a4d]"
            >
              {createUser.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-1.5" />A criar...</>
              ) : (
                "Criar utilizador"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Sheet ── */}
      <Sheet open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Pencil size={16} className="text-teal-600" />
              Editar utilizador
            </SheetTitle>
          </SheetHeader>

          {editError && (
            <Alert variant="destructive" className="rounded-xl mt-4">
              <AlertDescription className="text-sm">{editError}</AlertDescription>
            </Alert>
          )}

          {editUser && (
            <div className="grid gap-4 py-6">
              {/* Avatar + name preview */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Avatar className="h-10 w-10 border border-slate-200">
                  <AvatarImage src={publicAssetUrl(editUser.avatar_url) ?? undefined} />
                  <AvatarFallback className="bg-teal-50 text-teal-800 text-sm font-semibold">
                    {editUser.name?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-slate-800 text-sm">{editUser.name}</p>
                  <p className="text-xs text-slate-500">{editUser.email}</p>
                </div>
              </div>

              <FormField label="Nome">
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="rounded-xl h-10"
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="rounded-xl h-10"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Função">
                  <Select
                    value={editForm.role}
                    onValueChange={(v) => v && setEditForm((f) => ({ ...f, role: v }))}
                  >
                    <SelectTrigger className="rounded-xl h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="HOSPITAL_ADMIN">Admin</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="COLLABORATOR">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Horas / semana">
                  <Input
                    type="number"
                    min={0}
                    max={80}
                    value={editForm.contractHoursWeek}
                    onChange={(e) => setEditForm((f) => ({ ...f, contractHoursWeek: Number(e.target.value) }))}
                    className="rounded-xl h-10"
                  />
                </FormField>
              </div>
              <FormField label="Especialidade">
                <Input
                  value={editForm.specialty}
                  onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))}
                  placeholder="Opcional"
                  className="rounded-xl h-10"
                />
              </FormField>
              <FormField label="Departamento">
                <Select
                  value={editForm.departmentId ?? "__none__"}
                  onValueChange={(v) => v && setEditForm((f) => ({ ...f, departmentId: v === "__none__" ? undefined : v }))}
                >
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue placeholder="Sem departamento">
                      {departmentTriggerLabel(
                        editForm.departmentId,
                        departments,
                        "Sem departamento",
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="__none__">Sem departamento</SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          )}

          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditUser(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              disabled={updateUser.isPending || !editUser}
              className="rounded-xl bg-[#0B1F3A] hover:bg-[#0f2a4d]"
              onClick={() => {
                if (!editUser) return;
                updateUser.mutate({
                  id: editUser.id,
                  name: editForm.name,
                  email: editForm.email,
                  role: editForm.role,
                  contractHoursWeek: editForm.contractHoursWeek,
                  specialty: editForm.specialty.trim() ? editForm.specialty : null,
                  departmentId: editForm.departmentId || null,
                });
              }}
            >
              {updateUser.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-1.5" />A guardar...</>
              ) : (
                "Guardar alterações"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Deactivate Alert ── */}
      <AlertDialog
        open={!!deactivateUser}
        onOpenChange={(o) => !o && setDeactivateUser(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar utilizador?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que pretende desativar{" "}
              <strong className="text-slate-700">{deactivateUser?.name}</strong>?
              O colaborador perderá acesso à plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateUser && deactivate.mutate(deactivateUser.id)}
              className="rounded-xl bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deactivate.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-1.5" />A desativar...</>
              ) : (
                "Desativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserDetailSheet
        user={detailUser}
        open={Boolean(detailUser)}
        onOpenChange={(open) => {
          if (!open) setDetailUser(null);
        }}
      />
    </div>
  );
}