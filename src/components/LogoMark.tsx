// src/components/LogoMark.tsx
import React from "react";
import { StyleSheet, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  size?: number;
  style?: ViewStyle;
  label?: string;
};

export default function LogoMark({ size = 48, style, label = "K" }: Props) {
  return (
    <LinearGradient
      colors={["#F5E6A1", "#D4AF37", "#8C6A1B"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.logo,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
        },
        style,
      ]}
    >
      <Text style={[styles.logoText, { fontSize: Math.max(size * 0.33, 14) }]}>
        {label}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.65)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  logoText: {
    color: "#1B1405",
    fontWeight: "900",
    letterSpacing: 1,
  },
});