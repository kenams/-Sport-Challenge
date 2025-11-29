// src/components/ChallengeCard.tsx
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { Challenge } from "../types";
import { COLORS, getSportPalette } from "../theme";

interface Props {
  challenge: Challenge;
  onPress?: () => void;
}

export default function ChallengeCard({ challenge, onPress }: Props) {
  const palette = getSportPalette(challenge.sport);

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
        numberOfLines={2}
        style={{
          marginTop: 6,
          color: palette.text || COLORS.text,
          opacity: 0.85,
        }}
      >
        {challenge.description}
      </Text>

      <Text
        style={{
          marginTop: 10,
          color: palette.accent || COLORS.primary,
          fontWeight: "600",
        }}
      >
        Sport : {challenge.sport}  |  Objectif : {challenge.target_value} {challenge.unit}
      </Text>
    </TouchableOpacity>
  );
}
