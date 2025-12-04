import React from "react";
import { View, Text } from "react-native";
import { COLORS } from "../theme";

type Props = {
  heat: number;
};

const getHeatColor = (value: number) => {
  if (value >= 20) return "#ef4444";
  if (value >= 10) return "#f97316";
  if (value >= 5) return "#facc15";
  return COLORS.textMuted;
};

export default function HeatBadge({ heat }: Props) {
  const color = getHeatColor(heat);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: color,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginTop: 6,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color,
          fontWeight: "800",
          marginRight: 4,
        }}
      >
        🔥
      </Text>
      <Text
        style={{
          color,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        Heat {heat}
      </Text>
    </View>
  );
}
