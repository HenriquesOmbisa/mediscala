import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactElement } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { authStorage } from "../../../src/lib/auth-storage";
import type { AuthResponse } from "@mediscala/shared";
import { api } from "../../../src/lib/api";
import { meRowToAuthUser, type MeRow } from "../../../src/lib/profile-map";
import { resolveMediaUrl } from "../../../src/lib/media-url";
import { Mail, Briefcase, LogOut, Building2, Pencil, Camera, Star, Lock, Users, Layers, Settings } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Icon size={16} color={NAVY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: "#94A3B8", fontWeight: "600", marginBottom: 1 }}>{label}</Text>
        <Text style={{ fontSize: 14, color: "#1E293B", fontWeight: "600" }}>{value || "—"}</Text>
      </View>
    </View>
  );
}

function ActionRow({ icon: Icon, iconBg, iconColor, label, onPress }: { icon: any; iconBg: string; iconColor: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
      activeOpacity={0.8}
    >
      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} color={iconColor} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: "600", color: "#1E293B", flex: 1 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HospitalAdminProfileScreen(): ReactElement {
  const router = useRouter();
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [me, setMe] = useState<MeRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await authStorage.getUser();
      if (cancelled) return;
      setUser(u);
      try {
        const { data } = await api.get<{ data: MeRow }>("/users/me");
        if (cancelled) return;
        setMe(data.data);
        const token = await authStorage.getToken();
        if (token && u?.tenantSlug) {
          await authStorage.save(token, meRowToAuthUser(data.data, u.tenantSlug));
          setUser(await authStorage.getUser());
        }
      } catch { /* offline */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => {
    Alert.alert("Sair", "Tens a certeza que queres sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair", style: "destructive",
        onPress: async () => {
          try { await api.post("/auth/logout"); } catch {}
          await authStorage.clear();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permissão", "Ativa o acesso à galeria nas definições."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const form = new FormData();
      form.append("file", { uri: asset.uri, name: asset.fileName ?? "avatar.jpg", type: asset.mimeType ?? "image/jpeg" } as unknown as Blob);
      await api.post("/users/me/avatar", form, { headers: { "Content-Type": "multipart/form-data" } });
      const { data } = await api.get<{ data: MeRow }>("/users/me");
      const token = await authStorage.getToken();
      const slug = user?.tenantSlug ?? "";
      if (token && slug) {
        await authStorage.save(token, meRowToAuthUser(data.data, slug));
        setUser(await authStorage.getUser());
        setMe(data.data);
      }
    } catch { Alert.alert("Erro", "Não foi possível enviar a foto."); }
  };

  const initial = user?.name?.charAt(0).toUpperCase() ?? "?";
  const avatarUri = resolveMediaUrl(me?.avatar_url ?? user?.avatarUrl ?? null);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F5F7FA" }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={{ backgroundColor: NAVY, paddingTop: 24, paddingBottom: 56, alignItems: "center", paddingHorizontal: 24 }}>
        <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85}>
          <View style={{ position: "relative" }}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: TEAL }} />
            ) : (
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(42,191,191,0.15)", borderWidth: 2.5, borderColor: TEAL, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 30, fontWeight: "800", color: "#fff" }}>{initial}</Text>
              </View>
            )}
            <View style={{ position: "absolute", bottom: 0, right: 0, backgroundColor: TEAL, borderRadius: 18, width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: NAVY }}>
              <Camera size={16} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 14 }}>{user?.name ?? "—"}</Text>
        <View style={{ backgroundColor: "rgba(42,191,191,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 6 }}>
          <Text style={{ color: TEAL, fontSize: 13, fontWeight: "700" }}>Administrador</Text>
        </View>
      </View>

      {/* Info card */}
      <View style={{ backgroundColor: "#fff", marginHorizontal: 16, marginTop: -28, borderRadius: 20, paddingHorizontal: 16, paddingTop: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 6 }}>
        <InfoRow icon={Mail} label="Email" value={user?.email ?? "—"} />
        <InfoRow icon={Briefcase} label="Especialidade" value={me?.specialty ?? user?.specialty ?? "—"} />
        <InfoRow icon={Building2} label="Departamento" value={me?.department_name ?? "—"} />
        {me?.contract_hours_week != null && (
          <InfoRow icon={Star} label="Horas contratuais / semana" value={`${me.contract_hours_week}h`} />
        )}
      </View>

      {/* Conta */}
      <View style={{ marginHorizontal: 16, marginTop: 16, gap: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 2, paddingLeft: 4 }}>Conta</Text>
        <ActionRow icon={Pencil} iconBg="#EFF6FF" iconColor="#3B82F6" label="Editar perfil" onPress={() => router.push("/(app)/hospital-admin/edit-profile")} />
        <ActionRow icon={Lock} iconBg="#FEF3C7" iconColor="#D97706" label="Alterar password" onPress={() => router.push("/(app)/hospital-admin/change-password")} />
      </View>

      {/* Gestão */}
      <View style={{ marginHorizontal: 16, marginTop: 20, gap: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 2, paddingLeft: 4 }}>Gestão</Text>
        <ActionRow icon={Users} iconBg="#EDE9FE" iconColor="#7C3AED" label="Utilizadores" onPress={() => router.push("/(app)/hospital-admin/users")} />
        <ActionRow icon={Layers} iconBg="#DCFCE7" iconColor="#16A34A" label="Departamentos" onPress={() => router.push("/(app)/hospital-admin/departments")} />
        <ActionRow icon={Settings} iconBg="#E0F2FE" iconColor="#0284C7" label="Configurações da Instituição" onPress={() => router.push("/(app)/hospital-admin/institution")} />
      </View>

      {/* Logout */}
      <View style={{ marginHorizontal: 16, marginTop: 16 }}>
        <TouchableOpacity
          onPress={handleLogout}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FEF2F2", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#FECACA" }}
          activeOpacity={0.8}
        >
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={16} color="#DC2626" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#DC2626", flex: 1 }}>Terminar sessão</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
