// src/components/InfoCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../theme";

interface InfoCardProps {
  title: string;
  description: string;
  icon?: string;
  color?: string;
  backgroundColor?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}

export default function InfoCard({
  title,
  description,
  icon = "ℹ️",
  color = COLORS.blue,
  backgroundColor = "rgba(14, 165, 233, 0.1)",
  onPress,
  children,
}: InfoCardProps) {
  return (
    <View style={[styles.container, { backgroundColor, borderLeftColor: color }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.title, { color }]}>{title}</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  description: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});
