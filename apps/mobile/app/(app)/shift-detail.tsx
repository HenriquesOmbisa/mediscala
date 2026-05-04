import { useState, type ReactElement } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import {
  Clock,
  Users,
  Star,
  Trash2,
  CheckCircle,
  XCircle,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  UserMinus,
  UserCheck,
} from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

const fmtDT = new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeStyle: "short" });
const fmtTime = new Intl.DateTimeFormat("pt-PT", { timeStyle: "short" });

type Assignment = {
  assignment_id: string;
  user_id: string;
  user_name: string;
  specialty?: string;
  status: "ASSIGNED" | "ABSENT" | "SWAPPED";
};

type ShiftDetail = {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime: string;
  department_id: string;
  department_name?: string;
  required_specialty?: string;
  required_count: number;
  assignments: Assignment[];
};

type Suggestion = {
  user_id: string;
  user_name: string;
  specialty?: string;
  status: "ideal" | "warning" | "critical";
  reasons: string[];
  score: number;
};

const statusConfig: Record<string, { bg: string; text: string; label: string; Icon: any }> = {
  ASSIGNED: { bg: "#E6F9F9", text: "#158585", label: "Escalado", Icon: CheckCircle },
  ABSENT: { bg: "#FEE2E2", text: "#DC2626", label: "Ausente", Icon: XCircle },
  SWAPPED: { bg: "#F1F5F9", text: "#64748B", label: "Trocado", Icon: ChevronDown },
};

const suggestConfig: Record<string, { bg: string; text: string; icon: string }> = {
  ideal: { bg: "#E6F9F9", text: "#158585", icon: "✓" },
  warning: { bg: "#FEF3C7", text: "#D97706", icon: "⚠" },
  critical: { bg: "#FEE2E2", text: "#DC2626", icon: "✗" },
};

