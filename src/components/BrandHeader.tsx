import React from "react";
import { Image, Text, View } from "react-native";

import { COLORS } from "../theme";

const logoSource = require("../../assets/immortal-k-logo.png");

export default function BrandHeader() {
  return (
    <View
      style={{
        marginBottom: 24,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Image
        source={logoSource}
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(250,205,21,0.4)",
        }}
        resizeMode="contain"
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={{
            color: COLORS.text,
            fontSize: 20,
            fontWeight: "900",
            letterSpacing: 1,
          }}
        >
          IMMORTAL-K
        </Text>
        <Text
          style={{
            color: COLORS.textMuted,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          Coach & Motivation
        </Text>
      </View>
    </View>
  );
}
