// src/screens/CoachNotificationsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";

type NotificationEntry = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  type?: string;
};

export default function CoachNotificationsScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isTiny = width < 420;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setIsAuthed(false);
      setEntries([]);
      setLoading(false);
      return;
    }
    setIsAuthed(true);
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

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.subtle}>Chargement...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!isAuthed) {
    return (
      <ScreenContainer>
        <View style={styles.guestCard}>
          <Text style={styles.guestTitle}>Notifications coach</Text>
          <Text style={styles.guestText}>
            Connecte-toi pour recevoir les objectifs et alertes du coach.
          </Text>
          <View style={styles.guestActions}>
            <AppButton
              label="Connexion"
              onPress={() => navigation.navigate("Login")}
            />
            <AppButton
              label="Inscription"
              variant="ghost"
              onPress={() => navigation.navigate("Register")}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={[styles.pageTitle, isTiny && styles.pageTitleTiny]}>
        Notifications Coach
      </Text>
      <Text style={styles.pageSubtitle}>
        Alertes, objectifs et messages prioritaires.
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
        ListEmptyComponent={
          <Text style={styles.empty}>Aucune notification pour le moment.</Text>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    ...TYPO.display,
    color: COLORS.text,
    marginBottom: 16,
  },
  pageTitleTiny: {
    fontSize: 24,
    lineHeight: 30,
  },
  pageSubtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  subtle: {
    color: COLORS.textMuted,
  },
  empty: {
    color: COLORS.textMuted,
    marginTop: 12,
  },
  guestCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    backgroundColor: COLORS.surface,
  },
  guestTitle: {
    ...TYPO.title,
    color: COLORS.text,
    marginBottom: 6,
  },
  guestText: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  guestActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
});