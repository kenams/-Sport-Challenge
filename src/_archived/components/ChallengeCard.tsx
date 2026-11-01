// src/components/ChallengeCard.tsx
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Challenge, UserProfile } from "../types";
import { COLORS, getSportPalette } from "../theme";
import UserAvatar from "./UserAvatar";
import { getSportDomain } from "../utils/sports";

interface Props {
  challenge: Challenge;
  onPress?: () => void;
  profile?: UserProfile;
  variant?: "challenge" | "performance";
}

const AI_CONFIG = {
  validated: { color: "#34D399", icon: "check-circle", label: "IA validé" },
  ok: { color: "#34D399", icon: "check-circle", label: "IA validé" },
  rejected: { color: "#EF4444", icon: "times-circle", label: "Rejeté" },
  flagged: { color: "#F59E0B", icon: "exclamation-circle", label: "À vérifier" },
};

export default function ChallengeCard({ challenge, onPress, profile, variant = "challenge" }: Props) {
  const palette = getSportPalette(challenge.sport);
  const domain = getSportDomain(challenge.sport);

  const colorKey = String(challenge.id ?? challenge.title ?? challenge.user_id);
  let hash = 0;
  for (let i = 0; i < colorKey.length; i += 1) hash = (hash * 31 + colorKey.charCodeAt(i)) >>> 0;
  const accents = ["#F59E0B", "#22D3EE", "#F97316", "#A3E635", "#FB7185", "#60A5FA", "#C084FC", "#FACC15", "#34D399", "#F472B6"];
  const accent = accents[hash % accents.length];

  const displayName = profile?.pseudo || challenge.pseudo || `Joueur ${challenge.user_id.slice(0, 4)}`;
  const aiStatus = challenge.ai_status;
  const aiCfg = aiStatus ? AI_CONFIG[aiStatus as keyof typeof AI_CONFIG] : null;

  const timeAgo = () => {
    if (!challenge.created_at) return null;
    const diff = Date.now() - new Date(challenge.created_at).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "À l'instant";
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `Il y a ${d}j`;
    return new Date(challenge.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.card, { borderColor: accent + "55", shadowColor: accent }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <UserAvatar uri={profile?.avatar_url || challenge.avatar_url || undefined} label={displayName} size={44} />
        <View style={styles.headerText}>
          <Text style={styles.challengeTitle} numberOfLines={1}>{challenge.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.authorName}>{displayName}</Text>
            {timeAgo() && (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.timeText}>{timeAgo()}</Text>
              </>
            )}
          </View>
        </View>
        {aiCfg && (
          <View style={[styles.aiBadge, { borderColor: aiCfg.color + "55", backgroundColor: aiCfg.color + "15" }]}>
            <FontAwesome5 name={aiCfg.icon as any} size={10} color={aiCfg.color} />
            <Text style={[styles.aiLabel, { color: aiCfg.color }]}>{aiCfg.label}</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={styles.description} numberOfLines={2}>{challenge.description}</Text>

      {/* Domaine sport */}
      <View style={[styles.domainBand, { borderColor: accent + "44", backgroundColor: getSportPalette(domain.paletteKey).background }]}>
        <Text style={[styles.domainLabel, { color: getSportPalette(domain.paletteKey).accent }]}>{domain.label}</Text>
        <Text style={styles.domainTagline} numberOfLines={1}>{domain.tagline}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerPill}>
          <FontAwesome5 name="dumbbell" size={10} color={accent} />
          <Text style={[styles.footerSport, { color: accent }]}>{challenge.sport}</Text>
        </View>
        <View style={styles.footerPill}>
          <FontAwesome5 name="bullseye" size={10} color={COLORS.textMuted} />
          <Text style={styles.footerTarget}>
            {variant === "performance" ? "Perf" : "Objectif"} : {challenge.target_value} {challenge.unit}
          </Text>
        </View>
        {challenge.ranked && (
          <View style={[styles.footerPill, styles.rankedPill]}>
            <FontAwesome5 name="trophy" size={9} color={COLORS.primary} />
            <Text style={styles.rankedText}>Classé</Text>
          </View>
        )}
        {challenge.bet_enabled && challenge.bet_amount ? (
          <View style={[styles.footerPill, styles.betPill]}>
            <FontAwesome5 name="coins" size={9} color="#F59E0B" />
            <Text style={styles.betText}>{challenge.bet_amount}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14, borderWidth: 1, borderRadius: 20, marginBottom: 12,
    backgroundColor: COLORS.surface,
    shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  headerText: { flex: 1, minWidth: 0, gap: 3 },
  challengeTitle: { color: COLORS.text, fontWeight: "800", fontSize: 15, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorName: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  dot: { color: COLORS.textMuted, fontSize: 10 },
  timeText: { color: COLORS.textMuted, fontSize: 11 },
  aiBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1, flexShrink: 0,
  },
  aiLabel: { fontSize: 10, fontWeight: "700" },
  description: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  domainBand: {
    padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
  },
  domainLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  domainTagline: { color: COLORS.textMuted, fontSize: 11, flex: 1, textAlign: "right" },
  footer: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  footerPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  footerSport: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  footerTarget: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  rankedPill: { backgroundColor: "rgba(212,175,55,0.1)", borderColor: "rgba(212,175,55,0.3)" },
  rankedText: { color: COLORS.primary, fontSize: 10, fontWeight: "700" },
  betPill: { backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" },
  betText: { color: "#F59E0B", fontSize: 10, fontWeight: "700" },
});
