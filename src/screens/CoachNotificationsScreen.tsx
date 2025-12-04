// src/screens/CoachNotificationsScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";

type NotificationEntry = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  type?: string;
};

export default function CoachNotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<NotificationEntry[]>([]);

  const loadNotifications = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("coach_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setEntries(data as NotificationEntry[]);
    } else {
      setEntries([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  return (
    <ScreenContainer>
      <Text
        style={{
          fontSize: 24,
          fontWeight: "900",
          color: COLORS.text,
          marginBottom: 16,
        }}
      >
        Notifications Coach
      </Text>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              backgroundColor: COLORS.surface,
            }}
          >
            <Text
              style={{
                color: COLORS.textMuted,
                fontSize: 12,
              }}
            >
              {new Date(item.created_at).toLocaleString("fr-FR")}
            </Text>
            <Text
              style={{
                color: COLORS.text,
                fontWeight: "700",
                marginTop: 4,
              }}
            >
              {item.title}
            </Text>
            {item.type && (
              <Text
                style={{
                  color: COLORS.primary,
                  fontSize: 11,
                  fontWeight: "700",
                  marginTop: 2,
                }}
              >
                {item.type.toUpperCase()}
              </Text>
            )}
            <Text style={{ color: COLORS.text }}>{item.body}</Text>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </ScreenContainer>
  );
}
