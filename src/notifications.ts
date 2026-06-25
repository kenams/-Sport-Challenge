// src/notifications.ts
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";
import { Platform } from "react-native";

const PROJECT_ID = "76d45c0a-9381-45e3-a60f-12ded6768767";

let cachedToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return;

  const { status } = await Notifications.getPermissionsAsync();
  let finalStatus = status;

  if (status !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    finalStatus = newStatus;
  }

  if (finalStatus !== "granted") return;

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
  const token = tokenData.data;

  cachedToken = token;

  await supabase
    .from("push_tokens")
    .upsert({
      user_id: session.session.user.id,
      token,
      updated_at: new Date().toISOString(),
    });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function notifyCoachObjective(message: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Coach Immortal-K",
      body: message,
      sound: true,
    },
    trigger: null,
  });
}

interface NotificationBoxEntry {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export async function logNotification(
  entry: Omit<NotificationBoxEntry, "id" | "created_at">,
  type: "info" | "rematch" | "coach" = "info"
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;
  await supabase.from("coach_notifications").insert({
    user_id: userId,
    title: entry.title,
    body: entry.body,
    type,
  });
}

export function setupNotificationListeners(
  onNotification: (n: Notifications.Notification) => void,
  onResponse: (r: Notifications.NotificationResponse) => void
) {
  const subReceived = Notifications.addNotificationReceivedListener(onNotification);
  const subResponse = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => {
    subReceived.remove();
    subResponse.remove();
  };
}
