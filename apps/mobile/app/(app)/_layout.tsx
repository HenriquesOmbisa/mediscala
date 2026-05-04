import { Redirect, Stack } from "expo-router";
import { useEffect, useState, type ReactElement } from "react";
import type { UserRole } from "@mediscala/shared";
import { authStorage } from "../../src/lib/auth-storage";
import { getInitialAppRouteByRole } from "../../src/lib/role-routes";

export default function AppLayout(): ReactElement | null {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    authStorage
      .getUser()
      .then((user) => setRole(user?.role ?? null))
      .finally(() => setIsReady(true));
  }, []);

  if (!isReady) return null;

  if (!role) {
    return <Redirect href="/(auth)/login" />;
  }

  const initialRoute = getInitialAppRouteByRole(role);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="collaborator" />
        <Stack.Screen name="manager" />
        <Stack.Screen name="hospital-admin" />
        <Stack.Screen name="shifts" />
        <Stack.Screen name="coverage" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="edit-profile" />
      </Stack>
      <Redirect href={initialRoute} />
    </>
  );
}
