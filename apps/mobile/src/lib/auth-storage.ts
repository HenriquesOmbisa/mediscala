import * as SecureStore from "expo-secure-store";
import type { AuthResponse } from "@mediscala/shared";

export const authStorage = {
  async save(token: string, user: AuthResponse["user"]) {
    await SecureStore.setItemAsync("access_token", token);
    await SecureStore.setItemAsync("user", JSON.stringify(user));
  },
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync("access_token");
  },
  async getUser(): Promise<AuthResponse["user"] | null> {
    const raw = await SecureStore.getItemAsync("user");
    return raw ? JSON.parse(raw) : null;
  },
  async clear() {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("user");
  },
  async saveEmail(email: string) {
    await SecureStore.setItemAsync("saved_email", email);
  },
  async getSavedEmail(): Promise<string | null> {
    return SecureStore.getItemAsync("saved_email");
  },
  async clearSavedEmail() {
    await SecureStore.deleteItemAsync("saved_email");
  },
};
