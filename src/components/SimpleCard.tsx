// src/components/SimpleCard.tsx
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { COLORS } from "../theme";

interface SimpleCardProps {
  children: React.ReactNode;
  color?: string;
  variant?: "default" | "accent" | "success" | "danger" | "info";
  style?: ViewStyle;
}

export default function SimpleCard({
  children,
  color,
  variant = "default",
  style,
}: SimpleCardProps) {
  let bgColor = COLORS.card;
  let borderColor = COLORS.border;

  if (color) {
    bgColor = `${color}15`;
    borderColor = `${color}30`;
  } else if (variant === "accent") {
    bgColor = `${COLORS.accent}15`;
    borderColor = `${COLORS.accent}30`;
  } else if (variant === "success") {
    bgColor = `${COLORS.success}15`;
    borderColor = `${COLORS.success}30`;
  } else if (variant === "danger") {
    bgColor = `${COLORS.danger}15`;
    borderColor = `${COLORS.danger}30`;
  } else if (variant === "info") {
    bgColor = `${COLORS.blue}15`;
    borderColor = `${COLORS.blue}30`;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
});
