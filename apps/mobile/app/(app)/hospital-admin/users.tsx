import { useState, useRef, type ReactElement } from "react";
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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "../../../src/lib/api";
import { ArrowLeft, Plus, Search, X, Eye, EyeOff, Users } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

const ROLES = ["COLLABORATOR", "MANAGER"] as const;
const SPECIALTIES = ["CARDIOLOGY", "NEUROLOGY", "ORTHOPEDICS", "EMERGENCY", "ONCOLOGY", "RADIOLOGY", "GENERAL", "PEDIATRICS", "ANESTHESIOLOGY", "ICU"] as const;
type Role = typeof ROLES[number];
type Specialty = typeof SPECIALTIES[number];

const ROLE_LABEL: Record<string, string> = { COLLABORATOR: "Colaborador", MANAGER: "Gestor" };
const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  COLLABORATOR: { bg: "#E0F2FE", text: "#0284C7" },
  MANAGER: { bg: "#EDE9FE", text: "#7C3AED" },
  HOSPITAL_ADMIN: { bg: "#E6F9F9", text: TEAL },
};

// ─── User Card ────────────────────────────────────────────────────────────────
function UserCard({ item, onLongPress }: { item: any; onLongPress: () => void }) {
  const rc = ROLE_COLOR[item.role] ?? ROLE_COLOR.COLLABORATOR;
  const initial = item.name?.charAt(0).toUpperCase() ?? "?";
  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      activeOpacity={0.8}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 8,
        borderRadius: 16, padding: 14,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: rc.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: rc.text }}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B" }}>{item.name}</Text>
          <View style={{ backgroundColor: rc.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: rc.text }}>{ROLE_LABEL[item.role] ?? item.role}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{item.email}</Text>
        {(item.department_name || item.specialty) && (
          <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
            {[item.department_name, item.specialty].filter(Boolean).join(" · ")}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 6, marginBottom: 6,
        backgroundColor: selected ? NAVY : "#F1F5F9",
        borderWidth: selected ? 0 : 1, borderColor: "#E2E8F0",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? "#fff" : "#64748B" }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: ReactElement }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
