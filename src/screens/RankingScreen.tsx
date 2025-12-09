import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { supabase } from "../supabase";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../theme";
import SectionHeader from "../components/SectionHeader";
import StatBox from "../components/StatBox";

interface RankingItem {
  user_id: string;
  email: string;
  points: number;
  level: number;
  pseudo?: string;
}

export default function RankingScreen() {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topPlayer, setTopPlayer] = useState<RankingItem | null>(null);

  const load = async () => {
    try {
      const { data } = await supabase
        .from("players_stats")
        .select("user_id, points, level")
        .order("points", { ascending: false })
        .limit(100);

      if (!data) {
        setRanking([]);
        setTopPlayer(null);
        return;
      }

      const profiles: RankingItem[] = [];
      for (let p of data) {
        const { data: user } = await supabase
          .from("users")
          .select("email, user_metadata")
          .eq("id", p.user_id)
          .single();

        const pseudo =
          user?.user_metadata?.pseudo || user?.email?.split("@")[0] || "joueur";
        const profile: RankingItem = {
          ...p,
          email: user?.email ?? "joueur",
          pseudo,
        };
        profiles.push(profile);
      }

      setRanking(profiles);
      setTopPlayer(profiles[0] || null);
    } catch (error) {
      console.log("Ranking load error:", error);
      setRanking([]);
      setTopPlayer(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement du classement...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const getMedalEmoji = (position: number) => {
    switch (position) {
      case 0:
        return "🥇";
      case 1:
        return "🥈";
      case 2:
        return "🥉";
      default:
        return "⭐";
    }
  };

  const getRankColor = (position: number) => {
    switch (position) {
      case 0:
        return COLORS.yellow;
      case 1:
        return COLORS.cyan;
      case 2:
        return COLORS.orange;
      default:
        return COLORS.primary;
    }
  };

  return (
    <ScreenContainer>
      {/* Hero Section - Top Player */}
      {topPlayer && (
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>👑</Text>
          <Text style={styles.heroTitle}>{topPlayer.pseudo}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{topPlayer.level}</Text>
              <Text style={styles.heroStatLabel}>Niveau</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{topPlayer.points}</Text>
              <Text style={styles.heroStatLabel}>Points</Text>
            </View>
          </View>
        </View>
      )}

      {/* Section Header */}
      <SectionHeader
        title="Classement Global"
        subtitle={`${ranking.length} joueurs`}
        icon="🏆"
        color={COLORS.primary}
      />

      {/* Ranking List */}
      <FlatList
        scrollEnabled={false}
        data={ranking}
        keyExtractor={(item) => item.user_id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.rankingCard,
              index < 3 && {
                borderColor: getRankColor(index),
                borderWidth: 2,
                backgroundColor: `${getRankColor(index)}10`,
              },
            ]}
          >
            <View style={styles.rankingRow}>
              {/* Position */}
              <View style={styles.positionBadge}>
                <Text style={styles.positionNumber}>{index + 1}</Text>
              </View>

              {/* Player Info */}
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{item.pseudo}</Text>
                <Text style={styles.playerEmail}>{item.email}</Text>
              </View>

              {/* Stats */}
              <View style={styles.statsGroup}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{item.level}</Text>
                  <Text style={styles.statLabel}>Niv</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: COLORS.primary }]}>
                    {item.points}
                  </Text>
                  <Text style={styles.statLabel}>Pts</Text>
                </View>
              </View>

              {/* Medal */}
              <Text style={styles.medal}>{getMedalEmoji(index)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>Pas de données de classement</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Stats Summary */}
      {ranking.length > 0 && (
        <View style={styles.summarySection}>
          <SectionHeader
            title="Statistiques"
            color={COLORS.blue}
            icon="📊"
          />
          <View style={styles.statsGrid}>
            <StatBox
              label="Meilleur Niveau"
              value={Math.max(...ranking.map((r) => r.level))}
              icon="📈"
              color={COLORS.blue}
            />
            <StatBox
              label="Meilleur Score"
              value={Math.max(...ranking.map((r) => r.points))}
              icon="⭐"
              color={COLORS.yellow}
            />
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 12,
    fontSize: 14,
  },
  heroSection: {
    marginHorizontal: 16,
    marginVertical: 20,
    padding: 24,
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: `${COLORS.primary}40`,
    alignItems: "center",
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  heroStats: {
    flexDirection: "row",
    gap: 24,
  },
  heroStat: {
    alignItems: "center",
  },
  heroStatValue: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primary,
  },
  heroStatLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  rankingCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  positionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
  },
  positionNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  playerEmail: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statsGroup: {
    flexDirection: "row",
    gap: 12,
  },
  statItem: {
    alignItems: "center",
    minWidth: 40,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  medal: {
    fontSize: 20,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContent: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  summarySection: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
});
