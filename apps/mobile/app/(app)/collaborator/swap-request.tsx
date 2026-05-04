import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo, type ReactElement } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { ArrowLeftRight, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

type ShiftRow = {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime: string;
  required_specialty: string | null;
  assignments: { assignment_id: string; user_id: string; user_name: string }[];
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function buildWeekWindow(center: Date, weekOffset: number) {
  const pivot = addDays(center, weekOffset * 7);
  // Start of the week containing pivot (Mon)
  const dow = (pivot.getDay() + 6) % 7; // 0=Mon
  const monday = addDays(pivot, -dow);
  const sunday = addDays(monday, 6);
  return { from: monday, to: sunday };
}

const fmtDT = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" });
const fmtTime = new Intl.DateTimeFormat("pt-PT", { timeStyle: "short" });
const fmtWeek = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short" });

export default function SwapRequestScreen(): ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { assignmentId, shiftName, shiftStart, departmentId } = useLocalSearchParams<{
    assignmentId: string;
    shiftName: string;
    shiftStart: string;
    departmentId: string;
  }>();

  const centerDate = useMemo(() => (shiftStart ? new Date(shiftStart) : new Date()), [shiftStart]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("");

  const { from, to } = useMemo(() => buildWeekWindow(centerDate, weekOffset), [centerDate, weekOffset]);

  const { data, isLoading } = useQuery({
    queryKey: ["dept-shifts", departmentId, ymd(from), ymd(to)],
    queryFn: async () => {
      const res = await api.get<{ data: ShiftRow[] }>("/shifts", {
        params: { departmentId, from: ymd(from), to: ymd(to) },
      });
      return res.data.data;
    },
    enabled: !!departmentId,
  });

  // Filter: exclude shifts where the current user is already assigned
  // We don't have the userId here easily, so we'll allow all — the API will reject if needed
  const targetShifts = useMemo(() => {
    if (!data) return [];
    return data.flatMap((shift) =>
      (shift.assignments ?? []).map((a) => ({
        shiftId: shift.id,
        shiftName: shift.name,
        startDatetime: shift.start_datetime,
        endDatetime: shift.end_datetime,
        assignmentId: a.assignment_id,
        userId: a.user_id,
        userName: a.user_name,
        specialty: shift.required_specialty,
      }))
    );
  }, [data]);

  const swap = useMutation({
    mutationFn: () =>
      api.post("/coverage/swaps", {
        sourceAssignmentId: assignmentId,
        targetAssignmentId: selectedAssignmentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-swaps"] });
      queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
      Alert.alert(
        "Pedido enviado",
        "O teu pedido de troca foi enviado. O colega receberá uma notificação para aceitar.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    },
    onError: (err: any) => {
      Alert.alert("Erro", err.response?.data?.message ?? "Não foi possível enviar o pedido de troca.");
    },
  });

  const handleConfirm = () => {
    if (!selectedAssignmentId) return;
    Alert.alert(
      "Confirmar troca",
      `Queres trocar "${shiftName}" por "${selectedLabel}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Enviar pedido", onPress: () => swap.mutate() },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      {/* Source shift info */}
      <View style={{ backgroundColor: NAVY, padding: 16, paddingTop: 8 }}>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600", marginBottom: 4 }}>
          O TEU TURNO
        </Text>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{shiftName}</Text>
        {shiftStart && (
          <Text style={{ color: TEAL, fontSize: 13, marginTop: 2 }}>
            {fmtDT.format(new Date(shiftStart))}
          </Text>
        )}
      </View>

      {/* Week navigator */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
        <TouchableOpacity
          onPress={() => setWeekOffset((o) => o - 1)}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft size={20} color={NAVY} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: NAVY }}>
            {fmtWeek.format(from)} — {fmtWeek.format(to)}
          </Text>
          <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
            {weekOffset === 0 ? "Semana do teu turno" : weekOffset > 0 ? `+${weekOffset} sem.` : `${weekOffset} sem.`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setWeekOffset((o) => o + 1)}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronRight size={20} color={NAVY} />
        </TouchableOpacity>
      </View>

      {/* Instruction */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "500" }}>
          Escolhe o turno com que queres trocar:
        </Text>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : targetShifts.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 }}>
          <CalendarIcon size={40} color="#CBD5E1" />
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#94A3B8" }}>Sem turnos nesta semana</Text>
          <Text style={{ fontSize: 13, color: "#CBD5E1", textAlign: "center" }}>
            Navega para outra semana ou verifica se há colegas atribuídos
          </Text>
        </View>
      ) : (
        <FlatList
          data={targetShifts}
          keyExtractor={(item) => item.assignmentId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 }}
          renderItem={({ item }) => {
            const isSelected = selectedAssignmentId === item.assignmentId;
            const start = new Date(item.startDatetime);
            const end = new Date(item.endDatetime);
            return (
              <TouchableOpacity
                onPress={() => {
                  setSelectedAssignmentId(item.assignmentId);
                  setSelectedLabel(`${item.shiftName} (${fmtDT.format(start)})`);
                }}
                activeOpacity={0.8}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  marginBottom: 10,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: isSelected ? TEAL : "transparent",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <View style={{ height: 3, backgroundColor: isSelected ? TEAL : "#E2E8F0" }} />
                <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 3 }}>
                      {item.shiftName}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#64748B" }}>
                      {fmtDT.format(start)} → {fmtTime.format(end)}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: NAVY }}>
                          {item.userName?.charAt(0).toUpperCase() ?? "?"}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, color: "#475569", fontWeight: "500" }}>{item.userName}</Text>
                      {item.specialty && (
                        <View style={{ backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 }}>
                          <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "600" }}>{item.specialty}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {isSelected && (
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: TEAL, alignItems: "center", justifyContent: "center" }}>
                      <Check size={16} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Bottom CTA */}
      {selectedAssignmentId && (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: "#F1F5F9", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <ArrowLeftRight size={16} color={NAVY} />
            <Text style={{ fontSize: 13, color: "#475569", flex: 1 }} numberOfLines={2}>
              Trocar <Text style={{ fontWeight: "700", color: NAVY }}>"{shiftName}"</Text> por{" "}
              <Text style={{ fontWeight: "700", color: NAVY }}>"{selectedLabel}"</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={swap.isPending}
            style={{ backgroundColor: NAVY, borderRadius: 14, paddingVertical: 15, alignItems: "center", opacity: swap.isPending ? 0.7 : 1 }}
            activeOpacity={0.85}
          >
            {swap.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Enviar pedido de troca</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