function UserModal({
  visible,
  onClose,
  onSave,
  loading,
  editUser,
  departments,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (form: any) => void;
  loading: boolean;
  editUser?: any;
  departments: any[];
}) {
  const isEdit = !!editUser;
  const [name, setName] = useState(editUser?.name ?? "");
  const [email, setEmail] = useState(editUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<Role>(editUser?.role ?? "COLLABORATOR");
  const [specialty, setSpecialty] = useState<Specialty | "">(editUser?.specialty ?? "");
  const [hoursWeek, setHoursWeek] = useState(editUser?.contract_hours_week?.toString() ?? "");
  const [deptId, setDeptId] = useState<string>(editUser?.department_id ?? "");

  const inputStyle = {
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: "#1E293B", backgroundColor: "#FAFAFA",
  };

  const handleSave = () => {
    if (!name.trim()) { Alert.alert("Erro", "O nome é obrigatório."); return; }
    if (!isEdit && !email.trim()) { Alert.alert("Erro", "O email é obrigatório."); return; }
    if (!isEdit && password.length < 6) { Alert.alert("Erro", "A password deve ter pelo menos 6 caracteres."); return; }
    const payload: any = { name: name.trim(), role, specialty: specialty || undefined };
    if (!isEdit) { payload.email = email.trim(); payload.password = password; }
    if (hoursWeek) payload.contractHoursWeek = parseInt(hoursWeek, 10);
    if (deptId) payload.departmentId = deptId;
    onSave(payload);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ backgroundColor: NAVY, paddingTop: 16, paddingBottom: 18, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{isEdit ? "Editar utilizador" : "Novo utilizador"}</Text>
            <TouchableOpacity onPress={onClose}><X size={22} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: "#F5F7FA" }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Field label="Nome completo">
            <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor="#94A3B8" />
          </Field>

          {!isEdit && (
            <>
              <Field label="Email">
                <TextInput style={inputStyle} value={email} onChangeText={setEmail} placeholder="email@hospital.pt" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" />
              </Field>
              <Field label="Password">
                <View style={{ position: "relative" }}>
                  <TextInput style={[inputStyle, { paddingRight: 44 }]} value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" placeholderTextColor="#94A3B8" secureTextEntry={!showPw} />
                  <TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: 12 }}>
                    {showPw ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
                  </TouchableOpacity>
                </View>
              </Field>
            </>
          )}

          <Field label="Função">
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {ROLES.map(r => <Pill key={r} label={ROLE_LABEL[r]} selected={role === r} onPress={() => setRole(r)} />)}
            </View>
          </Field>

          <Field label="Especialidade">
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {SPECIALTIES.map(s => <Pill key={s} label={s} selected={specialty === s} onPress={() => setSpecialty(s === specialty ? "" : s)} />)}
            </View>
          </Field>

          <Field label="Horas contratuais / semana">
            <TextInput style={inputStyle} value={hoursWeek} onChangeText={setHoursWeek} placeholder="Ex: 40" placeholderTextColor="#94A3B8" keyboardType="numeric" />
          </Field>

          {departments.length > 0 && (
            <Field label="Departamento">
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <Pill label="Nenhum" selected={!deptId} onPress={() => setDeptId("")} />
                {departments.map(d => <Pill key={d.id} label={d.name} selected={deptId === d.id} onPress={() => setDeptId(deptId === d.id ? "" : d.id)} />)}
              </View>
            </Field>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={{ backgroundColor: TEAL, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Guardar</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HospitalAdminUsersScreen(): ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["ha-users", page, debouncedSearch],
    queryFn: async () => {
      const params: any = { page, pageSize: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get<{ data: any[]; meta?: any }>("/users", { params });
      return res.data;
    },
    staleTime: 30_000,
  });

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get<{ data: any[] }>("/departments")).data.data ?? [],
    staleTime: 60_000,
  });

  const createUser = useMutation({
    mutationFn: (payload: any) => api.post("/users", payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ha-users"] }); setShowCreate(false); },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao criar utilizador."),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.patch(`/users/${id}`, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ha-users"] }); setEditUser(null); },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao atualizar."),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ha-users"] }),
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao eliminar."),
  });

  const handleSearch = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(text); setPage(1); }, 400);
  };

  const handleLongPress = (user: any) => {
    Alert.alert(user.name, "O que pretendes fazer?", [
      { text: "Editar", onPress: () => setEditUser(user) },
      {
        text: "Eliminar", style: "destructive",
        onPress: () => Alert.alert("Eliminar", `Eliminar ${user.name}?`, [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar", style: "destructive", onPress: () => deleteUser.mutate(user.id) },
        ]),
      },
      { text: "Cancelar", style: "cancel" },
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
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff", flex: 1 }}>Utilizadores</Text>
          <View style={{ backgroundColor: "rgba(42,191,191,0.15)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: TEAL }}>{data?.meta?.total ?? data?.data?.length ?? "—"}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, paddingHorizontal: 12, marginTop: 16, gap: 8 }}>
          <Search size={16} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: "#fff" }}
            value={search}
            onChangeText={handleSearch}
            placeholder="Pesquisar por nome ou email…"
            placeholderTextColor="rgba(255,255,255,0.45)"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}><X size={16} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={TEAL} colors={[TEAL]} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 10 }}>
              <Users size={38} color="#CBD5E1" />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#94A3B8" }}>Sem utilizadores encontrados</Text>
            </View>
          }
          renderItem={({ item }) => <UserCard item={item} onLongPress={() => handleLongPress(item)} />}
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

      {/* Create modal */}
      <UserModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={payload => createUser.mutate(payload)}
        loading={createUser.isPending}
        departments={departments.data ?? []}
      />

      {/* Edit modal */}
      {editUser && (
        <UserModal
          visible={!!editUser}
          onClose={() => setEditUser(null)}
          onSave={payload => updateUser.mutate({ id: editUser.id, payload })}
          loading={updateUser.isPending}
          editUser={editUser}
          departments={departments.data ?? []}
        />
      )}
    </View>
  );
}
