import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
  Modal,
  TextInput,
  Pressable,
} from "react-native";
import { useMemo, useState, type ReactElement } from "react";
import { useRouter } from "expo-router";
import { Calendar as RNCalendar, LocaleConfig } from "react-native-calendars";
import { api } from "../../../src/lib/api";
import { useNotifications } from "../../../src/hooks/useNotifications";
import {
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  MoreHorizontal,
  AlertTriangle,
  ArrowLeftRight,
  X,
} from "lucide-react-native";

LocaleConfig.locales.pt = {
  monthNames: ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"],
  monthNamesShort: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"],
  dayNames: ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"],
  dayNamesShort: ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"],
  today: "Hoje",
};
LocaleConfig.defaultLocale = "pt";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

type ShiftItem = {
  assignment_id: string;
  name: string;
  start_datetime: string;
  end_datetime: string;
  assignment_status: string;
  shift_id?: string;
  department_id?: string;
};

type AbsenceType = "SICK" | "PERSONAL" | "EMERGENCY" | "VACATION" | "OTHER";

const ABSENCE_TYPES: { value: AbsenceType; label: string }[] = [
  { value: "SICK", label: "Doença" },
  { value: "PERSONAL", label: "Pessoal" },
  { value: "EMERGENCY", label: "Urgência" },
  { value: "VACATION", label: "Férias" },
  { value: "OTHER", label: "Outro" },
];

const statusConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  ASSIGNED: { bg: "#E6F9F9", text: "#158585", border: TEAL, label: "Confirmado" },
  ABSENT: { bg: "#FEE2E2", text: "#DC2626", border: "#F87171", label: "Ausência" },
  SWAPPED: { bg: "#FEF3C7", text: "#D97706", border: "#FBBF24", label: "Trocado" },
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function addMarkedRange(
  acc: Record<string, { marked?: boolean; dotColor?: string }>,
  startIso: string,
  endIso: string,
) {
  const cur = new Date(startIso);
  const last = new Date(endIso);
  cur.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    const key = ymd(cur);
    if (!acc[key]) acc[key] = { marked: true, dotColor: TEAL };
    cur.setDate(cur.getDate() + 1);
  }
}

function overlapsDay(isoStart: string, isoEnd: string, dayStr: string): boolean {
  const start = new Date(isoStart);
  const end = new Date(isoEnd);
  const [y, m, d] = dayStr.split("-").map(Number);
  const ds = new Date(y, m - 1, d, 0, 0, 0, 0);
  const de = new Date(y, m - 1, d, 23, 59, 59, 999);
  return start <= de && end >= ds;
}

