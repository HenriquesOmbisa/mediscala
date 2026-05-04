import { useState, type ReactElement } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "../../../src/lib/api";
import { ArrowLeft, Plus, Pencil, Trash2, X, Layers, Check } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

// ─── Dept Card ────────────────────────────────────────────────────────────────
function DeptCard({
  item,
  onEdit,
  onDelete,
}: { item: any; onEdit: () => void; onDelete: () => void }) {
  return (
    <View
      style={{
        backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 8,
        borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B" }}>{item.name}</Text>
        {item.user_count != null && (
          <Text style={{ fontSize: 13, color: "#94A3B8", marginTop: 3 }}>{item.user_count} colaborador{item.user_count === 1 ? "" : "es"}</Text>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity onPress={onEdit} style={{ backgroundColor: "#EFF6FF", borderRadius: 10, padding: 9 }}>
          <Pencil size={15} color="#3B82F6" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={{ backgroundColor: "#FEE2E2", borderRadius: 10, padding: 9 }}>
          <Trash2 size={15} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────
function DeptModal({
  visible,
  initialName,
  onClose,
  onSave,
  loading,
}: { visible: boolean; initialName?: string; onClose: () => void; onSave: (name: string) => void; loading: boolean }) {
  const [name, setName] = useState(initialName ?? "");
  const isEdit = !!initialName;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ backgroundColor: NAVY, paddingTop: 16, paddingBottom: 18, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{isEdit ? "Editar departamento" : "Novo departamento"}</Text>
            <TouchableOpacity onPress={onClose}><X size={22} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, backgroundColor: "#F5F7FA", padding: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 6 }}>Nome do departamento</Text>
          <TextInput
            style={{
              borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
              fontSize: 15, color: "#1E293B", backgroundColor: "#fff",
            }}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Urgência, Cardiologia…"
            placeholderTextColor="#94A3B8"
            autoFocus
          />

          <TouchableOpacity
            onPress={() => {
              if (!name.trim()) { Alert.alert("Erro", "O nome é obrigatório."); return; }
              onSave(name.trim());
            }}
            disabled={loading}
            style={{ backgroundColor: TEAL, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 16, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HospitalAdminDepartmentsScreen(): ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editDept, setEditDept] = useState<any | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get<{ data: any[] }>("/departments")).data.data ?? [],
    staleTime: 60_000,
  });

  const createDept = useMutation({
    mutationFn: (name: string) => api.post("/departments", { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["departments"] }); setShowCreate(false); },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao criar departamento."),
  });

  const updateDept = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch(`/departments/${id}`, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["departments"] }); setEditDept(null); },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao atualizar."),
  });

  const deleteDept = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao eliminar."),
  });

  const confirmDelete = (dept: any) => {
    Alert.alert("Eliminar departamento", `Eliminar "${dept.name}"? Esta ação não pode ser revertida.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => deleteDept.mutate(dept.id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      {/* Header */}
      <View style={{ backgroundColor: NAVY, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff", flex: 1 }}>Departamentos</Text>
          <View style={{ backgroundColor: "rgba(42,191,191,0.15)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: TEAL }}>{data?.length ?? "—"}</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={TEAL} colors={[TEAL]} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 10 }}>
              <Layers size={38} color="#CBD5E1" />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#94A3B8" }}>Sem departamentos criados</Text>
            </View>
          }
          renderItem={({ item }) => (
            <DeptCard
              item={item}
              onEdit={() => setEditDept(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowCreate(true)}
        style={{
          position: "absolute", bottom: 28, right: 20,
          width: 56, height: 56, borderRadius: 28, backgroundColor: TEAL,
          alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
        }}
      >
        <Plus size={26} color="#fff" />
      </TouchableOpacity>

      <DeptModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={name => createDept.mutate(name)}
        loading={createDept.isPending}
      />

      {editDept && (
        <DeptModal
          visible={!!editDept}
          initialName={editDept.name}
          onClose={() => setEditDept(null)}
          onSave={name => updateDept.mutate({ id: editDept.id, name })}
          loading={updateDept.isPending}
        />
      )}
    </View>
  );
}
