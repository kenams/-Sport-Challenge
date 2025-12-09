// src/components/SectionHeader.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../theme";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
}

export default function SectionHeader({
  title,
  subtitle,
  icon,
  color = COLORS.primary,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.colorBar, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {icon && <Text style={styles.icon}>{icon}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  colorBar: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  icon: {
    fontSize: 24,
    marginLeft: 8,
  },
});
