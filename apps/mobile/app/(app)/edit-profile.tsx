import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactElement } from "react";
import { api } from "../../src/lib/api";
import { authStorage } from "../../src/lib/auth-storage";
import { meRowToAuthUser, type MeRow } from "../../src/lib/profile-map";
import { ArrowLeft } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

export default function EditProfileScreen(): ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await authStorage.getUser();
        if (u?.tenantSlug) setTenantSlug(u.tenantSlug);
        const { data } = await api.get<{ data: MeRow }>("/users/me");
        if (cancelled) return;
        setName(data.data.name);
        setSpecialty(data.data.specialty ?? "");
      } catch {
        Alert.alert("Erro", "Não foi possível carregar o perfil.");
        router.back();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSave = async () => {
    if (name.trim().length < 2) {
      Alert.alert("Erro", "Nome demasiado curto.");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/users/me", {
        name: name.trim(),
        specialty: specialty.trim() ? specialty.trim() : null,
      });
      const { data } = await api.get<{ data: MeRow }>("/users/me");
      const token = await authStorage.getToken();
      const slug =
        tenantSlug || (await authStorage.getUser())?.tenantSlug || "";
      const mapped = meRowToAuthUser(data.data, slug);
      if (token) await authStorage.save(token, mapped);
      Alert.alert("Guardado", "Perfil atualizado.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Erro", "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F5F7FA",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F5F7FA" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 16,
            backgroundColor: NAVY,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginRight: 12 }}
          >
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
            Editar perfil
          </Text>
        </View>

        <View style={{ padding: 20, gap: 20 }}>
          <View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: "#94A3B8",
                marginBottom: 8,
                letterSpacing: 0.5,
              }}
            >
              NOME
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nome completo"
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: "#fff",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: "#1E293B",
                borderWidth: 1,
                borderColor: "#E2E8F0",
              }}
            />
          </View>

          <View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: "#94A3B8",
                marginBottom: 8,
                letterSpacing: 0.5,
              }}
            >
              ESPECIALIDADE
            </Text>
            <TextInput
              value={specialty}
              onChangeText={setSpecialty}
              placeholder="Opcional"
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: "#fff",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: "#1E293B",
                borderWidth: 1,
                borderColor: "#E2E8F0",
              }}
            />
          </View>

          <TouchableOpacity
            style={{
              marginTop: 8,
              backgroundColor: NAVY,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: "center",
              opacity: saving ? 0.7 : 1,
            }}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                Guardar alterações
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
