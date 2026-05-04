import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { api } from "../../src/lib/api";
import { useWebSocket } from "../../src/hooks/useWebSocket";
import { Shield } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

export default function CoverageScreen(): ReactElement {
  const queryClient = useQueryClient();

  useWebSocket({
    coverage_request: () =>
      queryClient.invalidateQueries({ queryKey: ["my-coverage"] }),
    coverage_filled: () =>
      queryClient.invalidateQueries({ queryKey: ["my-coverage"] }),
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["my-coverage"],
    queryFn: async () => (await api.get("/coverage/my")).data.data as any[],
  });

  const respond = useMutation({
    mutationFn: ({
      id,
      response,
    }: {
      id: string;
      response: "ACCEPTED" | "DECLINED";
    }) => api.post(`/coverage/${id}/respond`, { response }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-coverage"] }),
    onError: (err: any) =>
      Alert.alert("Erro", err.response?.data?.message ?? "Ocorreu um erro"),
  });

  const handleRespond = (id: string, response: "ACCEPTED" | "DECLINED") => {
    const label = response === "ACCEPTED" ? "aceitar" : "recusar";
    Alert.alert("Confirmar", `Tens a certeza que queres ${label} este turno?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: response === "ACCEPTED" ? "Aceitar" : "Recusar",
        onPress: () => respond.mutate({ id, response }),
      },
    ]);
  };

  const fmtDT = new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const renderItem = ({ item }: { item: any }) => {
    const isPending =
      item.response === "PENDING" && item.request_status === "OPEN";

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
        {/* Top accent */}
        <View
          style={{ height: 3, backgroundColor: isPending ? TEAL : "#E2E8F0" }}
        />

        <View style={{ padding: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#1E293B",
              marginBottom: 6,
            }}
          >
            {item.shift_name}
          </Text>
          <Text style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>
            {fmtDT.format(new Date(item.start_datetime))} →{" "}
            {new Intl.DateTimeFormat("pt-PT", { timeStyle: "short" }).format(
              new Date(item.end_datetime),
            )}
          </Text>

          {item.expires_at && isPending && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 6,
                backgroundColor: "#FFFBEB",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
                alignSelf: "flex-start",
              }}
            >
              <Text
                style={{ fontSize: 12, color: "#D97706", fontWeight: "600" }}
              >
                ⏱ Expira: {fmtDT.format(new Date(item.expires_at))}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            {isPending ? (
              <>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: TEAL,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: "center",
                    shadowColor: TEAL,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 4,
                  }}
                  onPress={() =>
                    handleRespond(item.coverage_request_id, "ACCEPTED")
                  }
                  activeOpacity={0.8}
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}
                  >
                    Aceitar turno
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#F1F5F9",
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                  }}
                  onPress={() =>
                    handleRespond(item.coverage_request_id, "DECLINED")
                  }
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      color: "#64748B",
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    Recusar
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor:
                    item.response === "ACCEPTED" ? "#E6F9F9" : "#F1F5F9",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: item.response === "ACCEPTED" ? "#158585" : "#64748B",
                  }}
                >
                  {item.response === "ACCEPTED"
                    ? "✓ Aceite"
                    : item.response === "DECLINED"
                      ? "✗ Recusado"
                      : item.request_status}
                </Text>
              </View>
            )}
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
          A carregar...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
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
              marginTop: 80,
              gap: 12,
            }}
          >
            <Shield size={40} color="#CBD5E1" />
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#94A3B8" }}>
              Sem pedidos de cobertura
            </Text>
            <Text style={{ fontSize: 13, color: "#CBD5E1" }}>
              Pedidos de substituição aparecerão aqui
            </Text>
          </View>
        }
      />
    </View>
  );
}
