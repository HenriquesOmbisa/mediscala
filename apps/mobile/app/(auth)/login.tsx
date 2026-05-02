import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../src/lib/api";
import { authStorage } from "../../src/lib/auth-storage";
import { LoginSchema } from "@mediscala/shared";
import { Eye, EyeOff, CheckSquare, Square } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    authStorage.getSavedEmail().then((saved) => {
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    });
  }, []);

  const handleLogin = async () => {
    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      Alert.alert("Erro", "Email ou password inválidos");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const { accessToken, user } = data.data;
      if (rememberMe) {
        await authStorage.saveEmail(email);
      } else {
        await authStorage.clearSavedEmail();
      }
      await authStorage.save(accessToken, user);
      router.replace("/(app)/shifts");
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.response?.data?.message ?? "Credenciais inválidas",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: NAVY }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top brand area */}
        <View
          style={{
            alignItems: "center",
            paddingTop: 80,
            paddingBottom: 40,
            paddingHorizontal: 24,
          }}
        >
          <Image
            source={require("../../assets/logo.png")}
            style={{
              width: 80,
              height: 80,
              marginBottom: 20,
              tintColor: "#fff",
            }}
            resizeMode="contain"
          />
          <Text
            style={{
              fontSize: 32,
              fontWeight: "800",
              color: "#fff",
              letterSpacing: -0.5,
            }}
          >
            Medi<Text style={{ color: TEAL }}>Scala</Text>
          </Text>
          <Text
            style={{
              color: "#7B9BBE",
              marginTop: 6,
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Escalas · Equipa · Cuidado
          </Text>
        </View>

        {/* Form card */}
        <View
          style={{
            flex: 1,
            backgroundColor: "#F5F7FA",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 40,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#1a1a2e",
              marginBottom: 6,
            }}
          >
            Bem-vindo de volta
          </Text>
          <Text style={{ fontSize: 13, color: "#9ca3af", marginBottom: 28 }}>
            Introduza as suas credenciais para aceder.
          </Text>

          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: "#374151",
                marginBottom: 6,
              }}
            >
              Email
            </Text>
            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: "#111827",
              }}
              placeholder="nome@hospital.pt"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: "#374151",
                marginBottom: 6,
              }}
            >
              Password
            </Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  paddingRight: 48,
                  fontSize: 15,
                  color: "#111827",
                }}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCorrect={false}
              />
              <TouchableOpacity
                style={{
                  position: "absolute",
                  right: 14,
                  top: 0,
                  bottom: 0,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 4,
                }}
                onPress={() => setShowPassword((v) => !v)}
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Lembrar-me */}
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 24,
            }}
            onPress={() => setRememberMe((v) => !v)}
            activeOpacity={0.7}
          >
            {rememberMe ? (
              <CheckSquare size={20} color={TEAL} />
            ) : (
              <Square size={20} color="#9CA3AF" />
            )}
            <Text
              style={{
                fontSize: 13,
                color: rememberMe ? TEAL : "#6B7280",
                fontWeight: "500",
              }}
            >
              Lembrar o meu email
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: NAVY,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              opacity: loading ? 0.7 : 1,
              shadowColor: NAVY,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                Entrar na plataforma
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
