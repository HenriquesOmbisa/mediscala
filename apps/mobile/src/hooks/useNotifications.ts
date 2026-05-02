import { useEffect, useRef } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "../lib/api";
import { authStorage } from "../lib/auth-storage";

// Push notifications (remote) were removed from Expo Go in SDK 53.
// Dynamically require the module so it never loads in Expo Go.
const isExpoGo = Constants.appOwnership === "expo";
type NotificationsModule = typeof import("expo-notifications");
const Notifications: NotificationsModule | null = isExpoGo
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("expo-notifications");

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function useNotifications() {
  const notificationListener = useRef<ReturnType<
    NotificationsModule["addNotificationReceivedListener"]
  > | null>(null);
  const responseListener = useRef<ReturnType<
    NotificationsModule["addNotificationResponseReceivedListener"]
  > | null>(null);

  useEffect(() => {
    if (!Notifications) return;

    registerForPushNotifications();

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification response:", response);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}

async function registerForPushNotifications() {
  if (!Notifications) return;

  const Device = require("expo-device");
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "MediScala",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const user = await authStorage.getUser();
  if (!user) return;

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await api.put(`/users/${user.id}/push-token`, { pushToken: token.data });
  } catch (err) {
    console.warn("Failed to register push token:", err);
  }
}