// ─── Absence Modal ───────────────────────────────────────────────────────────
function AbsenceModal({
  visible,
  item,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  item: ShiftItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<AbsenceType>("SICK");
  const [reason, setReason] = useState("");

  const report = useMutation({
    mutationFn: () =>
      api.post("/absences", { shiftAssignmentId: item?.assignment_id, type, reason: reason.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
      setReason("");
      setType("SICK");
      onSuccess();
      Alert.alert("Ausência registada", "A tua ausência foi registada com sucesso.");
    },
    onError: (err: any) =>
      Alert.alert("Erro", err.response?.data?.message ?? "Não foi possível registar a ausência."),
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => {}} style={{
          backgroundColor: "#fff",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 24,
          paddingBottom: 40,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: NAVY }}>Reportar ausência</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color="#94A3B8" /></TouchableOpacity>
          </View>
          {item && (
            <View style={{ backgroundColor: "#F1F5F9", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontWeight: "700", color: "#1E293B", fontSize: 14 }}>{item.name}</Text>
              <Text style={{ color: "#64748B", fontSize: 13, marginTop: 2 }}>
                {new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.start_datetime))}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 8 }}>Motivo</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {ABSENCE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setType(t.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: type === t.value ? NAVY : "#F1F5F9",
                  borderWidth: 1,
                  borderColor: type === t.value ? NAVY : "#E2E8F0",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: type === t.value ? "#fff" : "#475569" }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Observações (opcional)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Descreve o motivo..."
            placeholderTextColor="#CBD5E1"
            multiline
            numberOfLines={3}
            style={{
              borderWidth: 1,
              borderColor: "#E2E8F0",
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              color: "#1E293B",
              minHeight: 72,
              textAlignVertical: "top",
              marginBottom: 20,
            }}
          />
          <TouchableOpacity
            onPress={() => report.mutate()}
            disabled={report.isPending}
            style={{
              backgroundColor: "#DC2626",
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
            }}
            activeOpacity={0.8}
          >
            {report.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Confirmar ausência</Text>}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Action Sheet ─────────────────────────────────────────────────────────────
function ActionSheet({
  visible,
  item,
  onClose,
  onAbsence,
  onSwap,
}: {
  visible: boolean;
  item: ShiftItem | null;
  onClose: () => void;
  onAbsence: () => void;
  onSwap: () => void;
}) {
  if (!item) return null;
  const canAct = item.assignment_status === "ASSIGNED";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => {}} style={{
          backgroundColor: "#fff",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 24,
          paddingBottom: 40,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: NAVY }}>{item.name}</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color="#94A3B8" /></TouchableOpacity>
          </View>
          {!canAct && (
            <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, padding: 10, marginBottom: 16 }}>
              <Text style={{ color: "#92400E", fontSize: 13 }}>Ações indisponíveis — turno já marcado como {item.assignment_status === "ABSENT" ? "ausência" : "trocado"}.</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={canAct ? onAbsence : undefined}
            activeOpacity={canAct ? 0.75 : 1}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#F1F5F9",
              opacity: canAct ? 1 : 0.4,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={18} color="#DC2626" />
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#1E293B" }}>Reportar ausência</Text>
              <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>Doença, urgência ou indisponibilidade</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={canAct ? onSwap : undefined}
            activeOpacity={canAct ? 0.75 : 1}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 16,
              opacity: canAct ? 1 : 0.4,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeftRight size={18} color="#3B82F6" />
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#1E293B" }}>Solicitar troca de turno</Text>
              <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>Escolhe um turno do departamento para trocar</Text>
            </View>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CollaboratorShiftsScreen(): ReactElement {
  useNotifications();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const calWidth = Math.min(width - 32, 400);

  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState(() => ymd(new Date()));
  const [actionItem, setActionItem] = useState<ShiftItem | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showAbsence, setShowAbsence] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["my-shifts"],
    queryFn: async () =>
      (await api.get("/shifts/my")).data.data as ShiftItem[],
  });

  const markedDates = useMemo(() => {
    const acc: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};
    for (const it of data ?? []) addMarkedRange(acc, it.start_datetime, it.end_datetime);
    acc[selectedDay] = { ...acc[selectedDay], selected: true, selectedColor: NAVY, marked: true, dotColor: TEAL };
    return acc;
  }, [data, selectedDay]);

  const filtered =
    view === "calendar"
      ? (data ?? []).filter((it) => overlapsDay(it.start_datetime, it.end_datetime, selectedDay))
      : (data ?? []);

  const fmtDate = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" });
  const fmtTime = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });

  const renderShift = ({ item }: { item: ShiftItem }) => {
    const start = new Date(item.start_datetime);
    const end = new Date(item.end_datetime);
    const config = statusConfig[item.assignment_status];
    return (
      <View style={{
        backgroundColor: "#fff",
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 18,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
      }}>
        <View style={{ height: 3, backgroundColor: config?.border ?? "#E5E7EB" }} />
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B" }}>{item.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                <CalendarIcon size={13} color="#94A3B8" />
                <Text style={{ fontSize: 13, color: "#64748B", textTransform: "capitalize" }}>{fmtDate.format(start)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {config && (
                <View style={{ backgroundColor: config.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: config.text }}>{config.label}</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => { setActionItem(item); setShowActions(true); }}
                style={{ padding: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MoreHorizontal size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            backgroundColor: "#F1F5F9",
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: NAVY }}>
              {fmtTime.format(start)} → {fmtTime.format(end)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F5F7FA", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={{ color: "#94A3B8", marginTop: 12, fontSize: 14, fontWeight: "500" }}>A carregar turnos...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      {/* View toggle */}
      <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 8, gap: 8 }}>
        {(["calendar", "list"] as const).map((v) => (
          <TouchableOpacity
            key={v}
            onPress={() => setView(v)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: view === v ? NAVY : "#fff",
              borderWidth: 1,
              borderColor: view === v ? NAVY : "#E2E8F0",
            }}
          >
            {v === "calendar"
              ? <LayoutGrid size={16} color={view === v ? "#fff" : NAVY} />
              : <List size={16} color={view === v ? "#fff" : NAVY} />}
            <Text style={{ fontWeight: "700", fontSize: 13, color: view === v ? "#fff" : NAVY }}>
              {v === "calendar" ? "Mês" : "Lista"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Calendar */}
      {view === "calendar" && (
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <RNCalendar
            style={{ width: calWidth, borderRadius: 16 }}
            theme={{
              backgroundColor: "#ffffff",
              calendarBackground: "#ffffff",
              textSectionTitleColor: "#64748B",
              selectedDayBackgroundColor: NAVY,
              selectedDayTextColor: "#ffffff",
              todayTextColor: TEAL,
              dayTextColor: "#1E293B",
              textDisabledColor: "#cbd5e1",
              arrowColor: NAVY,
              monthTextColor: NAVY,
              textDayFontWeight: "600",
              textMonthFontWeight: "700",
            }}
            markingType="dot"
            markedDates={markedDates}
            onDayPress={(d) => setSelectedDay(d.dateString)}
            firstDay={1}
          />
          <Text style={{ marginTop: 6, fontSize: 12, color: "#94A3B8", fontWeight: "600" }}>
            Toca num dia para filtrar
          </Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.assignment_id}
        renderItem={renderShift}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={TEAL}
            colors={[TEAL, NAVY]}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", marginTop: 48, gap: 12 }}>
            <CalendarIcon size={40} color="#CBD5E1" />
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#94A3B8" }}>
              {view === "calendar" ? "Sem turnos neste dia" : "Sem turnos atribuídos"}
            </Text>
            <Text style={{ fontSize: 13, color: "#CBD5E1" }}>
              {view === "list" ? "Os teus turnos aparecerão aqui" : "Escolhe outro dia no calendário"}
            </Text>
          </View>
        }
      />

      {/* Action sheet */}
      <ActionSheet
        visible={showActions}
        item={actionItem}
        onClose={() => setShowActions(false)}
        onAbsence={() => { setShowActions(false); setShowAbsence(true); }}
        onSwap={() => {
          setShowActions(false);
          if (actionItem) {
            router.push({
              pathname: "/(app)/collaborator/swap-request",
              params: {
                assignmentId: actionItem.assignment_id,
                shiftName: actionItem.name,
                shiftStart: actionItem.start_datetime,
                departmentId: actionItem.department_id ?? "",
              },
            });
          }
        }}
      />

      {/* Absence modal */}
      <AbsenceModal
        visible={showAbsence}
        item={actionItem}
        onClose={() => setShowAbsence(false)}
        onSuccess={() => setShowAbsence(false)}
      />
    </View>
  );
}
