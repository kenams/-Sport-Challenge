// src/notifications.ts
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";
import { Platform } from "react-native";
import Constants from "expo-constants";

let cachedToken: string | null = null;

export async function registerForPushNotifications() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return;

  if (Constants.appOwnership === "expo") {
    console.log(
      "Expo Go detected — push notifications require a development or production build. Skipping registration."
    );
    return;
  }

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

export async function scheduleFavoriteSportPing(sport: string) {
  const normalized =
    sport.length > 1 ? sport[0].toUpperCase() + sport.slice(1) : sport;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔥 ${normalized} en feu`,
        body: "Nouvelle activite detectee. Va voir les defis tout de suite.",
      },
      trigger: { seconds: 5 },
    });
    await logNotification(
      {
        title: `Favori ${normalized}`,
        body: "On te previendra des nouveaux defis lies a ce sport.",
      },
      "coach"
    );
  } catch (err) {
    console.log("FAVORITE SPORT PING ERROR", err);
  }
}

export async function scheduleSportRoutineReminder(sport: string) {
  const normalized =
    sport.length > 1 ? sport[0].toUpperCase() + sport.slice(1) : sport;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Routine ${normalized}`,
        body: "Ta session est planifiée. Fais-le pour de vrai.",
      },
      trigger: { seconds: 60 },
    });
  } catch (err) {
    console.log("SPORT ROUTINE REMINDER ERROR", err);
  }
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
