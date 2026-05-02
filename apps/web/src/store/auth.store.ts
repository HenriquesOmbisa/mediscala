import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthResponse } from "@mediscala/shared";

interface AuthState {
  accessToken: string | null;
  user: AuthResponse["user"] | null;
  setAuth: (token: string, user: AuthResponse["user"]) => void;
  setAccessToken: (token: string) => void;
  /** Merge campos no utilizador em sessão (ex.: após PATCH perfil). */
  patchUser: (patch: Partial<AuthResponse["user"]>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      patchUser: (patch) =>
        set((state) => {
          if (!state.user) return state;
          return { user: { ...state.user, ...patch } };
        }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: "mediscala-auth",
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken }),
    },
  ),
);
