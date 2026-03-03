import React from "react";
import { View, Text } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { getSportPalette } from "../theme";

type Props = {
  sport: string;
};

type SportMeta = {
  label: string;
  icon: string;
};

function getSportMeta(sport: string): SportMeta {
  const s = (sport || "").toLowerCase();

  if (s.includes("push")) return { label: "Pushups", icon: "dumbbell" };
  if (s.includes("basket")) return { label: "Basket", icon: "basketball-ball" };
  if (s.includes("run") || s.includes("course")) return { label: "Course", icon: "running" };
  if (s.includes("swim") || s.includes("nage") || s.includes("piscine")) {
    return { label: "Aqua", icon: "swimmer" };
  }
  if (s.includes("velo") || s.includes("bike")) return { label: "Velo", icon: "bicycle" };
  if (s.includes("corde")) return { label: "Corde", icon: "dumbbell" };
  if (s.includes("muscu")) return { label: "Muscu", icon: "dumbbell" };

  return { label: sport || "Sport", icon: "medal" };
}

export default function SportTag({ sport }: Props) {
  const palette = getSportPalette(sport);
  const meta = getSportMeta(sport);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: "rgba(0,0,0,0.4)",
        borderWidth: 1,
        borderColor: palette.accent,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.4)",
          borderWidth: 1,
          borderColor: palette.accent,
        }}
      >
        <FontAwesome5
          name={meta.icon as any}
          size={11}
          color={palette.accent}
        />
      </View>
      <Text
        style={{
          fontSize: 11,
          color: palette.accent,
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {meta.label}
      </Text>
    </View>
  );
}