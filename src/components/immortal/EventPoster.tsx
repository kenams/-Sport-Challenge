import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../theme";
import type { EventStatus } from "../../domain/types";
import { isConfirmed, posterBanner } from "../../screens/helpers/eventStatus";

export type PosterPlayer = { pseudo: string; territory: string };

type Props = {
  playerA: PosterPlayer;
  playerB: PosterPlayer;
  disciplineLabel: string;
  formatLabel: string;
  whenText: string;
  status: EventStatus;
  linkText?: string | null;
  result?: { score_a: number; score_b: number } | null;
  /** Largeur en px ; la hauteur suit le format story 9:16 (référence 1080 x 1920). */
  width?: number;
};

/** Affiche story 9:16 du duel. Un duel non confirmé porte toujours le bandeau « en attente d'accord ». */
export default function EventPoster({ playerA, playerB, disciplineLabel, formatLabel, whenText, status, linkText, result, width = 300 }: Props) {
  const s = width / 1080;
  const fs = (n: number) => Math.max(10, Math.round(n * s));
  const height = Math.round((width * 16) / 9);
  const confirmed = isConfirmed(status);
  const banner = posterBanner(status);
  const label = `Affiche du duel : ${playerA.pseudo} contre ${playerB.pseudo}, ${formatLabel}, ${whenText}. ${banner}.`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.frame, { width, height, borderRadius: Math.round(48 * s) }]}>
      <LinearGradient colors={["#0B0B0F", "#050507", "#150F03"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.inner, { padding: Math.round(70 * s) }]}>
        <View style={styles.top}>
          <Text style={[styles.brand, { fontSize: fs(92), letterSpacing: fs(10) }]}>IMMORTAL</Text>
          <Text style={[styles.motto, { fontSize: fs(44) }]}>Il n'en restera qu'un</Text>
        </View>

        <View style={styles.center}>
          <Text style={[styles.discipline, { fontSize: fs(46) }]}>{disciplineLabel.toUpperCase()}</Text>
          <Player p={playerA} fs={fs} />
          <View style={styles.vsRow}>
            <View style={styles.vsLine} />
            <Text style={[styles.vs, { fontSize: fs(70) }]}>VS</Text>
            <View style={styles.vsLine} />
          </View>
          <Player p={playerB} fs={fs} />
          {result ? (
            <Text style={[styles.result, { fontSize: fs(84) }]}>
              {result.score_a} - {result.score_b}
            </Text>
          ) : null}
          <Text style={[styles.format, { fontSize: fs(44) }]}>{formatLabel}</Text>
        </View>

        <View style={styles.bottom}>
          <Text style={[styles.when, { fontSize: fs(54) }]}>{whenText}</Text>
          <View style={[styles.banner, confirmed ? styles.bannerOk : styles.bannerWait, { paddingVertical: fs(26), borderRadius: fs(24) }]}>
            <Text style={[styles.bannerText, { fontSize: fs(46), color: confirmed ? "#0B0B0B" : "#FACC15" }]}>{banner}</Text>
          </View>
          {linkText ? <Text style={[styles.link, { fontSize: fs(42) }]}>{linkText}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function Player({ p, fs }: { p: PosterPlayer; fs: (n: number) => number }) {
  return (
    <View style={styles.player}>
      <Text style={[styles.name, { fontSize: fs(104) }]} numberOfLines={1} adjustsFontSizeToFit>
        {p.pseudo}
      </Text>
      {p.territory ? <Text style={[styles.territory, { fontSize: fs(48) }]}>{p.territory}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", borderWidth: 2, borderColor: "rgba(212,175,55,0.6)", backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: "space-between" },
  top: { alignItems: "center", gap: 6 },
  brand: { color: COLORS.primary, fontWeight: "900" },
  motto: { color: COLORS.textMuted, fontStyle: "italic", textAlign: "center" },
  center: { alignItems: "center", gap: 10 },
  discipline: { color: COLORS.primary, fontWeight: "800", letterSpacing: 4 },
  player: { alignItems: "center", alignSelf: "stretch" },
  name: { color: COLORS.text, fontWeight: "900", textAlign: "center", alignSelf: "stretch" },
  territory: { color: COLORS.textMuted, textAlign: "center" },
  vsRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: 12 },
  vsLine: { flex: 1, height: 1, backgroundColor: "rgba(212,175,55,0.5)" },
  vs: { color: COLORS.primary, fontWeight: "900" },
  result: { color: COLORS.text, fontWeight: "900" },
  format: { color: COLORS.text, fontWeight: "700", textAlign: "center" },
  bottom: { alignItems: "center", gap: 14 },
  when: { color: COLORS.text, fontWeight: "800", textAlign: "center" },
  banner: { alignSelf: "stretch", alignItems: "center", paddingHorizontal: 12 },
  bannerOk: { backgroundColor: COLORS.primary },
  bannerWait: { borderWidth: 2, borderColor: "#FACC15", backgroundColor: "rgba(250,204,21,0.1)" },
  bannerText: { fontWeight: "900", textAlign: "center" },
  link: { color: COLORS.textMuted, textAlign: "center" },
});
