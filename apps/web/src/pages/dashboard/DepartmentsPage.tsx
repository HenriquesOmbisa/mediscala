import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DepartmentDetailSheet,
  type DepartmentSheetRow,
} from "@/components/department/DepartmentDetailSheet";

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [sheetDept, setSheetDept] = useState<DepartmentSheetRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: async () =>
      (await api.get("/departments")).data.data as DepartmentSheetRow[],
  });

  const create = useMutation({
    mutationFn: (name: string) => api.post("/departments", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setNewName("");
      setShowForm(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-1.5">
            Gestão
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Departamentos
          </h2>
          <p className="text-slate-500 mt-1 text-sm">
            Unidades orgânicas do hospital
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="gap-2 rounded-xl bg-[#0B1F3A] hover:bg-[#0f2a4d] text-white shadow-sm"
        >
          <Plus size={16} />
          Novo departamento
        </Button>
      </div>

      {/* ── Summary ── */}
      {!isLoading && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-semibold">
            {data?.length ?? 0} departamento{(data?.length ?? 0) !== 1 ? "s" : ""}
          </Badge>
        </div>
      )}

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-slate-200/70 shadow-sm">
              <CardContent className="p-5 flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <Skeleton className="h-4 flex-1" />
              </CardContent>
            </Card>
          ))}

        {data?.map((dept) => (
          <Card
            key={dept.id}
            role="button"
            tabIndex={0}
            onClick={() => setSheetDept(dept)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSheetDept(dept);
              }
            }}
            className="group rounded-2xl border-slate-200/70 shadow-sm hover:shadow-md transition-shadow cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A]/25"
          >
            <CardContent className="p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-[#0B1F3A]" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate text-sm">
                    {dept.name}
                  </p>
                  <Badge
                    variant="outline"
                    className="mt-1.5 text-[10px] font-medium tabular-nums rounded-lg border-slate-200 text-slate-600"
                  >
                    {(dept.collaborator_count ?? 0) === 1
                      ? "1 colaborador"
                      : `${dept.collaborator_count ?? 0} colaboradores`}
                  </Badge>
                </div>
              </div>

              <div
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <AlertDialog>
                  <AlertDialogTrigger
                    type="button"
                    disabled={remove.isPending}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0",
                    )}
                  >
                    <Trash2 size={14} />
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminar departamento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem a certeza que pretende eliminar{" "}
                        <strong className="text-slate-700">{dept.name}</strong>?
                        Esta ação não pode ser revertida.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => remove.mutate(dept.id)}
                        className="bg-red-600 hover:bg-red-700 rounded-xl"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}

        {!isLoading && !data?.length && (
          <div className="col-span-full">
            <Card className="rounded-2xl border-slate-200/70 border-dashed shadow-none">
              <CardContent className="py-16 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Building2 size={28} className="opacity-20" />
                  <p className="text-sm">Nenhum departamento criado</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setNewName(""); } }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Criar departamento</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Nome do departamento</Label>
              <Input
                id="dept-name"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Cardiologia"
                className="rounded-xl h-11"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    create.mutate(newName.trim());
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowForm(false); setNewName(""); }}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              disabled={!newName.trim() || create.isPending}
              onClick={() => create.mutate(newName.trim())}
              className="rounded-xl bg-[#0B1F3A] hover:bg-[#0f2a4d]"
            >
              {create.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  A criar...
                </>
              ) : (
                "Criar departamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DepartmentDetailSheet
        department={sheetDept}
        open={Boolean(sheetDept)}
        onOpenChange={(open) => {
          if (!open) setSheetDept(null);
        }}
      />
    </div>
  );
}