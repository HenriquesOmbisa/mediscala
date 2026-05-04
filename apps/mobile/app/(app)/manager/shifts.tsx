import { useState, useMemo, type ReactElement } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { useWebSocket } from "../../../src/hooks/useWebSocket";
import { ChevronLeft, ChevronRight, Plus, Users, Calendar, AlertCircle } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

const fmtDT = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" });
const fmtTime = new Intl.DateTimeFormat("pt-PT", { timeStyle: "short" });
const fmtWeekRange = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short" });

function buildWeek(offset: number) {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = addDays(now, -dow + offset * 7);
  const sunday = addDays(monday, 6);
  return { from: monday, to: sunday };
}

type Dept = { id: string; name: string };
type Shift = {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime: string;
  department_id: string;
  department_name?: string;
  required_specialty?: string;
  required_count: number;
  assignments: { assignment_id: string; user_id: string; user_name: string; status: string }[];
};

const SPECIALTIES = ["Enfermagem", "Médico", "Auxiliar", "Administrativo", "Farmácia", "Laboratório"];

function StaffBadge({ assigned, required }: { assigned: number; required: number }) {
  const full = assigned >= required;
  const partial = assigned > 0 && assigned < required;
  const bg = full ? "#E6F9F9" : partial ? "#FEF3C7" : "#FEE2E2";
  const color = full ? "#158585" : partial ? "#D97706" : "#DC2626";
  const Icon = full ? Users : partial ? AlertCircle : AlertCircle;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Icon size={12} color={color} />
      <Text style={{ fontSize: 12, fontWeight: "700", color }}>{assigned}/{required}</Text>
    </View>
  );
}

