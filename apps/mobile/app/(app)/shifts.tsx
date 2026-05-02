import { useQuery } from "@tanstack/react-query";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useMemo, useState } from "react";
import {
  Calendar as RNCalendar,
  LocaleConfig,
} from "react-native-calendars";
import { api } from "../../src/lib/api";
import { useNotifications } from "../../src/hooks/useNotifications";
import { Calendar as CalendarIcon, LayoutGrid, List } from "lucide-react-native";

LocaleConfig.locales.pt = {
  monthNames: [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ],
  monthNamesShort: [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ],
  dayNames: [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ],
  dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
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
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addMarkedRange(
  acc: Record<string, { marked?: boolean; dotColor?: string }>,
  startIso: string,
  endIso: string,
) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
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

const statusConfig: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  ASSIGNED: {
    bg: "#E6F9F9",
    text: "#158585",
    border: TEAL,
    label: "Confirmado",
  },
  ABSENT: { bg: "#FEE2E2", text: "#DC2626", border: "#F87171", label: "Falta" },
  SWAPPED: {
    bg: "#FEF3C7",
    text: "#D97706",
    border: "#FBBF24",
    label: "Trocado",
  },
};

export default function ShiftsScreen() {
  useNotifications();
  const { width } = useWindowDimensions();
  const calWidth = Math.min(width - 32, 400);

  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState(() => {
    const n = new Date();
    return ymd(n);
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["my-shifts"],
    queryFn: async () =>
      (await api.get("/shifts/my")).data.data as ShiftItem[],
  });

  const markedDates = useMemo(() => {
    const acc: Record<
      string,
      {
        marked?: boolean;
        dotColor?: string;
        selected?: boolean;
        selectedColor?: string;
      }
    > = {};
    for (const it of data ?? []) {
      addMarkedRange(acc, it.start_datetime, it.end_datetime);
    }
    acc[selectedDay] = {
      ...acc[selectedDay],
      selected: true,
      selectedColor: NAVY,
      marked: true,
      dotColor: TEAL,
    };
    return acc;
  }, [data, selectedDay]);

  const filtered =
    view === "calendar"
      ? (data ?? []).filter((it) =>
          overlapsDay(it.start_datetime, it.end_datetime, selectedDay),
        )
      : (data ?? []);

  const renderShift = ({ item }: { item: ShiftItem }) => {
    const start = new Date(item.start_datetime);
    const end = new Date(item.end_datetime);
    const fmt = new Intl.DateTimeFormat("pt-PT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const fmtTime = new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const config = statusConfig[item.assignment_status];

    return (
      <View
        style={{
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
        }}
      >
        <View
          style={{ height: 3, backgroundColor: config?.border ?? "#E5E7EB" }}
        />

        <View style={{ padding: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: "#1E293B",
                flex: 1,
                marginRight: 8,
              }}
            >
              {item.name}
            </Text>
            {config && (
              <View
                style={{
                  backgroundColor: config.bg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: config.text,
                  }}
                >
                  {config.label}
                </Text>
              </View>
            )}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <CalendarIcon size={13} color="#94A3B8" />
            <Text
              style={{
                fontSize: 13,
                color: "#64748B",
                textTransform: "capitalize",
              }}
            >
              {fmt.format(start)}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              backgroundColor: "#F1F5F9",
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
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
      <View
        style={{
          flex: 1,
          backgroundColor: "#F5F7FA",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={TEAL} />
        <Text
          style={{
            color: "#94A3B8",
            marginTop: 12,
            fontSize: 14,
            fontWeight: "500",
          }}
        >
          A carregar turnos...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 8,
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => setView("calendar")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: view === "calendar" ? NAVY : "#fff",
            borderWidth: 1,
            borderColor: view === "calendar" ? NAVY : "#E2E8F0",
          }}
        >
          <LayoutGrid
            size={16}
            color={view === "calendar" ? "#fff" : NAVY}
          />
          <Text
            style={{
              fontWeight: "700",
              fontSize: 13,
              color: view === "calendar" ? "#fff" : NAVY,
            }}
          >
            Mês
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setView("list")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: view === "list" ? NAVY : "#fff",
            borderWidth: 1,
            borderColor: view === "list" ? NAVY : "#E2E8F0",
          }}
        >
          <List size={16} color={view === "list" ? "#fff" : NAVY} />
          <Text
            style={{
              fontWeight: "700",
              fontSize: 13,
              color: view === "list" ? "#fff" : NAVY,
            }}
          >
            Lista
          </Text>
        </TouchableOpacity>
      </View>

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
          <Text
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "#94A3B8",
              fontWeight: "600",
            }}
          >
            Toca num dia para filtrar
          </Text>
        </View>
      )}

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
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              marginTop: 48,
              gap: 12,
            }}
          >
            <CalendarIcon size={40} color="#CBD5E1" />
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#94A3B8" }}>
              {view === "calendar"
                ? "Sem turnos neste dia"
                : "Sem turnos atribuídos"}
            </Text>
            <Text style={{ fontSize: 13, color: "#CBD5E1" }}>
              {view === "list"
                ? "Os seus turnos aparecerão aqui"
                : "Escolhe outro dia no calendário"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
