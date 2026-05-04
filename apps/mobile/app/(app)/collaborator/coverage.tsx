import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { api } from "../../../src/lib/api";
import { useWebSocket } from "../../../src/hooks/useWebSocket";
import { Shield, ArrowLeftRight, Inbox } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

const fmtDT = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" });
const fmtTime = new Intl.DateTimeFormat("pt-PT", { timeStyle: "short" });

// ─── Swap status config ───────────────────────────────────────────────────────
const swapStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
  PENDING_TARGET: { bg: "#FEF3C7", text: "#D97706", label: "A aguardar resposta" },
  PENDING_MANAGER: { bg: "#EFF6FF", text: "#3B82F6", label: "A aguardar gestor" },
  APPROVED: { bg: "#E6F9F9", text: "#158585", label: "Aprovado" },
  REJECTED: { bg: "#FEE2E2", text: "#DC2626", label: "Rejeitado" },
  CANCELLED: { bg: "#F1F5F9", text: "#64748B", label: "Cancelado" },
};

// ─── Received coverage request card ──────────────────────────────────────────
function ReceivedCard({
  item,
  onAccept,
  onDecline,
  loading,
}: {
  item: any;
  onAccept: () => void;
  onDecline: () => void;
  loading: boolean;
}) {
  const isPending = item.response === "PENDING" && item.request_status === "OPEN";
  const isSwap = item.request_type === "SWAP";

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
      <View style={{ height: 3, backgroundColor: isPending ? TEAL : "#E2E8F0" }} />
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {isSwap && (
            <View style={{ backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#3B82F6" }}>TROCA</Text>
            </View>
          )}
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B", flex: 1 }}>{item.shift_name}</Text>
        </View>
        <Text style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>
          {fmtDT.format(new Date(item.start_datetime))} → {fmtTime.format(new Date(item.end_datetime))}
        </Text>
        {item.expires_at && isPending && (
          <View style={{ backgroundColor: "#FFFBEB", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start", marginTop: 6 }}>
            <Text style={{ fontSize: 12, color: "#D97706", fontWeight: "600" }}>
              ⏱ Expira: {fmtDT.format(new Date(item.expires_at))}
            </Text>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {isPending ? (
            <>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: TEAL, paddingVertical: 12, borderRadius: 14, alignItems: "center", opacity: loading ? 0.6 : 1 }}
                onPress={onAccept}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Aceitar</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#F1F5F9", paddingVertical: 12, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", opacity: loading ? 0.6 : 1 }}
                onPress={onDecline}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={{ color: "#64748B", fontWeight: "600", fontSize: 14 }}>Recusar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: item.response === "ACCEPTED" ? "#E6F9F9" : "#F1F5F9",
            }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: item.response === "ACCEPTED" ? "#158585" : "#64748B" }}>
                {item.response === "ACCEPTED" ? "✓ Aceite" : item.response === "DECLINED" ? "✗ Recusado" : "—"}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── My swap request card ─────────────────────────────────────────────────────
function MySwapCard({ item }: { item: any }) {
  const swapStatus = item.swap_status as string;
  const cfg = swapStatusConfig[swapStatus] ?? { bg: "#F1F5F9", text: "#64748B", label: swapStatus };
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
      <View style={{ height: 3, backgroundColor: NAVY }} />
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B", flex: 1, marginRight: 8 }}>
            {item.source_shift_name}
          </Text>
          <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: cfg.text }}>{cfg.label}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 12, color: "#94A3B8", fontWeight: "600", width: 54 }}>O meu:</Text>
            <Text style={{ fontSize: 13, color: "#475569", flex: 1 }}>
              {fmtDT.format(new Date(item.source_start_datetime))}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 12, color: "#94A3B8", fontWeight: "600", width: 54 }}>Destino:</Text>
            <Text style={{ fontSize: 13, color: "#475569", flex: 1 }}>
              {item.target_shift_name} · {fmtDT.format(new Date(item.target_start_datetime))}
            </Text>
          </View>
          {item.target_user_name && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 12, color: "#94A3B8", fontWeight: "600", width: 54 }}>Colega:</Text>
              <Text style={{ fontSize: 13, color: "#475569", flex: 1 }}>{item.target_user_name}</Text>
            </View>
          )}
        </View>
        {item.expires_at && ["PENDING_TARGET","PENDING_MANAGER"].includes(swapStatus) && (
          <View style={{ backgroundColor: "#FFFBEB", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start", marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: "#D97706", fontWeight: "600" }}>
              ⏱ Expira: {fmtDT.format(new Date(item.expires_at))}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function Empty({ icon: Icon, message, sub }: { icon: any; message: string; sub: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 }}>
      <Icon size={38} color="#CBD5E1" />
      <Text style={{ fontSize: 15, fontWeight: "600", color: "#94A3B8" }}>{message}</Text>
      <Text style={{ fontSize: 13, color: "#CBD5E1", textAlign: "center", paddingHorizontal: 32 }}>{sub}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CollaboratorCoverageScreen(): ReactElement {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"received" | "sent">("received");

  useWebSocket({
    coverage_request: () => {
      queryClient.invalidateQueries({ queryKey: ["my-coverage"] });
      queryClient.invalidateQueries({ queryKey: ["my-swaps"] });
    },
    coverage_filled: () => {
      queryClient.invalidateQueries({ queryKey: ["my-coverage"] });
      queryClient.invalidateQueries({ queryKey: ["my-swaps"] });
    },
  });

  const received = useQuery({
    queryKey: ["my-coverage"],
    queryFn: async () => (await api.get("/coverage/my")).data.data as any[],
  });

  const sent = useQuery({
    queryKey: ["my-swaps"],
    queryFn: async () => (await api.get("/coverage/swaps/my")).data.data as any[],
  });

  const respond = useMutation({
    mutationFn: ({ id, response }: { id: string; response: "ACCEPTED" | "DECLINED" }) =>
      api.post(`/coverage/${id}/respond`, { response }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-coverage"] }),
    onError: (err: any) =>
      Alert.alert("Erro", err.response?.data?.message ?? "Ocorreu um erro"),
  });

  const handleRespond = (id: string, response: "ACCEPTED" | "DECLINED") => {
    const label = response === "ACCEPTED" ? "aceitar" : "recusar";
    Alert.alert("Confirmar", `Queres ${label} este pedido?`, [
      { text: "Cancelar", style: "cancel" },
      { text: response === "ACCEPTED" ? "Aceitar" : "Recusar", onPress: () => respond.mutate({ id, response }) },
    ]);
  };

  const isRefreshing = (tab === "received" ? received.isFetching : sent.isFetching) && !received.isLoading && !sent.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      {/* Segment control */}
      <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#F1F5F9", borderRadius: 14, padding: 4 }}>
        {([
          { key: "received", label: "Recebidos", Icon: Shield },
          { key: "sent", label: "Enviados", Icon: ArrowLeftRight },
        ] as const).map(({ key, label, Icon }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setTab(key)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 9,
              borderRadius: 10,
              backgroundColor: tab === key ? "#fff" : "transparent",
              shadowColor: tab === key ? "#000" : "transparent",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: tab === key ? 0.08 : 0,
              shadowRadius: 4,
              elevation: tab === key ? 2 : 0,
            }}
          >
            <Icon size={15} color={tab === key ? NAVY : "#94A3B8"} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: tab === key ? NAVY : "#94A3B8" }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === "received" ? (
        received.isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={TEAL} />
          </View>
        ) : (
          <FlatList
            data={received.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ReceivedCard
                item={item}
                onAccept={() => handleRespond(item.coverage_request_id, "ACCEPTED")}
                onDecline={() => handleRespond(item.coverage_request_id, "DECLINED")}
                loading={respond.isPending}
              />
            )}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={received.refetch} tintColor={TEAL} colors={[TEAL]} />
            }
            ListEmptyComponent={
              <Empty icon={Shield} message="Sem pedidos recebidos" sub="Quando alguém solicitar cobertura serás notificado aqui" />
            }
          />
        )
      ) : (
        sent.isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={TEAL} />
          </View>
        ) : (
          <FlatList
            data={sent.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MySwapCard item={item} />}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={sent.refetch} tintColor={TEAL} colors={[TEAL]} />
            }
            ListEmptyComponent={
              <Empty icon={ArrowLeftRight} message="Sem trocas enviadas" sub="Os teus pedidos de troca de turno aparecerão aqui" />
            }
          />
        )
      )}
    </View>
  );
}
