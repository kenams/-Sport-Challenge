// src/notifications.ts
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";
import { Platform } from "react-native";

let cachedToken: string | null = null;

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

  const tokenData = await Notifications.getExpoPushTokenAsync();
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
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function notifyCoachObjective(message: string) {
  if (!cachedToken) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Coach Immortal-K",
      body: message,
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
