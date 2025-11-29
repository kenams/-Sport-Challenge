// src/notifications.ts
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";
import { Platform } from "react-native";

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
