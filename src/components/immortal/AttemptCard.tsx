import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme";
import UserAvatar from "../UserAvatar";
import StatusBadge from "./StatusBadge";
import { formatLabel } from "../../domain/formats";
import type { Attempt } from "../../domain/types";
import { challengeTitle, scoreDisplay, shortDateFr, territoryLabel } from "../../screens/helpers/attempts";

type Props = {
  attempt: Attempt;
  onPress?: () => void;
  /** Nombre de réponses, seulement s'il est connu (jamais inventé). */
  responseCount?: number | null;
  nominative?: boolean;
};

/** Carte d'une performance ou d'un défi : auteur, format, score déclaré OU retenu clairement étiqueté, statut, date. */
export default function AttemptCard({ attempt, onPress, responseCount, nominative }: Props) {
  const pseudo = attempt.pseudo?.trim() || "Joueur";
  const territory = territoryLabel(attempt);
  const format = formatLabel(attempt.format_key);
  const score = scoreDisplay(attempt);
  const retained = score.caption === "Score retenu";
  const date = shortDateFr(attempt.created_at);
  const label = `${challengeTitle(attempt, format)}, par ${pseudo}. ${score.caption} : ${score.value}. Statut : ${attempt.status === "validated" ? "validé" : attempt.status === "pending" ? "en attente de validation" : attempt.status === "rejected" ? "rejeté" : "retiré"}.`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      accessibilityHint={onPress ? "Ouvre le détail du défi" : undefined}
      style={({ pressed }) => [styles.card, pressed ? { opacity: 0.88 } : null, Platform.OS === "web" && onPress ? ({ cursor: "pointer" } as object) : null]}
    >
      <View style={styles.header}>
        <UserAvatar uri={attempt.avatar_url} label={pseudo} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.pseudo} numberOfLines={1}>
            {pseudo}
          </Text>
          {territory ? (
            <Text style={styles.territory} numberOfLines={1}>
              {territory} · déclaré
            </Text>
          ) : null}
        </View>
        <StatusBadge status={attempt.status} compact />
      </View>

      <View style={styles.body}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.title} numberOfLines={2}>
            {challengeTitle(attempt, format)}
          </Text>
          <Text style={styles.format}>{format}</Text>
          {nominative || attempt.recipient_user_id ? <Text style={styles.nominative}>Défi nominatif</Text> : null}
        </View>
        <View style={[styles.scoreBox, retained ? styles.scoreBoxRetained : null]}>
          <Text style={[styles.scoreValue, retained ? { color: COLORS.success } : null]}>{score.value}</Text>
          <Text style={[styles.scoreCaption, retained ? { color: COLORS.success } : null]}>{score.caption}</Text>
          {score.declaredNote ? <Text style={styles.scoreNote}>{score.declaredNote}</Text> : null}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{date}</Text>
        {typeof responseCount === "number" ? (
          <Text style={styles.footerText}>{responseCount === 0 ? "Aucune réponse" : `${responseCount} réponse${responseCount > 1 ? "s" : ""}`}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  pseudo: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  territory: { color: COLORS.textMuted, fontSize: 12 },
  body: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: COLORS.text, fontSize: 17, fontWeight: "800", lineHeight: 22 },
  format: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  nominative: { color: COLORS.textMuted, fontSize: 12, fontStyle: "italic" },
  scoreBox: { minWidth: 96, alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  scoreBoxRetained: { borderColor: "rgba(52,211,153,0.45)", backgroundColor: "rgba(52,211,153,0.08)" },
  scoreValue: { color: COLORS.text, fontSize: 28, fontWeight: "900" },
  scoreCaption: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  scoreNote: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  footer: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  footerText: { color: COLORS.textMuted, fontSize: 12 },
});
