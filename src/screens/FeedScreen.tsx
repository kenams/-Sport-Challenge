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
  ScrollView,
  StyleSheet,
} from "react-native";

import ScreenContainer from "../components/ScreenContainer";
import UserAvatar from "../components/UserAvatar";
import AppButton from "../components/AppButton";
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
      return "Nouveau dfi cr";
    case "challenge_response":
      return "Rponse  un dfi";
    case "battle_finished":
      return "Battle termine";
    case "arena_live_start":
      return "Arena Live lance";
    case "arena_finished":
      return "Arena Live termine";
    default:
      return "Activit";
  }
}

export default function FeedScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, PlayerStats>>(new Map());
  const [profilesMap, setProfilesMap] = useState<Map<string, UserProfile>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [challengeSportMap, setChallengeSportMap] = useState<Map<number, string>>(
    new Map()
  );
  const [availableSports, setAvailableSports] = useState<string[]>([]);

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

      const userIds = Array.from(new Set(activities.map((a) => a.user_id).filter(Boolean)));
      const challengeIds = Array.from(
        new Set(activities.map((a) => a.challenge_id).filter(Boolean))
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

      if (challengeIds.length > 0) {
        const { data: challengesData } = await supabase
          .from("challenges")
          .select("id,sport")
          .in("id", challengeIds as number[]);
        const sportMap = new Map<number, string>();
        const sportsSet = new Set<string>();
        (challengesData || []).forEach((row: any) => {
          sportMap.set(row.id, row.sport);
          if (row.sport) sportsSet.add(row.sport);
        });
        setChallengeSportMap(sportMap);
        setAvailableSports(Array.from(sportsSet));
      } else {
        setChallengeSportMap(new Map());
        setAvailableSports([]);
      }
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
        message: `${reporter} a signal un joueur dans le feed.`,
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

      Alert.alert("Report envoy", "Ton signalement a t pris en compte.");
    } catch (e) {
      console.log("FEED REPORT ERROR", e);
      Alert.alert("Erreur", "Impossible d'envoyer le signalement.");
    }
  };

  const filteredRows =
    sportFilter === "all"
      ? rows
      : rows.filter((item) => {
          const sport = item.challenge_id
            ? challengeSportMap.get(item.challenge_id)
            : null;
          return sport === sportFilter;
        });

  const renderItem = ({ item }: { item: ActivityRow }) => {
    const stats = statsMap.get(item.user_id);
    const level = stats?.level ?? 1;
    const title = stats?.title ?? getTitleFromLeveling(level);
    const profile = profilesMap.get(item.user_id);
    const displayPseudo =
      profile?.pseudo ||
      item.pseudo ||
      `Joueur ${item.user_id.slice(0, 4)}...${item.user_id.slice(-4)}`;
    const typeLabel = getTypeLabel(item.type);
    const fairPlay = stats?.fair_play_score ?? 100;
    const tier = getFairPlayTier(fairPlay);
    const isFlagged = fairPlay < ARENA_FAIR_PLAY_THRESHOLD;
    const hasChallenge = !!item.challenge_id;

    return (
      <TouchableOpacity
        activeOpacity={hasChallenge ? 0.85 : 1}
        onPress={() => {
          if (hasChallenge) {
            navigation.navigate("ChallengeDetail", {
              challengeId: item.challenge_id,
            });
          }
        }}
        style={styles.activityCard}
      >
        <View style={styles.activityAvatar}>
          <UserAvatar
            uri={profile?.avatar_url || item.avatar_url || undefined}
            label={displayPseudo}
            size={48}
          />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityName}>{displayPseudo}</Text>
            <Text style={styles.activityTime}>
              {new Date(item.created_at).toLocaleString("fr-FR")}
            </Text>
          </View>
          <View style={styles.activityBadges}>
            <Text style={styles.activityLevel}>
              {title} • Niveau {level}
            </Text>
            <View
              style={[
                styles.activityTier,
                { borderColor: tier.color },
              ]}
            >
              <Text style={[styles.activityTierLabel, { color: tier.color }]}>
                {tier.label} ({fairPlay})
              </Text>
            </View>
          </View>
          {isFlagged && (
            <Text style={styles.flagText}>
              Sous surveillance (fair-play faible)
            </Text>
          )}

          <Text style={styles.activityMessage}>
            {item.message || typeLabel}
          </Text>

          {hasChallenge && (
            <AppButton
              label="Voir le défi"
              size="sm"
              variant="ghost"
              style={styles.previewButton}
              onPress={() =>
                navigation.navigate("ChallengeDetail", {
                  challengeId: item.challenge_id,
                })
              }
            />
          )}

          <View style={styles.activityActions}>
            <TouchableOpacity
              onPress={() => handleReport(item.user_id)}
              style={styles.reportButton}
            >
              <Text style={styles.reportLabel}>Signaler</Text>
            </TouchableOpacity>
            {hasChallenge && (
              <AppButton
                label="Ouvrir"
                size="sm"
                variant="ghost"
                style={styles.openButton}
                onPress={() =>
                  navigation.navigate("ChallengeDetail", {
                    challengeId: item.challenge_id,
                  })
                }
              />
            )}
          </View>
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
          Activite
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: COLORS.textMuted,
            marginBottom: 16,
          }}
        >
          Historique des defis crees, reponses et battles terminees.
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginBottom: 12,
            gap: 8,
          }}
        >
          {["all", ...availableSports].map((sport) => (
            <TouchableOpacity
              key={sport}
              onPress={() => setSportFilter(sport)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor:
                  sportFilter === sport ? COLORS.primary : COLORS.border,
                backgroundColor:
                  sportFilter === sport ? COLORS.primary : "transparent",
              }}
            >
              <Text
                style={{
                  color: sportFilter === sport ? "#050505" : COLORS.text,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {sport === "all" ? "Tous" : sport}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredRows.length === 0 ? (
          <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>
            Aucune activite pour ce filtre. Cre ou reponds a un defi pour
            remplir le feed.
          </Text>
        ) : (
          <FlatList
            data={filteredRows}
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

const styles = StyleSheet.create({
  activityCard: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#020617",
  },
  activityAvatar: {
    marginRight: 12,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activityName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  activityTime: {
    fontSize: 10,
    color: "#6B7280",
  },
  activityBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
    marginBottom: 6,
    gap: 6,
  },
  activityLevel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  activityTier: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  activityTierLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  flagText: {
    fontSize: 11,
    color: "#f87171",
    marginBottom: 4,
    fontWeight: "700",
  },
  activityMessage: {
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 4,
  },
  previewButton: {
    marginTop: 6,
    borderColor: "#38BDF8",
  },
  activityActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  reportButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F87171",
  },
  reportLabel: {
    fontSize: 11,
    color: "#F87171",
    fontWeight: "700",
  },
  openButton: {
    borderColor: "#38BDF8",
  },
});
