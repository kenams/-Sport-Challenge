// src/screens/FeedScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { COLORS, getSportPalette } from "../theme";
import { PlayerStats, UserProfile } from "../types";
import { getTitle as getTitleFromLeveling } from "../utils/leveling";
import { ARENA_FAIR_PLAY_THRESHOLD } from "../services/arenaLive";
import { getFairPlayTier } from "../utils/fairPlay";
import { useSportTheme } from "../context/SportThemeContext";
import { feedbackTap, playSportFeedback } from "../utils/feedback";
import { scheduleSportRoutineReminder } from "../notifications";

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
  console.log("FeedScreen render — aggressive theme active");
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
  const {
    palette,
    setActiveSport,
    activeSport,
    favoriteSports,
    toggleFavorite,
    hydrated,
    resolvedSport,
    recentSessions,
  } = useSportTheme(sportFilter === "all" ? null : sportFilter);
  const initialPresetRef = useRef(false);
  const themeColors = useMemo(() => {
    if (!resolvedSport) {
      return {
        background: COLORS.background,
        card: COLORS.card,
        border: COLORS.border,
        accent: COLORS.primary,
        text: COLORS.text,
        textMuted: COLORS.textMuted,
        mutedOpacity: 1,
      };
    }
    return {
      background: palette.background,
      card: palette.card,
      border: palette.border,
      accent: palette.accent,
      text: palette.text,
      textMuted: palette.text,
      mutedOpacity: 0.75,
    };
  }, [palette, resolvedSport]);

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
          sportMap.set(row.id, row?.sport || "");
          if (row?.sport) sportsSet.add(row.sport);
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

  useEffect(() => {
    if (!hydrated || initialPresetRef.current) return;
    if (sportFilter !== "all") {
      initialPresetRef.current = true;
      return;
    }
    const preferred = activeSport || favoriteSports[0] || null;
    if (preferred) {
      setSportFilter(preferred);
      setActiveSport(preferred);
    }
    initialPresetRef.current = true;
  }, [hydrated, activeSport, favoriteSports, sportFilter, setActiveSport]);

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

  const handleSportChipPress = useCallback(
    (sportKey: string) => {
      const isCurrent = sportFilter === sportKey;
      if (isCurrent) {
        setSportFilter("all");
        setActiveSport(null);
        feedbackTap();
        return;
      }
      setSportFilter(sportKey);
      if (sportKey === "all") {
        setActiveSport(null);
        feedbackTap();
      } else {
        setActiveSport(sportKey);
        playSportFeedback(sportKey);
      }
    },
    [sportFilter, setActiveSport]
  );

  const handleFavoriteToggle = useCallback(() => {
    if (sportFilter === "all") return;
    toggleFavorite(sportFilter);
    playSportFeedback(sportFilter);
  }, [sportFilter, toggleFavorite]);

  const handleRoutineReminder = useCallback(() => {
    if (sportFilter === "all") return;
    feedbackTap();
    scheduleSportRoutineReminder(sportFilter).catch(() => {});
  }, [sportFilter]);

  const filteredRows =
    sportFilter === "all"
      ? rows
      : rows.filter((item) => {
          const sport = item.challenge_id
            ? challengeSportMap.get(item.challenge_id)
            : null;
          return sport === sportFilter;
        });
  const sportProfileData = useMemo(() => {
    if (sportFilter === "all") return null;
    if (filteredRows.length === 0) return null;
    let created = 0;
    let responses = 0;
    let battles = 0;
    const players = new Set<string>();
    let latest: ActivityRow | null = null;
    filteredRows.forEach((item) => {
      if (item.user_id) players.add(item.user_id);
      switch (item.type) {
        case "challenge_created":
          created += 1;
          break;
        case "challenge_response":
          responses += 1;
          break;
        case "battle_finished":
        case "arena_finished":
          battles += 1;
          break;
        default:
          break;
      }
      if (!latest) {
        latest = item;
        return;
      }
      if (
        new Date(item.created_at).getTime() >
        new Date(latest.created_at).getTime()
      ) {
        latest = item;
      }
    });
    return {
      created,
      responses,
      battles,
      players: players.size,
      lastActivity: latest,
    };
  }, [filteredRows, sportFilter]);
  const sportProfilePalette =
    sportFilter === "all" ? null : getSportPalette(sportFilter);
  const recentSportSession = useMemo(() => {
    if (sportFilter === "all") return null;
    return recentSessions.find((entry) => entry.sport === sportFilter) || null;
  }, [recentSessions, sportFilter]);
  const isFavoriteSport =
    sportFilter !== "all" && favoriteSports.includes(sportFilter);
  const lastActivityLabel = sportProfileData?.lastActivity
    ? getTypeLabel(sportProfileData.lastActivity.type)
    : null;

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
        style={[
          styles.activityCard,
          {
            borderColor: themeColors.border,
            backgroundColor: themeColors.card,
          },
        ]}
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
            <Text style={[styles.activityName, { color: themeColors.text }]}>{displayPseudo}</Text>
            <Text style={[styles.activityTime, { color: themeColors.textMuted, opacity: themeColors.mutedOpacity }]}>
              {new Date(item.created_at).toLocaleString("fr-FR")}
            </Text>
          </View>
          <View style={styles.activityBadges}>
            <Text style={[styles.activityLevel, { color: themeColors.textMuted, opacity: themeColors.mutedOpacity }]}>
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

          <Text style={[styles.activityMessage, { color: themeColors.text }]}>
            {item.message || typeLabel}
          </Text>

          {hasChallenge && (
            <AppButton
              label="Voir le défi"
              size="sm"
              variant="ghost"
              sport={challengeSportMap.get(item.challenge_id!) || undefined}
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
                sport={challengeSportMap.get(item.challenge_id!) || undefined}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

    if (loading) {
      return (
        <ScreenContainer backgroundColor={themeColors.background}>
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" color={themeColors.accent} />
          </View>
        </ScreenContainer>
      );
    }

    return (
      <ScreenContainer backgroundColor={themeColors.background}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "900",
              color: themeColors.text,
              marginBottom: 12,
            }}
          >
            Activite
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: themeColors.textMuted,
              opacity: themeColors.mutedOpacity,
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
                onPress={() => handleSportChipPress(sport)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor:
                    sportFilter === sport
                      ? themeColors.accent
                      : themeColors.border,
                  backgroundColor:
                    sportFilter === sport
                      ? themeColors.accent
                      : "transparent",
                }}
              >
                <Text
                  style={{
                    color: sportFilter === sport
                      ? "#050505"
                      : themeColors.text,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {sport === "all" ? "Tous" : sport}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {favoriteSports.length > 0 && (
            <View style={styles.favoriteRow}>
              <Text
                style={[
                  styles.favoriteLabel,
                  {
                    color: themeColors.textMuted,
                    opacity: themeColors.mutedOpacity,
                  },
                ]}
              >
                Mes favoris
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {favoriteSports.map((sport) => (
                  <TouchableOpacity
                    key={`fav-${sport}`}
                    onPress={() => handleSportChipPress(sport)}
                    style={[
                      styles.favoriteChip,
                      {
                        borderColor:
                          sportFilter === sport
                            ? themeColors.accent
                            : themeColors.border,
                        backgroundColor:
                          sportFilter === sport
                            ? themeColors.accent
                            : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          sportFilter === sport
                            ? "#050505"
                            : themeColors.text,
                        fontWeight: "700",
                      }}
                    >
                      ★ {sport}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {sportProfileData && sportProfilePalette && (
            <View
              style={[
                styles.sportProfileCard,
                {
                  borderColor: themeColors.border,
                  backgroundColor: themeColors.card,
                },
              ]}
            >
              <View style={styles.sportProfileHeader}>
                <Text
                  style={[
                    styles.sportProfileTitle,
                    { color: themeColors.text },
                  ]}
                >
                  Profil {sportFilter}
                </Text>
                <TouchableOpacity onPress={handleFavoriteToggle}>
                  <Text
                    style={{
                      color: isFavoriteSport
                        ? sportProfilePalette.accent
                        : themeColors.textMuted,
                      fontWeight: "800",
                    }}
                  >
                    {isFavoriteSport ? "★ Favori" : "☆ Ajouter"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.sportProfileStatsRow}>
                <View style={styles.sportProfileStat}>
                  <Text
                    style={[
                      styles.sportProfileValue,
                      { color: sportProfilePalette.accent },
                    ]}
                  >
                    {sportProfileData.created}
                  </Text>
                  <Text
                    style={[
                      styles.sportProfileLabel,
                      {
                        color: themeColors.textMuted,
                        opacity: themeColors.mutedOpacity,
                      },
                    ]}
                  >
                    Defis crees
                  </Text>
                </View>
                <View style={styles.sportProfileStat}>
                  <Text
                    style={[
                      styles.sportProfileValue,
                      { color: sportProfilePalette.accent },
                    ]}
                  >
                    {sportProfileData.responses}
                  </Text>
                  <Text
                    style={[
                      styles.sportProfileLabel,
                      {
                        color: themeColors.textMuted,
                        opacity: themeColors.mutedOpacity,
                      },
                    ]}
                  >
                    Reponses
                  </Text>
                </View>
                <View style={styles.sportProfileStat}>
                  <Text
                    style={[
                      styles.sportProfileValue,
                      { color: sportProfilePalette.accent },
                    ]}
                  >
                    {sportProfileData.battles}
                  </Text>
                  <Text
                    style={[
                      styles.sportProfileLabel,
                      {
                        color: themeColors.textMuted,
                        opacity: themeColors.mutedOpacity,
                      },
                    ]}
                  >
                    Battles
                  </Text>
                </View>
                <View style={styles.sportProfileStat}>
                  <Text
                    style={[
                      styles.sportProfileValue,
                      { color: sportProfilePalette.accent },
                    ]}
                  >
                    {sportProfileData.players}
                  </Text>
                  <Text
                    style={[
                      styles.sportProfileLabel,
                      {
                        color: themeColors.textMuted,
                        opacity: themeColors.mutedOpacity,
                      },
                    ]}
                  >
                    Joueurs actifs
                  </Text>
                </View>
              </View>
              {sportProfileData.lastActivity && (
                <Text
                  style={[
                    styles.sportProfileFooter,
                    {
                      color: themeColors.textMuted,
                      opacity: themeColors.mutedOpacity,
                    },
                  ]}
                >
                  Derniere activite : {lastActivityLabel} •{" "}
                  {new Date(
                    sportProfileData.lastActivity.created_at
                  ).toLocaleString("fr-FR")}
                </Text>
              )}
            </View>
          )}
          {sportProfileData && (
            <View
              style={[
                styles.routineCard,
                {
                  borderColor: themeColors.border,
                  backgroundColor: themeColors.card,
                },
              ]}
            >
              <View style={styles.sportProfileHeader}>
                <Text
                  style={[
                    styles.sportProfileTitle,
                    { color: themeColors.text },
                  ]}
                >
                  Routine rapide
                </Text>
                {recentSportSession && (
                  <Text
                    style={{
                      color: themeColors.textMuted,
                      opacity: themeColors.mutedOpacity,
                      fontSize: 11,
                    }}
                  >
                    Live:{" "}
                    {new Date(recentSportSession.timestamp).toLocaleString(
                      "fr-FR"
                    )}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  color: themeColors.textMuted,
                  opacity: themeColors.mutedOpacity,
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                Lance un défi, checke les lives ou programme ton rappel pour{" "}
                {sportFilter}.
              </Text>
              <View style={styles.routineActions}>
                <AppButton
                  label="Créer un défi"
                  size="sm"
                  onPress={() => {
                    feedbackTap();
                    navigation.navigate("CreateChallenge");
                  }}
                  sport={sportFilter === "all" ? undefined : sportFilter}
                />
                <AppButton
                  label="Lives"
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    feedbackTap();
                    navigation.navigate("LiveHub");
                  }}
                  sport={sportFilter === "all" ? undefined : sportFilter}
                />
                <AppButton
                  label="Rappel"
                  size="sm"
                  variant="ghost"
                  onPress={handleRoutineReminder}
                  sport={sportFilter === "all" ? undefined : sportFilter}
                />
              </View>
            </View>
          )}

          {filteredRows.length === 0 ? (
            <Text
              style={{
                color: themeColors.textMuted,
                opacity: themeColors.mutedOpacity,
                fontSize: 14,
              }}
            >
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
    backgroundColor: COLORS.card,
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
    color: COLORS.textMuted,
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
    color: COLORS.danger,
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
    borderColor: COLORS.neonCyan,
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
    borderColor: COLORS.danger,
    },
    reportLabel: {
      fontSize: 11,
      color: COLORS.danger,
      fontWeight: "700",
    },
    openButton: {
      borderColor: COLORS.neonCyan,
    },
    favoriteRow: {
      marginBottom: 16,
    },
    favoriteLabel: {
      fontSize: 11,
      marginBottom: 6,
      fontWeight: "700",
    },
    favoriteChip: {
      marginRight: 10,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    sportProfileCard: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 14,
      marginBottom: 16,
    },
    sportProfileHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sportProfileTitle: {
      fontSize: 16,
      fontWeight: "900",
    },
    sportProfileStatsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    sportProfileStat: {
      minWidth: 70,
    },
    sportProfileValue: {
      fontSize: 20,
      fontWeight: "900",
    },
    sportProfileLabel: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    sportProfileFooter: {
      marginTop: 12,
      fontSize: 11,
      fontWeight: "600",
    },
    routineCard: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
    },
    routineActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
  });
