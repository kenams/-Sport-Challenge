import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme";
import type { LeaderboardRow as Row } from "../../domain/types";

type Props = { row: Row; isMe: boolean; isChampion: boolean; unit: string };

function achievedLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/** Ligne de classement : rang, pseudo, ville déclarée, meilleur score validé. Champion et "moi" restent lisibles sans la couleur seule. */
export default function LeaderboardRow({ row, isMe, isChampion, unit }: Props) {
  const name = row.pseudo?.trim() || "Joueur";
  const place = [row.city].filter(Boolean).join("");
  const label = `${row.rank}e, ${name}${isMe ? " (toi)" : ""}${isChampion ? ", champion actuel" : ""}, ${row.best_score} ${unit}${place ? `, ${place}` : ""}`;
  return (
    <View accessible accessibilityLabel={label} style={[styles.row, isMe ? styles.me : null, isChampion ? styles.champion : null]}>
      <Text style={[styles.rank, isChampion ? { color: COLORS.primary } : null]}>{row.rank}</Text>
      <View style={styles.main}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {isMe ? <Text style={styles.tag}>Toi</Text> : null}
          {isChampion ? <Text style={[styles.tag, styles.tagGold]}>Champion actuel</Text> : null}
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {place ? `${place} · ` : ""}réalisé le {achievedLabel(row.achieved_at)}
        </Text>
      </View>
      <View style={styles.scoreWrap}>
        <Text style={styles.score}>{row.best_score}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  me: { borderColor: "rgba(52,211,153,0.6)", backgroundColor: "rgba(52,211,153,0.07)" },
  champion: { borderColor: "rgba(212,175,55,0.7)", backgroundColor: "rgba(212,175,55,0.09)" },
  rank: { width: 34, textAlign: "center", color: COLORS.textMuted, fontSize: 20, fontWeight: "900" },
  main: { flex: 1, gap: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { color: COLORS.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },
  tag: { color: COLORS.success, fontSize: 11, fontWeight: "800", borderWidth: 1, borderColor: "rgba(52,211,153,0.5)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  tagGold: { color: COLORS.primary, borderColor: "rgba(212,175,55,0.6)" },
  sub: { color: COLORS.textMuted, fontSize: 12 },
  scoreWrap: { alignItems: "flex-end", minWidth: 56 },
  score: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  unit: { color: COLORS.textMuted, fontSize: 11 },
});
