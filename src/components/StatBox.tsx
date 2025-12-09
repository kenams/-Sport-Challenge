// src/components/StatBox.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../theme";

interface StatBoxProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}

export default function StatBox({
  label,
  value,
  icon,
  color = COLORS.primary,
  size = "md",
}: StatBoxProps) {
  const fontSize = size === "sm" ? 24 : size === "lg" ? 40 : 32;
  const padding = size === "sm" ? 12 : size === "lg" ? 20 : 16;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: `${color}20`, borderColor: `${color}40`, padding },
      ]}
    >
      {icon && <Text style={{ fontSize: 28, marginBottom: 8 }}>{icon}</Text>}
      <Text style={[styles.value, { fontSize, color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  value: {
    fontWeight: "700",
    color: COLORS.text,
  },
  label: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 8,
    textAlign: "center",
  },
});
