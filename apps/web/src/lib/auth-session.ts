import axios from "axios";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/store/auth.store";

/**
 * Termina sessão no servidor (cookie refresh), limpa estado local e cache React Query.
 */
export async function logoutSession(): Promise<void> {
  try {
    await axios.post("/api/v1/auth/logout", {}, { withCredentials: true });
  } catch {
    /* cookie pode já estar inválido */
  }
  useAuthStore.getState().logout();
  queryClient.clear();
}
