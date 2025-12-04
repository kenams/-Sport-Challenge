// src/screens/FeedScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import ScreenContainer from "../components/ScreenContainer";
import UserAvatar from "../components/UserAvatar";
import { fetchProfilesMap } from "../services/profile";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import { PlayerStats, UserProfile } from "../types";
import { getTitle as getTitleFromLeveling } from "../utils/leveling";
import { ARENA_FAIR_PLAY_THRESHOLD } from "../services/arenaLive";
import { getFairPlayTier } from "../utils/fairPlay";

type ActivityRow = {
  id: number;
  user_id: string;
  pseudo: string | null;
  avatar_url?: string | null;
  type: string;
  challenge_id: number | null;
  message: string | null;
  created_at: string;
};

type Props = {
  navigation: any;
};

function getTypeLabel(type: string): string {
  switch (type) {
    case "challenge_created":
      return "Nouveau défi créé";
    case "challenge_response":
      return "Réponse à un défi";
    case "battle_finished":
      return "Battle terminée";
    case "arena_live_start":
      return "Arena Live lancée";
    case "arena_finished":
      return "Arena Live terminée";
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
  const [profilesMap, setProfilesMap] = useState<Map<string, UserProfile>>(
    new Map()
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
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
        setStatsMap(new Map());
        setProfilesMap(new Map());
        return;
      }

      const activities = (data || []) as ActivityRow[];
      setRows(activities);

      if (activities.length === 0) {
        setStatsMap(new Map());
        setProfilesMap(new Map());
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
      } else {
        const map = new Map<string, PlayerStats>();
        (statsData || []).forEach((row: any) => {
          map.set(row.user_id, row as PlayerStats);
        });
        setStatsMap(map);
      }

      const profileMap = await fetchProfilesMap(userIds);
      setProfilesMap(profileMap);
    } catch (e) {
      console.log("FEED LOAD EXCEPTION", e);
      setRows([]);
      setStatsMap(new Map());
      setProfilesMap(new Map());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id || null);
    });
    loadFeed();
  }, [loadFeed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, [loadFeed]);

  const handleReport = async (targetId: string) => {
    if (!currentUserId) {
      Alert.alert("Connexion requise", "Connecte-toi pour signaler un joueur.");
      return;
    }
    try {
      const reporter =
        profilesMap.get(currentUserId)?.pseudo ||
        `Joueur ${currentUserId.slice(0, 4)}`;
      await supabase.from("activities").insert({
        user_id: currentUserId,
        type: "arena_report",
        challenge_id: null,
        message: `${reporter} a signalé un joueur dans le feed.`,
      });

      const currentScore = statsMap.get(targetId)?.fair_play_score ?? 100;
      const newScore = Math.max(0, currentScore - 3);
      await supabase
        .from("players_stats")
        .update({ fair_play_score: newScore })
        .eq("user_id", targetId);

      setStatsMap((prev) => {
        const clone = new Map(prev);
        const target = clone.get(targetId);
        if (target) {
          clone.set(targetId, { ...target, fair_play_score: newScore });
        }
        return clone;
      });

      Alert.alert("Report envoyé", "Ton signalement a été pris en compte.");
    } catch (e) {
      console.log("FEED REPORT ERROR", e);
      Alert.alert("Erreur", "Impossible d'envoyer le signalement.");
    }
  };

  const renderItem = ({ item }: { item: ActivityRow }) => {
    const stats = statsMap.get(item.user_id);
    const level = stats?.level ?? 1;
    const title = stats?.title ?? getTitleFromLeveling(level);
    const profile = profilesMap.get(item.user_id);
    const displayPseudo =
      profile?.pseudo ||
      item.pseudo ||
      `Joueur ${item.user_id.slice(0, 4)}...${item.user_id.slice(-4)}`;
\\ \\ \\ \\ const\\ typeLabel\\ =\\ getTypeLabel\\(item\\.type\\);\\r\\n\\ \\ \\ \\ const\\ fairPlay\\ =\\ stats\\?\\.fair_play_score\\ \\?\\?\\ 100;\\r\\n\\ \\ \\ \\ const\\ tier\\ =\\ getFairPlayTier\\(fairPlay\\);\\r\\n\\ \\ \\ \\ const\\ isFlagged\\ =\\ fairPlay\\ <\\ ARENA_FAIR_PLAY_THRESHOLD;\\r\\n\\ \\ \\ \\ const\\ hasChallenge\\ =\\ !!item\\.challenge_id;\\r\\n\\r\\n\\ \\ \\ \\ return\\ \\(
      <TouchableOpacity
        activeOpacity={hasChallenge ? 0.85 : 1}
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
        <View style={{ marginRight: 12 }}>
          <UserAvatar
            uri={profile?.avatar_url || item.avatar_url || undefined}
            label={displayPseudo}
            size={48}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: COLORS.text,
            }}
          >
            {displayPseudo}
          </Text>

          <Text
            style={{
              fontSize: 12,
              color: COLORS.text,
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

          <TouchableOpacity
            onPress={() => handleReport(item.user_id)}
            style={{
              marginTop: 8,
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "#F87171",
              alignSelf: "flex-start",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: "#F87171",
                fontWeight: "700",
              }}
            >
              Signaler
            </Text>
          </TouchableOpacity>
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
          Historique des défis créés, réponses et battles terminées.
        </Text>

        {rows.length === 0 ? (
          <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>
            Aucune activité pour l'instant. Crée ou réponds à un défi pour
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



