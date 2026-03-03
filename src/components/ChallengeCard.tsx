// src/components/ChallengeCard.tsx
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
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

export default function ChallengeCard({
  challenge,
  onPress,
  profile,
  variant = "challenge",
}: Props) {
  const palette = getSportPalette(challenge.sport);
  const domain = getSportDomain(challenge.sport);
  const domainPalette = getSportPalette(domain.paletteKey);
  const colorKey = String(challenge.id ?? challenge.title ?? challenge.user_id);
  let hash = 0;
  for (let i = 0; i < colorKey.length; i += 1) {
    hash = (hash * 31 + colorKey.charCodeAt(i)) >>> 0;
  }
  const accentPalette = [
    "#F59E0B",
    "#22D3EE",
    "#F97316",
    "#A3E635",
    "#FB7185",
    "#60A5FA",
    "#C084FC",
    "#FACC15",
    "#34D399",
    "#F472B6",
  ];
  const accent = accentPalette[hash % accentPalette.length];
  const displayName =
    profile?.pseudo ||
    challenge.pseudo ||
    `Joueur ${challenge.user_id.slice(0, 4)}...${challenge.user_id.slice(-4)}`;
  const aiLabel =
    challenge.ai_status === "rejected"
      ? "Rejeté"
      : challenge.ai_needs_review
      ? "À vérifier"
      : challenge.ai_status === "validated" || challenge.ai_status === "ok"
      ? "Validé IA"
      : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        padding: 16,
        borderWidth: 1,
        borderRadius: 18,
        marginBottom: 12,
        borderColor: accent,
        backgroundColor: COLORS.surface,
        shadowColor: accent,
        shadowOpacity: 0.28,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <UserAvatar
          uri={profile?.avatar_url || challenge.avatar_url || undefined}
          label={displayName}
          size={48}
        />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text
            style={{
              fontWeight: "800",
              fontSize: 18,
              color: palette.text || COLORS.text,
            }}
          >
            {challenge.title}
          </Text>
          <Text
            style={{
              marginTop: 4,
              color: COLORS.textMuted,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {displayName}
          </Text>
        </View>
        {aiLabel && (
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor:
                aiLabel === "Validé IA"
                  ? "rgba(110,231,183,0.6)"
                  : "rgba(252,165,165,0.6)",
              backgroundColor: "rgba(10,10,14,0.8)",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.text }}>{aiLabel}</Text>
          </View>
        )}
      </View>

      <Text
        numberOfLines={2}
        style={{
          marginTop: 6,
          color: palette.text || COLORS.text,
          opacity: 0.85,
        }}
      >
        {challenge.description}
      </Text>

      <View
        style={{
          marginTop: 12,
          padding: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: accent,
          backgroundColor: domainPalette.background,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "800",
            color: domainPalette.accent,
          }}
        >
          {domain.label}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: domainPalette.text,
            marginTop: 2,
          }}
        >
          {domain.tagline}
        </Text>
      </View>

      <Text
        style={{
          marginTop: 10,
          color: accent,
          fontWeight: "600",
        }}
      >
        Sport : {challenge.sport} | {variant === "performance" ? "Performance" : "Objectif"} :
        {" "}
        {challenge.target_value} {challenge.unit}
      </Text>
    </TouchableOpacity>
  );
}
