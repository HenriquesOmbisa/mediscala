import { useState, type ReactElement } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { useWebSocket } from "../../../src/hooks/useWebSocket";
import { Shield, ArrowLeftRight, AlertTriangle, CheckCircle, XCircle, CalendarOff } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

const fmtDT = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" });
const fmtDate = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" });

// ─── Risk badge ───────────────────────────────────────────────────────────────
const riskConfig: Record<string, { bg: string; text: string; label: string }> = {
  APPROVE: { bg: "#E6F9F9", text: "#158585", label: "Aprovável" },
  REVIEW: { bg: "#FEF3C7", text: "#D97706", label: "Rever" },
  BLOCK: { bg: "#FEE2E2", text: "#DC2626", label: "Bloquear" },
};
function RiskBadge({ rec }: { rec?: string }) {
  if (!rec) return null;
  const cfg = riskConfig[rec] ?? riskConfig.REVIEW;
  return (
    <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: cfg.text }}>{cfg.label}</Text>
    </View>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────
function Empty({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 10 }}>
      <Icon size={38} color="#CBD5E1" />
      <Text style={{ fontSize: 14, fontWeight: "600", color: "#94A3B8" }}>{message}</Text>
    </View>
  );
}

// ─── Absence Card ─────────────────────────────────────────────────────────────
function AbsenceCard({ item, onApprove, loading }: { item: any; onApprove: () => void; loading: boolean }) {
  const typeLabel: Record<string, string> = { SICK: "Doença", PERSONAL: "Pessoal", EMERGENCY: "Emergência", VACATION: "Férias", OTHER: "Outro" };
  const isPending = item.status === "PENDING" || !item.status;
  return (
    <View style={{ backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
      <View style={{ height: 3, backgroundColor: isPending ? "#F59E0B" : TEAL }} />
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B" }}>{item.user_name}</Text>
            <Text style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{item.shift_name}</Text>
            {item.start_datetime && <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{fmtDT.format(new Date(item.start_datetime))}</Text>}
          </View>
          <View style={{ gap: 6, alignItems: "flex-end" }}>
            <View style={{ backgroundColor: "#EFF6FF", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#3B82F6" }}>{typeLabel[item.type] ?? item.type}</Text>
            </View>
            {isPending ? (
              <TouchableOpacity onPress={onApprove} disabled={loading}
                style={{ flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: TEAL, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, opacity: loading ? 0.6 : 1 }}>
                <CheckCircle size={13} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Aprovar</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor: "#E6F9F9", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#158585" }}>✓ Aprovado</Text>
              </View>
            )}
          </View>
        </View>
        {item.reason && <Text style={{ fontSize: 13, color: "#64748B", fontStyle: "italic" }}>"{item.reason}"</Text>}
      </View>
    </View>
  );
}

// ─── Coverage Card ────────────────────────────────────────────────────────────
function CoverageCard({ item, onApprove, onBlock, loading }: { item: any; onApprove: () => void; onBlock: () => void; loading: boolean }) {
  const isOpen = item.status === "OPEN";
  return (
    <View style={{ backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
      <View style={{ height: 3, backgroundColor: isOpen ? TEAL : "#E2E8F0" }} />
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 2 }}>{item.shift_name}</Text>
            {item.start_datetime && <Text style={{ fontSize: 12, color: "#94A3B8" }}>{fmtDT.format(new Date(item.start_datetime))}</Text>}
            {item.requested_by_name && <Text style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Pedido por: {item.requested_by_name}</Text>}
          </View>
          <RiskBadge rec={item.recommendation} />
        </View>
        {item.risk_reasons?.length > 0 && (
          <View style={{ backgroundColor: "#FFFBEB", borderRadius: 10, padding: 8, marginBottom: 10 }}>
            {item.risk_reasons.map((r: string, i: number) => <Text key={i} style={{ fontSize: 12, color: "#D97706" }}>· {r}</Text>)}
          </View>
        )}
        {isOpen ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={onApprove} disabled={loading}
              style={{ flex: 1, backgroundColor: TEAL, borderRadius: 12, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, opacity: loading ? 0.6 : 1 }}>
              <CheckCircle size={14} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Aprovar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onBlock} disabled={loading}
              style={{ flex: 1, backgroundColor: "#FEE2E2", borderRadius: 12, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, opacity: loading ? 0.6 : 1 }}>
              <XCircle size={14} color="#DC2626" /><Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 13 }}>Bloquear</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B" }}>{item.status}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Swap Card ────────────────────────────────────────────────────────────────
function SwapCard({ item, onApprove, onBlock, loading }: { item: any; onApprove: () => void; onBlock: () => void; loading: boolean }) {
  const isPending = item.swap_status === "PENDING_MANAGER";
  return (
    <View style={{ backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
      <View style={{ height: 3, backgroundColor: isPending ? "#F59E0B" : "#E2E8F0" }} />
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 6 }}>Pedido de troca</Text>
            <View style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, gap: 4 }}>
              <Text style={{ fontSize: 12, color: "#64748B" }}>De: {item.source_shift_name} ({item.source_user_name})</Text>
              <Text style={{ fontSize: 12, color: "#64748B" }}>Para: {item.target_shift_name} ({item.target_user_name})</Text>
            </View>
          </View>
          <RiskBadge rec={item.recommendation} />
        </View>
        {isPending ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={onApprove} disabled={loading}
              style={{ flex: 1, backgroundColor: TEAL, borderRadius: 12, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, opacity: loading ? 0.6 : 1 }}>
              <CheckCircle size={14} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Aprovar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onBlock} disabled={loading}
              style={{ flex: 1, backgroundColor: "#FEE2E2", borderRadius: 12, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, opacity: loading ? 0.6 : 1 }}>
              <XCircle size={14} color="#DC2626" /><Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 13 }}>Bloquear</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B" }}>{item.swap_status}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Leave Block Card ─────────────────────────────────────────────────────────
function LeaveBlockCard({
  item,
  onApprove,
  onReject,
  loading,
}: { item: any; onApprove: () => void; onReject: () => void; loading: boolean }) {
  const isPending = item.status === "PENDING";
  const typeLabel: Record<string, string> = { SICK: "Doença", PERSONAL: "Pessoal", EMERGENCY: "Emergência", VACATION: "Férias", OTHER: "Outro" };
  const statusCfg: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: "#FEF3C7", text: "#D97706" },
    APPROVED: { bg: "#E6F9F9", text: "#158585" },
    REJECTED: { bg: "#FEE2E2", text: "#DC2626" },
  };
  const sc = statusCfg[item.status] ?? statusCfg.PENDING;
  return (
    <View style={{ backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
      <View style={{ height: 3, backgroundColor: isPending ? "#F59E0B" : item.status === "APPROVED" ? TEAL : "#EF4444" }} />
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 2 }}>{item.user_name}</Text>
            <Text style={{ fontSize: 13, color: "#64748B" }}>{typeLabel[item.type] ?? item.type}</Text>
            <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
              {fmtDate.format(new Date(item.starts_on))} → {fmtDate.format(new Date(item.ends_on))}
            </Text>
            {item.reason && <Text style={{ fontSize: 13, color: "#64748B", marginTop: 4, fontStyle: "italic" }}>"{item.reason}"</Text>}
          </View>
          <View style={{ backgroundColor: sc.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: sc.text }}>
              {item.status === "PENDING" ? "Pendente" : item.status === "APPROVED" ? "Aprovado" : "Rejeitado"}
            </Text>
          </View>
        </View>
        {isPending && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={onApprove} disabled={loading}
              style={{ flex: 1, backgroundColor: TEAL, borderRadius: 12, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, opacity: loading ? 0.6 : 1 }}>
              <CheckCircle size={14} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Aprovar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onReject} disabled={loading}
              style={{ flex: 1, backgroundColor: "#FEE2E2", borderRadius: 12, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, opacity: loading ? 0.6 : 1 }}>
              <XCircle size={14} color="#DC2626" /><Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 13 }}>Rejeitar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "absences", label: "Ausências", Icon: AlertTriangle },
  { key: "coverage", label: "Coberturas", Icon: Shield },
  { key: "swaps", label: "Trocas", Icon: ArrowLeftRight },
  { key: "leaves", label: "Indispon.", Icon: CalendarOff },
] as const;

