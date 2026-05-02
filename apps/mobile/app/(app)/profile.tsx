import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { authStorage } from "../../src/lib/auth-storage";
import type { AuthResponse } from "@mediscala/shared";
import { api } from "../../src/lib/api";
import { meRowToAuthUser, type MeRow } from "../../src/lib/profile-map";
import { resolveMediaUrl } from "../../src/lib/media-url";
import {
  Mail,
  Briefcase,
  LogOut,
  Building2,
  Pencil,
  Camera,
  Star,
} from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

const roleLabel: Record<string, string> = {
  HOSPITAL_ADMIN: "Administrador",
  MANAGER: "Manager",
  COLLABORATOR: "Colaborador",
};

export default function ProfileScreen() {
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
      } catch {
        /* offline / error: keep cached user */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    Alert.alert("Sair", "Tens a certeza que queres sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post("/auth/logout");
          } catch {}
          await authStorage.clear();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permissão",
        "Ativa o acesso à galeria nas definições do telemóvel.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const form = new FormData();
      form.append(
        "file",
        {
          uri: asset.uri,
          name: asset.fileName ?? "avatar.jpg",
          type: asset.mimeType ?? "image/jpeg",
        } as unknown as Blob,
      );
      await api.post("/users/me/avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { data } = await api.get<{ data: MeRow }>("/users/me");
      const token = await authStorage.getToken();
      const slug = user?.tenantSlug ?? "";
      if (token && slug) {
        await authStorage.save(token, meRowToAuthUser(data.data, slug));
        setUser(await authStorage.getUser());
        setMe(data.data);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível enviar a foto.");
    }
  };

  const display = me;
  const initial = user?.name?.charAt(0).toUpperCase() ?? "?";
  const avatarUri = resolveMediaUrl(
    display?.avatar_url ?? user?.avatarUrl ?? null,
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F5F7FA" }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          backgroundColor: NAVY,
          paddingTop: 24,
          paddingBottom: 56,
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85}>
          <View style={{ position: "relative" }}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  borderWidth: 2.5,
                  borderColor: TEAL,
                }}
              />
            ) : (
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  backgroundColor: "rgba(42,191,191,0.15)",
                  borderWidth: 2.5,
                  borderColor: TEAL,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 30, fontWeight: "800", color: "#fff" }}
                >
                  {initial}
                </Text>
              </View>
            )}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                backgroundColor: TEAL,
                borderRadius: 18,
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: NAVY,
              }}
            >
              <Camera size={16} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 20,
            fontWeight: "800",
            color: "#fff",
            letterSpacing: 0.3,
            marginTop: 12,
          }}
        >
          {display?.name ?? user?.name ?? "—"}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.55)",
            marginTop: 4,
          }}
        >
          {display?.email ?? user?.email ?? "—"}
        </Text>

        <View
          style={{
            marginTop: 10,
            paddingHorizontal: 14,
            paddingVertical: 5,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(42,191,191,0.4)",
            backgroundColor: "rgba(42,191,191,0.12)",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: TEAL,
              letterSpacing: 0.5,
            }}
          >
            {roleLabel[user?.role ?? ""] ?? user?.role ?? "—"}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginHorizontal: 20,
          marginTop: -28,
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 6,
          gap: 2,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: "#94A3B8",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          INFORMAÇÕES DA CONTA
        </Text>

        <InfoRow
          icon={<Mail size={16} color={TEAL} />}
          label="Email"
          value={display?.email ?? user?.email ?? "—"}
        />
        <Divider />
        <InfoRow
          icon={<Briefcase size={16} color={TEAL} />}
          label="Função"
          value={roleLabel[user?.role ?? ""] ?? user?.role ?? "—"}
        />
        <Divider />
        <InfoRow
          icon={<Building2 size={16} color={TEAL} />}
          label="Departamento"
          value={display?.department_name ?? "—"}
        />
        <Divider />
        <InfoRow
          icon={<Star size={16} color={TEAL} />}
          label="Especialidade"
          value={display?.specialty ?? user?.specialty ?? "—"}
        />

        <TouchableOpacity
          style={{
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: `${TEAL}18`,
            borderRadius: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: `${TEAL}55`,
          }}
          onPress={() =>
            router.push("/edit-profile" as Parameters<typeof router.push>[0])
          }
        >
          <Pencil size={17} color={NAVY} />
          <Text style={{ color: NAVY, fontWeight: "700", fontSize: 15 }}>
            Editar perfil
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{
          marginHorizontal: 20,
          marginTop: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: "#fff",
          borderWidth: 1.5,
          borderColor: "#FCA5A5",
          borderRadius: 16,
          paddingVertical: 14,
          shadowColor: "#EF4444",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        }}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <LogOut size={18} color="#EF4444" />
        <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 15 }}>
          Sair da conta
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: "#F0FAFA",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            color: "#94A3B8",
            fontWeight: "600",
            marginBottom: 2,
          }}
        >
          {label.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 14, color: "#1E293B", fontWeight: "600" }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Divider() {
  return (
    <View style={{ height: 1, backgroundColor: "#F1F5F9", marginLeft: 46 }} />
  );
}