function ShiftCard({ item, onPress }: { item: Shift; onPress: () => void }) {
  const start = new Date(item.start_datetime);
  const end = new Date(item.end_datetime);
  const assigned = item.assignments?.length ?? 0;
  const full = assigned >= item.required_count;
  const partial = assigned > 0 && !full;
  const lineColor = full ? TEAL : partial ? "#F59E0B" : "#EF4444";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        backgroundColor: "#fff",
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View style={{ height: 3, backgroundColor: lineColor }} />
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 3 }}>{item.name}</Text>
            <Text style={{ fontSize: 13, color: "#64748B" }}>
              {fmtDT.format(start)} → {fmtTime.format(end)}
            </Text>
            {item.required_specialty && (
              <View style={{ backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, alignSelf: "flex-start", marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: "#3B82F6", fontWeight: "600" }}>{item.required_specialty}</Text>
              </View>
            )}
          </View>
          <StaffBadge assigned={assigned} required={item.required_count} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CreateShiftModal({
  visible,
  depts,
  onClose,
  onCreated,
}: {
  visible: boolean;
  depts: Dept[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [startDT, setStartDT] = useState("");
  const [endDT, setEndDT] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [count, setCount] = useState("1");

  const create = useMutation({
    mutationFn: () =>
      api.post("/shifts", {
        name,
        departmentId: deptId,
        startDatetime: startDT,
        endDatetime: endDT,
        requiredSpecialty: specialty || undefined,
        requiredCount: parseInt(count, 10) || 1,
      }),
    onSuccess: () => { onCreated(); onClose(); setName(""); setStartDT(""); setEndDT(""); setSpecialty(""); setCount("1"); },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Não foi possível criar o turno."),
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
          <View style={{ backgroundColor: NAVY, padding: 20, paddingTop: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Novo Turno</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: TEAL, fontSize: 15, fontWeight: "700" }}>Cancelar</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Nome do turno *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Ex: Turno Manhã" placeholderTextColor="#CBD5E1"
                style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, fontSize: 14, color: "#1E293B" }} />
            </View>
            {/* Dept */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 8 }}>Departamento *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {depts.map(d => (
                    <TouchableOpacity key={d.id} onPress={() => setDeptId(d.id)}
                      style={{ backgroundColor: deptId === d.id ? NAVY : "#F1F5F9", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: deptId === d.id ? "#fff" : "#475569", fontWeight: "600", fontSize: 13 }}>{d.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            {/* Start / End */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Início * (AAAA-MM-DDTHH:MM)</Text>
              <TextInput value={startDT} onChangeText={setStartDT} placeholder="2026-05-10T08:00" placeholderTextColor="#CBD5E1"
                style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, fontSize: 14, color: "#1E293B" }} />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Fim * (AAAA-MM-DDTHH:MM)</Text>
              <TextInput value={endDT} onChangeText={setEndDT} placeholder="2026-05-10T16:00" placeholderTextColor="#CBD5E1"
                style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, fontSize: 14, color: "#1E293B" }} />
            </View>
            {/* Specialty */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 8 }}>Especialidade requerida</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {SPECIALTIES.map(s => (
                    <TouchableOpacity key={s} onPress={() => setSpecialty(specialty === s ? "" : s)}
                      style={{ backgroundColor: specialty === s ? TEAL : "#F1F5F9", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: specialty === s ? "#fff" : "#475569", fontWeight: "600", fontSize: 13 }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            {/* Count */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Nº de colaboradores</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["1","2","3","4","5"].map(n => (
                  <TouchableOpacity key={n} onPress={() => setCount(n)}
                    style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: count === n ? NAVY : "#F1F5F9", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: count === n ? "#fff" : "#475569", fontWeight: "700" }}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {/* Submit */}
            <TouchableOpacity
              onPress={() => { if (!name || !deptId || !startDT || !endDT) { Alert.alert("Campos obrigatórios", "Preenche nome, departamento, início e fim."); return; } create.mutate(); }}
              disabled={create.isPending}
              style={{ backgroundColor: NAVY, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8, opacity: create.isPending ? 0.7 : 1 }}
            >
              {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Criar turno</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ManagerShiftsScreen(): ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { from, to } = useMemo(() => buildWeek(weekOffset), [weekOffset]);

  useWebSocket({
    shift_updated: () => queryClient.invalidateQueries({ queryKey: ["mgr-shifts"] }),
  });

  const depts = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get<{ data: Dept[] }>("/departments")).data.data,
    staleTime: 60_000,
  });

  const shifts = useQuery({
    queryKey: ["mgr-shifts", ymd(from), ymd(to), deptFilter],
    queryFn: async () => {
      const params: Record<string, string> = { from: ymd(from), to: ymd(to) };
      if (deptFilter) params.departmentId = deptFilter;
      return (await api.get<{ data: Shift[] }>("/shifts", { params })).data.data;
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      {/* Week navigator */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
        <TouchableOpacity onPress={() => setWeekOffset(o => o - 1)}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={20} color={NAVY} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: NAVY }}>
            {fmtWeekRange.format(from)} — {fmtWeekRange.format(to)}
          </Text>
          <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
            {weekOffset === 0 ? "Esta semana" : weekOffset > 0 ? `+${weekOffset} sem.` : `${weekOffset} sem.`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setWeekOffset(o => o + 1)}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}>
          <ChevronRight size={20} color={NAVY} />
        </TouchableOpacity>
      </View>

      {/* Dept pills */}
      {(depts.data?.length ?? 0) > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }} style={{ maxHeight: 52, backgroundColor: "#fff" }}>
          <TouchableOpacity onPress={() => setDeptFilter(null)}
            style={{ backgroundColor: !deptFilter ? NAVY : "#F1F5F9", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Text style={{ color: !deptFilter ? "#fff" : "#64748B", fontWeight: "600", fontSize: 12 }}>Todos</Text>
          </TouchableOpacity>
          {depts.data?.map(d => (
            <TouchableOpacity key={d.id} onPress={() => setDeptFilter(d.id === deptFilter ? null : d.id)}
              style={{ backgroundColor: deptFilter === d.id ? NAVY : "#F1F5F9", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: deptFilter === d.id ? "#fff" : "#64748B", fontWeight: "600", fontSize: 12 }}>{d.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Shifts list */}
      {shifts.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <FlatList
          data={shifts.data ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={shifts.isFetching && !shifts.isLoading} onRefresh={shifts.refetch} tintColor={TEAL} colors={[TEAL]} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 }}>
              <Calendar size={40} color="#CBD5E1" />
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#94A3B8" }}>Sem turnos nesta semana</Text>
              <Text style={{ fontSize: 13, color: "#CBD5E1" }}>Usa o botão + para criar um novo turno</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ShiftCard
              item={item}
              onPress={() => router.push({ pathname: "/(app)/shift-detail", params: { shiftId: item.id } })}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowCreate(true)}
        style={{ position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: NAVY, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10 }}
        activeOpacity={0.85}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      <CreateShiftModal
        visible={showCreate}
        depts={depts.data ?? []}
        onClose={() => setShowCreate(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["mgr-shifts"] })}
      />
    </View>
  );
}
