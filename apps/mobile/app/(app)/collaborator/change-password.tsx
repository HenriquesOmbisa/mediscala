import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, type ReactElement } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { Eye, EyeOff, Lock } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 }}>{label}</Text>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        backgroundColor: "#fff",
        paddingHorizontal: 14,
      }}>
        <View style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
          <Lock size={16} color="#94A3B8" />
        </View>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#CBD5E1"
          secureTextEntry={!show}
          style={{ flex: 1, height: 50, fontSize: 15, color: "#1E293B" }}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setShow((s) => !s)} style={{ padding: 8 }}>
          {show ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen(): ReactElement {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = useMutation({
    mutationFn: () =>
      api.patch("/users/me/password", { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      Alert.alert("Password alterada", "A tua password foi alterada com sucesso.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Erro", err.response?.data?.message ?? "Não foi possível alterar a password.");
    },
  });

  const handleSubmit = () => {
    if (!current.trim()) {
      Alert.alert("Campos obrigatórios", "Introduz a password atual.");
      return;
    }
    if (next.length < 8) {
      Alert.alert("Password fraca", "A nova password deve ter pelo menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      Alert.alert("Passwords diferentes", "A nova password e a confirmação não coincidem.");
      return;
    }
    change.mutate();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F5F7FA" }}
      contentContainerStyle={{ padding: 24, paddingTop: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header card */}
      <View style={{
        backgroundColor: NAVY,
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        alignItems: "center",
      }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(42,191,191,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Lock size={24} color={TEAL} />
        </View>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>Alterar password</Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4, textAlign: "center" }}>
          Usa uma password com pelo menos 8 caracteres
        </Text>
      </View>

      {/* Fields */}
      <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 4 }}>
        <PasswordField
          label="Password atual"
          value={current}
          onChange={setCurrent}
          placeholder="Introduz a password atual"
        />
        <PasswordField
          label="Nova password"
          value={next}
          onChange={setNext}
          placeholder="Mínimo 8 caracteres"
        />
        <PasswordField
          label="Confirmar nova password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Repete a nova password"
        />

        {/* Strength hint */}
        {next.length > 0 && (
          <View style={{
            backgroundColor: next.length >= 8 ? "#E6F9F9" : "#FEF3C7",
            borderRadius: 10,
            padding: 10,
            marginBottom: 4,
          }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: next.length >= 8 ? "#158585" : "#D97706" }}>
              {next.length >= 8 ? "✓ Password com comprimento adequado" : `⚠ Faltam ${8 - next.length} caracteres`}
            </Text>
          </View>
        )}
      </View>

      {/* Submit */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={change.isPending}
        style={{
          backgroundColor: NAVY,
          borderRadius: 16,
          paddingVertical: 16,
          alignItems: "center",
          marginTop: 24,
          opacity: change.isPending ? 0.7 : 1,
        }}
        activeOpacity={0.85}
      >
        {change.isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Confirmar alteração</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14, alignItems: "center" }}>
        <Text style={{ fontSize: 14, color: "#94A3B8", fontWeight: "600" }}>Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