function AttendancePill({ status, onMark }: { status: string; onMark: (s: "ASSIGNED" | "ABSENT") => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <TouchableOpacity
        onPress={() => onMark("ASSIGNED")}
        style={{
          flexDirection: "row", alignItems: "center", gap: 4,
          backgroundColor: status === "ASSIGNED" ? TEAL : "#F1F5F9",
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
        }}
      >
        <UserCheck size={13} color={status === "ASSIGNED" ? "#fff" : "#94A3B8"} />
        <Text style={{ fontSize: 11, fontWeight: "700", color: status === "ASSIGNED" ? "#fff" : "#94A3B8" }}>Presente</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onMark("ABSENT")}
        style={{
          flexDirection: "row", alignItems: "center", gap: 4,
          backgroundColor: status === "ABSENT" ? "#EF4444" : "#F1F5F9",
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
        }}
      >
        <UserMinus size={13} color={status === "ABSENT" ? "#fff" : "#94A3B8"} />
        <Text style={{ fontSize: 11, fontWeight: "700", color: status === "ABSENT" ? "#fff" : "#94A3B8" }}>Ausente</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Suggestions Bottom Sheet ─────────────────────────────────────────────────
function SuggestionsSheet({
  visible,
  shiftId,
  onClose,
  onAssigned,
}: {
  visible: boolean;
  shiftId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const suggestions = useQuery({
    queryKey: ["shift-suggest", shiftId],
    queryFn: async () =>
      (await api.get<{ data: Suggestion[] }>("/shifts/suggest", { params: { shiftId } })).data.data,
    enabled: visible && !!shiftId,
  });

  const assign = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/shifts/${shiftId}/assign`, { userIds: [userId] }),
    onSuccess: () => { onAssigned(); onClose(); },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Não foi possível atribuir."),
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
        <View style={{ backgroundColor: NAVY, padding: 20, paddingTop: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Sparkles size={18} color={TEAL} />
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Sugestões IA</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: TEAL, fontSize: 15, fontWeight: "700" }}>Fechar</Text>
          </TouchableOpacity>
        </View>

        {suggestions.isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={TEAL} />
            <Text style={{ marginTop: 12, color: "#94A3B8", fontSize: 13 }}>A analisar compatibilidade...</Text>
          </View>
        ) : (
          <FlatList
            data={suggestions.data ?? []}
            keyExtractor={item => item.user_id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 15, color: "#94A3B8" }}>Sem sugestões disponíveis</Text>
              </View>
            }
            renderItem={({ item }) => {
              const cfg = suggestConfig[item.status];
              return (
                <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
                  <View style={{ height: 3, backgroundColor: item.status === "ideal" ? TEAL : item.status === "warning" ? "#F59E0B" : "#EF4444" }} />
                  <View style={{ padding: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 2 }}>{item.user_name}</Text>
                        {item.specialty && <Text style={{ fontSize: 12, color: "#64748B" }}>{item.specialty}</Text>}
                      </View>
                      <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: cfg.text }}>{cfg.icon} {item.status === "ideal" ? "Ideal" : item.status === "warning" ? "Atenção" : "Crítico"}</Text>
                      </View>
                    </View>
                    {item.reasons.length > 0 && (
                      <View style={{ gap: 3, marginBottom: 12 }}>
                        {item.reasons.map((r, i) => (
                          <Text key={i} style={{ fontSize: 12, color: "#64748B" }}>· {r}</Text>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => assign.mutate(item.user_id)}
                      disabled={assign.isPending}
                      style={{ backgroundColor: item.status === "ideal" ? NAVY : "#F1F5F9", borderRadius: 12, paddingVertical: 10, alignItems: "center", opacity: assign.isPending ? 0.7 : 1 }}
                    >
                      <Text style={{ fontWeight: "700", fontSize: 13, color: item.status === "ideal" ? "#fff" : NAVY }}>
                        {assign.isPending ? "A atribuir..." : "Atribuir"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ShiftDetailScreen(): ReactElement {
  const router = useRouter();
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();
  const queryClient = useQueryClient();
  const [showSuggest, setShowSuggest] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["shift-detail", shiftId],
    queryFn: async () =>
      (await api.get<{ data: ShiftDetail }>(`/shifts/${shiftId}/detail`)).data.data,
    enabled: !!shiftId,
  });

  const markAttendance = useMutation({
    mutationFn: ({ assignmentId, status }: { assignmentId: string; status: string }) =>
      api.patch(`/shifts/${shiftId}/assignments/${assignmentId}/attendance`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shift-detail", shiftId] }),
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao marcar presença."),
  });

  const unassign = useMutation({
    mutationFn: (userId: string) => api.delete(`/shifts/${shiftId}/assign/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-detail", shiftId] });
      queryClient.invalidateQueries({ queryKey: ["mgr-shifts"] });
    },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao remover."),
  });

  const deleteShift = useMutation({
    mutationFn: () => api.delete(`/shifts/${shiftId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mgr-shifts"] });
      router.back();
    },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao eliminar turno."),
  });

  const handleDelete = () => {
    Alert.alert("Eliminar turno", "Tens a certeza? Esta ação não pode ser revertida.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => deleteShift.mutate() },
    ]);
  };

  const handleUnassign = (userId: string, userName: string) => {
    Alert.alert("Remover colaborador", `Remover ${userName} deste turno?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => unassign.mutate(userId) },
    ]);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" }}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#94A3B8" }}>Turno não encontrado</Text>
      </View>
    );
  }

  const start = new Date(data.start_datetime);
  const end = new Date(data.end_datetime);
  const assigned = data.assignments?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={TEAL} colors={[TEAL]} />}
      >
        {/* Hero */}
        <View style={{ backgroundColor: NAVY, padding: 20, paddingTop: 12, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", flex: 1, marginRight: 12 }}>{data.name}</Text>
            <TouchableOpacity onPress={handleDelete} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(239,68,68,0.2)", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
            <Clock size={14} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
              {fmtDT.format(start)} → {fmtTime.format(end)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <View style={{ backgroundColor: "rgba(42,191,191,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", gap: 5, alignItems: "center" }}>
              <Users size={13} color={TEAL} />
              <Text style={{ color: TEAL, fontSize: 12, fontWeight: "700" }}>{assigned}/{data.required_count} escalados</Text>
            </View>
            {data.required_specialty && (
              <View style={{ backgroundColor: "rgba(59,130,246,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", gap: 5, alignItems: "center" }}>
                <Star size={13} color="#93C5FD" />
                <Text style={{ color: "#93C5FD", fontSize: 12, fontWeight: "700" }}>{data.required_specialty}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Suggest button */}
        <View style={{ marginHorizontal: 16, marginTop: -20, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => setShowSuggest(true)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6, borderWidth: 1.5, borderColor: TEAL }}
          >
            <Sparkles size={18} color={TEAL} />
            <Text style={{ color: TEAL, fontWeight: "800", fontSize: 14 }}>Sugerir colaboradores</Text>
          </TouchableOpacity>
        </View>

        {/* Assignments */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
            Colaboradores escalados
          </Text>
          {data.assignments.length === 0 ? (
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", gap: 8 }}>
              <AlertTriangle size={28} color="#CBD5E1" />
              <Text style={{ fontSize: 14, color: "#94A3B8", fontWeight: "600" }}>Sem colaboradores atribuídos</Text>
              <Text style={{ fontSize: 12, color: "#CBD5E1", textAlign: "center" }}>Usa "Sugerir colaboradores" para encontrar os mais adequados</Text>
            </View>
          ) : (
            data.assignments.map(a => {
              const cfg = statusConfig[a.status] ?? statusConfig.ASSIGNED;
              const SIcon = cfg.Icon;
              return (
                <View key={a.assignment_id} style={{ backgroundColor: "#fff", borderRadius: 16, marginBottom: 10, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
                  <View style={{ padding: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 2 }}>{a.user_name}</Text>
                        {a.specialty && <Text style={{ fontSize: 12, color: "#64748B" }}>{a.specialty}</Text>}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, flexDirection: "row", gap: 4, alignItems: "center" }}>
                          <SIcon size={11} color={cfg.text} />
                          <Text style={{ fontSize: 11, fontWeight: "700", color: cfg.text }}>{cfg.label}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleUnassign(a.user_id, a.user_name)} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
                          <UserMinus size={13} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <AttendancePill
                      status={a.status}
                      onMark={s => markAttendance.mutate({ assignmentId: a.assignment_id, status: s })}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <SuggestionsSheet
        visible={showSuggest}
        shiftId={shiftId ?? ""}
        onClose={() => setShowSuggest(false)}
        onAssigned={() => {
          queryClient.invalidateQueries({ queryKey: ["shift-detail", shiftId] });
          queryClient.invalidateQueries({ queryKey: ["mgr-shifts"] });
        }}
      />
    </View>
  );
}
