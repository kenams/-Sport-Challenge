// src/screens/FeedScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import { PlayerStats } from "../types";
import { getTitle as getTitleFromLeveling } from "../utils/leveling";

type ActivityRow = {
  id: number;
  user_id: string;
  pseudo: string | null;
  type: string;
  challenge_id: number | null;
  message: string | null;
  created_at: string;
};

type Props = {
  navigation: any;
};

function getAvatarEmoji(level: number): string {
  if (level <= 2) return "🟢";
  if (level <= 4) return "🔥";
  if (level <= 7) return "🐯";
  if (level <= 9) return "💎";
  return "👑";
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "challenge_created":
      return "Nouveau défi créé";
    case "challenge_response":
      return "Réponse à un défi";
    case "battle_finished":
      return "Battle terminée";
    default:
      return "Activité";
  }
}

export default function FeedScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, PlayerStats>>(
    new Map()
  );

  const loadFeed = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.log("FEED ACTIVITIES ERROR", error);
        setRows([]);
        return;
      }

      const activities = (data || []) as ActivityRow[];
      setRows(activities);

      if (activities.length === 0) {
        setStatsMap(new Map());
        return;
      }

      const userIds = Array.from(
        new Set(activities.map((a) => a.user_id).filter(Boolean))
      );

      const { data: statsData, error: statsError } = await supabase
        .from("players_stats")
        .select("*")
        .in("user_id", userIds);

      if (statsError) {
        console.log("FEED STATS ERROR", statsError);
        setStatsMap(new Map());
        return;
      }

      const map = new Map<string, PlayerStats>();
      (statsData || []).forEach((row: any) => {
        map.set(row.user_id, row as PlayerStats);
      });

      setStatsMap(map);
    } catch (e) {
      console.log("FEED LOAD EXCEPTION", e);
      setRows([]);
      setStatsMap(new Map());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, []);

  const renderItem = ({ item }: { item: ActivityRow }) => {
    const stats = statsMap.get(item.user_id);
    const level = stats?.level ?? 1;
    const title = stats?.title ?? getTitleFromLeveling(level);
    const avatar = getAvatarEmoji(level);
    const typeLabel = getTypeLabel(item.type);

    const hasChallenge = !!item.challenge_id;

    return (
      <TouchableOpacity
        activeOpacity={hasChallenge ? 0.8 : 1}
        onPress={() => {
          if (hasChallenge) {
            navigation.navigate("ChallengeDetail", {
              challengeId: item.challenge_id,
            });
          }
        }}
        style={{
          flexDirection: "row",
          paddingVertical: 10,
          paddingHorizontal: 10,
          marginBottom: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: "#020617",
        }}
      >
        {/* Avatar */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 10,
            backgroundColor: "#111827",
          }}
        >
          <Text style={{ fontSize: 22 }}>{avatar}</Text>
        </View>

        {/* Contenu */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: "#E5E7EB",
            }}
          >
            {item.pseudo || `Joueur ${item.user_id.slice(0, 4)}…${item.user_id.slice(-4)}`}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: "#9CA3AF",
              marginBottom: 4,
            }}
          >
            {title} • Niveau {level}
          </Text>

          <Text
            style={{
              fontSize: 12,
              color: "#E5E7EB",
              marginBottom: 4,
            }}
          >
            {item.message || typeLabel}
          </Text>

          <Text
            style={{
              fontSize: 10,
              color: "#6B7280",
            }}
          >
            {new Date(item.created_at).toLocaleString("fr-FR")}
          </Text>

          {hasChallenge && (
            <View
              style={{
                marginTop: 6,
                alignSelf: "flex-start",
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#38BDF8",
                backgroundColor: "rgba(56,189,248,0.1)",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: "#38BDF8",
                  fontWeight: "700",
                }}
              >
                Voir le défi
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: COLORS.text,
            marginBottom: 12,
          }}
        >
          Activité
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: COLORS.textMuted,
            marginBottom: 16,
          }}
        >
          Historiques des défis créés, réponses et battles terminées.
        </Text>

        {rows.length === 0 ? (
          <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>
            Aucune activité pour l’instant. Crée ou réponds à des défis pour
            remplir le feed.
          </Text>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}
