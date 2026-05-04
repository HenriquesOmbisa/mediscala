import { useState, useEffect, type ReactElement } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../../src/lib/api";
import { resolveMediaUrl } from "../../../src/lib/media-url";
import { ArrowLeft, Camera, Save, Building2, Mail, Shield, Star } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  FREE: { bg: "#F1F5F9", text: "#64748B", border: "#CBD5E1" },
  STARTER: { bg: "#EFF6FF", text: "#3B82F6", border: "#BFDBFE" },
  PRO: { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
  ENTERPRISE: { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
};

function PlanBadge({ plan }: { plan?: string }) {
  const cfg = PLAN_COLORS[plan ?? "FREE"] ?? PLAN_COLORS.FREE;
  return (
    <View style={{ borderWidth: 1.5, borderColor: cfg.border, backgroundColor: cfg.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 }}>
      <Text style={{ fontSize: 13, fontWeight: "800", color: cfg.text }}>{plan ?? "FREE"}</Text>
    </View>
  );
}

function LimitRow({ label, value }: { label: string; value?: number | null }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
      <Text style={{ fontSize: 14, color: "#64748B" }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "700", color: "#1E293B" }}>{value != null ? value.toLocaleString("pt-PT") : "Ilimitado"}</Text>
    </View>
  );
}

export default function HospitalAdminInstitutionScreen(): ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ["ha-plan"],
    queryFn: async () => (await api.get<{ data: any }>("/billing/current-plan")).data.data,
    staleTime: 60_000,
  });

  const { data: instData, isLoading: instLoading } = useQuery({
    queryKey: ["ha-institution"],
    queryFn: async () => (await api.get<{ data: any }>("/billing/institution")).data.data,
    staleTime: 60_000,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (instData) {
      setName(instData.name ?? "");
      setEmail(instData.contact_email ?? "");
    }
  }, [instData]);

  const updateInst = useMutation({
    mutationFn: (payload: any) => api.patch("/billing/institution", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ha-institution"] });
      setDirty(false);
      Alert.alert("Sucesso", "Informações atualizadas.");
    },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao guardar."),
  });

  const uploadLogo = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      const form = new FormData();
      form.append("file", { uri: asset.uri, name: asset.fileName ?? "logo.jpg", type: asset.mimeType ?? "image/jpeg" } as unknown as Blob);
      await api.post("/billing/institution/logo", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ha-institution"] }); Alert.alert("Sucesso", "Logótipo atualizado."); },
    onError: (err: any) => Alert.alert("Erro", err.response?.data?.message ?? "Erro ao enviar logótipo."),
  });

  const handlePickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permissão", "Ativa o acesso à galeria nas definições."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    uploadLogo.mutate(result.assets[0]);
  };

  const handleSave = () => {
    const payload: any = {};
    if (name.trim()) payload.name = name.trim();
    if (email.trim()) payload.contactEmail = email.trim();
    if (!Object.keys(payload).length) return;
    updateInst.mutate(payload);
  };

  const isLoading = planLoading || instLoading;
  const logoUri = resolveMediaUrl(instData?.logo_url ?? null);
  const inputStyle = {
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: "#1E293B", backgroundColor: "#fff",
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#F5F7FA" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={{ backgroundColor: NAVY, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff", flex: 1 }}>Instituição</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <TouchableOpacity onPress={handlePickLogo} activeOpacity={0.85} style={{ position: "relative" }}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={{ width: 100, height: 100, borderRadius: 20, backgroundColor: "#F1F5F9" }} contentFit="contain" />
              ) : (
                <View style={{ width: 100, height: 100, borderRadius: 20, backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={40} color="#0284C7" />
                </View>
              )}
              <View style={{
                position: "absolute", bottom: -4, right: -4,
                backgroundColor: TEAL, borderRadius: 16, width: 30, height: 30,
                alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: "#F5F7FA",
              }}>
                {uploadLogo.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 12 }}>Toca para alterar o logótipo</Text>
          </View>

          {/* Plan card */}
          {planData && (
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Shield size={18} color={NAVY} />
                  <Text style={{ fontSize: 16, fontWeight: "800", color: NAVY }}>Plano atual</Text>
                </View>
                <PlanBadge plan={planData.plan_name ?? planData.name} />
              </View>
              <LimitRow label="Utilizadores máximos" value={planData.max_users} />
              <LimitRow label="Departamentos máximos" value={planData.max_departments} />
              <LimitRow label="Turnos / mês" value={planData.max_shifts_per_month} />
            </View>
          )}

          {/* Edit form */}
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: NAVY, marginBottom: 16 }}>Informações</Text>

            <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 6 }}>Nome da instituição</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Building2 size={18} color="#94A3B8" />
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={name}
                onChangeText={v => { setName(v); setDirty(true); }}
                placeholder="Nome da instituição"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 6 }}>Email de contacto</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Mail size={18} color="#94A3B8" />
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={email}
                onChangeText={v => { setEmail(v); setDirty(true); }}
                placeholder="contacto@hospital.pt"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={!dirty || updateInst.isPending}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: dirty ? TEAL : "#F1F5F9",
                borderRadius: 16, paddingVertical: 15,
                opacity: updateInst.isPending ? 0.6 : 1,
              }}
            >
              {updateInst.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Save size={17} color={dirty ? "#fff" : "#94A3B8"} />
                  <Text style={{ fontWeight: "800", fontSize: 15, color: dirty ? "#fff" : "#94A3B8" }}>Guardar alterações</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
