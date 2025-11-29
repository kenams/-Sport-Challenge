// src/components/RatingStars.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export default function RatingStars({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onChange && onChange(i + 1)}
          disabled={!onChange}
        >
          <Text style={{ fontSize: 28, marginRight: 6 }}>
            {value > i ? "⭐" : "☆"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
