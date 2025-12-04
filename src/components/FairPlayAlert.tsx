// src/components/FairPlayAlert.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { COLORS } from "../theme";

type Props = {
  score: number;
  threshold: number;
  message?: string;
  onCtaPress?: () => void;
  ctaLabel?: string;
};

export default function FairPlayAlert({
  score,
  threshold,
  message,
  onCtaPress,
  ctaLabel = "Améliorer mon fair-play",
}: Props) {
  if (score >= threshold) {
    return null;
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: COLORS.danger,
        borderRadius: 18,
        padding: 16,
        marginBottom: 18,
        backgroundColor: "rgba(239,68,68,0.15)",
      }}
    >
      <Text
        style={{
          color: COLORS.danger,
          fontSize: 14,
          fontWeight: "700",
          marginBottom: 6,
        }}
      >
        Accès Arena verrouillé
      </Text>
      <Text
        style={{
          color: COLORS.text,
          fontSize: 13,
          marginBottom: 8,
        }}
      >
        {message ||
          `Ton score de fair-play (${score}) est en dessous du seuil requis (${threshold}). Les modes Arena sont désactivés jusqu'à ce que tu regagnes de la crédibilité.`}
      </Text>
      <TouchableOpacity
        onPress={onCtaPress}
        style={{
          alignSelf: "flex-start",
          paddingVertical: 6,
          paddingHorizontal: 12,
          backgroundColor: COLORS.danger,
          borderRadius: 20,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {ctaLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
