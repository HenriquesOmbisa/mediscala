import { Stack, Redirect } from "expo-router";
import { useEffect, useState, type ReactElement } from "react";
import { authStorage } from "../src/lib/auth-storage";
import { getInitialAppRouteByRole } from "../src/lib/role-routes";
import type { UserRole } from "@mediscala/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout(): ReactElement | null {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    Promise.all([authStorage.getToken(), authStorage.getUser()]).then(
      ([token, user]) => {
        setIsAuthenticated(!!token);
        setUserRole(user?.role ?? null);
      },
    );
  }, []);

  if (isAuthenticated === null) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        {isAuthenticated ? (
          <Redirect href={getInitialAppRouteByRole(userRole)} />
        ) : (
          <Redirect href="/(auth)/login" />
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
