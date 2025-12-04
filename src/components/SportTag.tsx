import React from "react";
import { View, Text } from "react-native";
import { getSportPalette } from "../theme";

type Props = {
  sport: string;
};

function getSportLabelAndIcon(sport: string): { label: string; icon: string } {
  const s = (sport || "").toLowerCase();

  if (s.includes("push")) return { label: "Pushups", icon: "💪" };
  if (s.includes("basket")) return { label: "Basket", icon: "🏀" };
  if (s.includes("run") || s.includes("course"))
    return { label: "Course", icon: "🏃" };
  if (s.includes("swim") || s.includes("nage") || s.includes("piscine"))
    return { label: "Aqua", icon: "🌊" };
  if (s.includes("velo") || s.includes("bike"))
    return { label: "Vélo", icon: "🚴" };
  if (s.includes("corde")) return { label: "Corde", icon: "🪢" };
  if (s.includes("muscu")) return { label: "Muscu", icon: "🏋️" };

  return { label: sport || "Sport", icon: "⚡" };
}

export default function SportTag({ sport }: Props) {
  const palette = getSportPalette(sport);
  const { label, icon } = getSportLabelAndIcon(sport);

  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: palette.background,
        borderWidth: 1,
        borderColor: palette.accent,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: palette.accent,
          fontWeight: "700",
          letterSpacing: 0.5,
        }}
      >
        {icon} {label}
      </Text>
    </View>
  );
}
