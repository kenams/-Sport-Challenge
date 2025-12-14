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
}

export default function ChallengeCard({ challenge, onPress, profile }: Props) {
  const palette = getSportPalette(challenge?.sport || "");
  const domain = getSportDomain(challenge?.sport || "");
  const domainPalette = getSportPalette(domain.paletteKey);
  const displayName =
    profile?.pseudo ||
    challenge.pseudo ||
    `Joueur ${challenge.user_id.slice(0, 4)}...${challenge.user_id.slice(-4)}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        padding: 16,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 12,
        borderColor: palette.border || COLORS.border,
        backgroundColor: palette.card || COLORS.card,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
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
          borderColor: domainPalette.border,
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
          color: palette.accent || COLORS.primary,
          fontWeight: "600",
        }}
      >
        Sport : {challenge?.sport || "-"}  |  Objectif : {challenge?.target_value}{" "}
        {challenge?.unit}
      </Text>
    </TouchableOpacity>
  );
}
