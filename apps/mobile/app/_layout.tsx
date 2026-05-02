import { Stack, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { authStorage } from "../src/lib/auth-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    authStorage.getToken().then((token) => {
      setIsAuthenticated(!!token);
    });
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
          <Redirect href="/(app)/shifts" />
        ) : (
          <Redirect href="/(auth)/login" />
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