type TabKey = typeof TABS[number]["key"];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HospitalAdminCoverageScreen(): ReactElement {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("absences");

  useWebSocket({
    coverage_request: () => {
      queryClient.invalidateQueries({ queryKey: ["ha-absences"] });
      queryClient.invalidateQueries({ queryKey: ["ha-coverage"] });
    },
    coverage_filled: () => queryClient.invalidateQueries({ queryKey: ["ha-coverage"] }),
  });

  const absences = useQuery({
    queryKey: ["ha-absences"],
    queryFn: async () => (await api.get("/absences")).data.data as any[],
    enabled: tab === "absences",
  });

  const coverage = useQuery({
    queryKey: ["ha-coverage"],
    queryFn: async () => (await api.get("/coverage")).data.data as any[],
    enabled: tab === "coverage",
  });

  const swaps = useQuery({
    queryKey: ["ha-swaps"],
    queryFn: async () => (await api.get("/coverage/swaps")).data.data as any[],
    enabled: tab === "swaps",
  });

  // Leaves: fetch all users then their leave blocks
  const leaves = useQuery({
    queryKey: ["ha-leaves"],
    queryFn: async () => {
      const usersRes = await api.get<{ data: { id: string; name: string }[] }>("/users", { params: { pageSize: 100 } });
      const users = usersRes.data.data ?? [];
      const results = await Promise.all(
        users.map(async (u) => {
          try {
            const res = await api.get<{ data: any[] }>(`/users/${u.id}/leave-blocks`);
            return (res.data.data ?? []).map((b: any) => ({ ...b, user_name: u.name, user_id: u.id }));
          } catch { return []; }
        })
      );
      return results.flat();
    },
    enabled: tab === "leaves",
    staleTime: 30_000,
  });

  const approveAbsence = useMutation({
    mutationFn: (id: string) => api.patch(`/absences/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ha-absences"] }),
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao aprovar."),
  });

  const approveCoverage = useMutation({
    mutationFn: (id: string) => api.patch(`/coverage/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ha-coverage"] }),
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro."),
  });

  const blockCoverage = useMutation({
    mutationFn: (id: string) => api.patch(`/coverage/${id}/block`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ha-coverage"] }),
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro."),
  });

  const approveSwap = useMutation({
    mutationFn: (id: string) => api.patch(`/coverage/swaps/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ha-swaps"] }),
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro."),
  });

  const blockSwap = useMutation({
    mutationFn: (id: string) => api.patch(`/coverage/swaps/${id}/block`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ha-swaps"] }),
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro."),
  });

  const updateLeave = useMutation({
    mutationFn: ({ userId, blockId, status }: { userId: string; blockId: string; status: string }) =>
      api.patch(`/users/${userId}/leave-blocks/${blockId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ha-leaves"] }),
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro."),
  });

  const currentQuery = tab === "absences" ? absences : tab === "coverage" ? coverage : tab === "swaps" ? swaps : leaves;
  const isRefreshing = currentQuery.isFetching && !currentQuery.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      {/* Segment */}
      <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#F1F5F9", borderRadius: 14, padding: 4 }}>
        {TABS.map(({ key, label, Icon }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setTab(key)}
            style={{
              flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
              paddingVertical: 8, borderRadius: 10,
              backgroundColor: tab === key ? "#fff" : "transparent",
              elevation: tab === key ? 2 : 0,
            }}
          >
            <Icon size={13} color={tab === key ? NAVY : "#94A3B8"} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: tab === key ? NAVY : "#94A3B8" }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {currentQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : tab === "absences" ? (
        <FlatList
          data={absences.data ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={absences.refetch} tintColor={TEAL} colors={[TEAL]} />}
          ListEmptyComponent={<Empty icon={AlertTriangle} message="Sem ausências registadas" />}
          renderItem={({ item }) => (
            <AbsenceCard item={item} onApprove={() => approveAbsence.mutate(item.id)} loading={approveAbsence.isPending} />
          )}
        />
      ) : tab === "coverage" ? (
        <FlatList
          data={coverage.data ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={coverage.refetch} tintColor={TEAL} colors={[TEAL]} />}
          ListEmptyComponent={<Empty icon={Shield} message="Sem pedidos de cobertura" />}
          renderItem={({ item }) => (
            <CoverageCard item={item}
              onApprove={() => approveCoverage.mutate(item.id)}
              onBlock={() => blockCoverage.mutate(item.id)}
              loading={approveCoverage.isPending || blockCoverage.isPending}
            />
          )}
        />
      ) : tab === "swaps" ? (
        <FlatList
          data={swaps.data ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={swaps.refetch} tintColor={TEAL} colors={[TEAL]} />}
          ListEmptyComponent={<Empty icon={ArrowLeftRight} message="Sem pedidos de troca" />}
          renderItem={({ item }) => (
            <SwapCard item={item}
              onApprove={() => approveSwap.mutate(item.id)}
              onBlock={() => blockSwap.mutate(item.id)}
              loading={approveSwap.isPending || blockSwap.isPending}
            />
          )}
        />
      ) : (
        <FlatList
          data={leaves.data ?? []}
          keyExtractor={item => `${item.user_id}-${item.id}`}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={leaves.refetch} tintColor={TEAL} colors={[TEAL]} />}
          ListEmptyComponent={<Empty icon={CalendarOff} message="Sem indisponibilidades registadas" />}
          renderItem={({ item }) => (
            <LeaveBlockCard
              item={item}
              onApprove={() => updateLeave.mutate({ userId: item.user_id, blockId: item.id, status: "APPROVED" })}
              onReject={() => updateLeave.mutate({ userId: item.user_id, blockId: item.id, status: "REJECTED" })}
              loading={updateLeave.isPending}
            />
          )}
        />
      )}
    </View>
  );
}


