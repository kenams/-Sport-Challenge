import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import { getMyProfile, getMyStats } from "../services/api";
import { leagueForLevel, leagueProgress, LEAGUES } from "../domain/leagues";
import type { MyProfile, MyStats } from "../domain/types";
import { COLORS } from "../theme";

export default function LeagueProgressCard({ onPress }: { onPress: () => void }) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([getMyProfile(), getMyStats()]).then(([p, s]) => {
      if (!active) return;
      setProfile(p.data);
      setStats(s.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []));

  const level = stats?.level ?? 1;
  const league = leagueForLevel(level);
  const progress = leagueProgress(level, league);
  const levelsLeft = league.to === 100 ? 0 : Math.max(0, league.to + 1 - level);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Profil de ${profile?.pseudo ?? "joueur"}, niveau ${level}, ligue ${league.name}`} style={styles.card}>
      <View style={styles.topRow}>
        <UserAvatar uri={profile?.avatar_url} label={profile?.pseudo ?? "J"} size={54} />
        <View style={styles.identity}>
          <Text style={styles.pseudo} numberOfLines={1}>{profile?.pseudo ?? "Mon profil"}</Text>
          <Text style={styles.subline}>Ta progression sportive</Text>
        </View>
        <View style={[styles.medallion, { borderColor: league.color, shadowColor: league.color }]}>
          <FontAwesome5 name="gem" size={17} color={league.color} />
          <Text style={[styles.medalText, { color: league.color }]}>{league.short}</Text>
        </View>
        <View style={styles.levelBlock}>
          <Text style={styles.levelLabel}>NIVEAU</Text>
          <Text style={styles.level}>{level}</Text>
        </View>
      </View>

      <View style={styles.rankLine}>
        <View>
          <Text style={[styles.leagueName, { color: league.color }]}>{league.name}</Text>
          <Text style={styles.label}>{league.label}{levelsLeft ? " · " + levelsLeft + " niveau" + (levelsLeft > 1 ? "x" : "") + " avant " + (LEAGUES[LEAGUES.indexOf(league) + 1]?.name ?? "le sommet") : " · rang maximum"}</Text>
        </View>
        {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.range}>{league.from}–{league.to}</Text>}
      </View>

      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: ((progress * 100) + "%") as `${number}%`, backgroundColor: league.color }]} /></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueStrip}>
        {LEAGUES.map((item) => {
          const current = item.key === league.key;
          const reached = level >= item.from;
          return (
            <View key={item.key} accessibilityLabel={item.name + " niveau " + item.from + " à " + item.to} style={[styles.leaguePill, current ? { borderColor: item.color, backgroundColor: item.color + "22" } : null, !reached ? styles.futurePill : null]}>
              <FontAwesome5 name="gem" size={10} color={reached ? item.color : "#55565C"} />
              <Text style={[styles.pillText, current ? { color: item.color } : null, !reached ? styles.futureText : null]}>{item.name}</Text>
            </View>
          );
        })}
      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: "rgba(212,175,55,0.42)", backgroundColor: "rgba(255,255,255,0.035)", gap: 9 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  pseudo: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  subline: { color: COLORS.textMuted, fontSize: 11 },
  medallion: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#121217", shadowOpacity: 0.18, shadowRadius: 5, elevation: 2 },
  medalText: { fontSize: 8, fontWeight: "900", marginTop: 1 },
  levelBlock: { alignItems: "flex-end", minWidth: 48 },
  levelLabel: { color: COLORS.textMuted, fontSize: 8, letterSpacing: 1, fontWeight: "800" },
  level: { color: COLORS.text, fontSize: 25, lineHeight: 28, fontWeight: "900" },
  rankLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  leagueName: { fontSize: 17, fontWeight: "900" },
  label: { color: COLORS.textMuted, fontSize: 11 },
  range: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  progressTrack: { height: 5, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  leagueStrip: { gap: 6, paddingRight: 10 },
  leaguePill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  futurePill: { opacity: 0.45 },
  pillText: { color: COLORS.textMuted, fontSize: 9, fontWeight: "800" },
  futureText: { color: COLORS.textMuted },
});
