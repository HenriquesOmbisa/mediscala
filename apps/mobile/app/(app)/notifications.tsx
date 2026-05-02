import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { api } from "../../src/lib/api";
import { Bell } from "lucide-react-native";

const TEAL = "#2ABFBF";
const NAVY = "#162B4A";

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data.data as any[],
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = data?.filter((n: any) => !n.read).length ?? 0;

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
          A carregar notificações...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      {unreadCount > 0 && (
        <TouchableOpacity
          style={{
            marginHorizontal: 16,
            marginTop: 14,
            backgroundColor: "#E6F9F9",
            borderWidth: 1,
            borderColor: "rgba(42,191,191,0.25)",
            borderRadius: 14,
            paddingVertical: 12,
            alignItems: "center",
          }}
          onPress={() => markAllRead.mutate()}
          activeOpacity={0.8}
        >
          <Text style={{ color: TEAL, fontWeight: "700", fontSize: 13 }}>
            Marcar todas como lidas ({unreadCount})
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={TEAL}
            colors={[TEAL, NAVY]}
          />
        }
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              marginHorizontal: 16,
              marginBottom: 8,
              borderRadius: 16,
              padding: 14,
              backgroundColor: item.read ? "#fff" : "#F0FAFA",
              borderWidth: 1,
              borderColor: item.read ? "#F1F5F9" : "rgba(42,191,191,0.2)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
            onPress={() => !item.read && markRead.mutate(item.id)}
            activeOpacity={0.7}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: item.read ? "#64748B" : "#1E293B",
                  flex: 1,
                  marginRight: 8,
                }}
              >
                {item.title}
              </Text>
              {!item.read && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: TEAL,
                    marginTop: 4,
                  }}
                />
              )}
            </View>
            <Text
              style={{
                fontSize: 13,
                marginTop: 4,
                color: item.read ? "#94A3B8" : "#475569",
                lineHeight: 18,
              }}
            >
              {item.message}
            </Text>
            <Text style={{ fontSize: 11, color: "#CBD5E1", marginTop: 8 }}>
              {new Intl.DateTimeFormat("pt-PT", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(item.created_at))}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              marginTop: 80,
              gap: 12,
            }}
          >
            <Bell size={40} color="#CBD5E1" />
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#94A3B8" }}>
              Sem notificações
            </Text>
            <Text style={{ fontSize: 13, color: "#CBD5E1" }}>
              As suas notificações aparecerão aqui
            </Text>
          </View>
        }
      />
    </View>
  );
}
