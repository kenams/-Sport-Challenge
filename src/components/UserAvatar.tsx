import React from "react";
import { Image, Text, View } from "react-native";

import { COLORS } from "../theme";

type Props = {
  uri?: string | null;
  label: string;
  size?: number;
};

export default function UserAvatar({ uri, label, size = 48 }: Props) {
  const initials = React.useMemo(() => {
    const parts = label
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase());
    const combo = parts.slice(0, 2).join("");
    if (combo.length > 0) return combo;
    return label.slice(0, 2).toUpperCase();
  }, [label]);

  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          dimension,
          {
            borderWidth: 1,
            borderColor: "rgba(250,205,21,0.5)",
          },
        ]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        dimension,
        {
          backgroundColor: "#111827",
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
          borderColor: COLORS.border,
        },
      ]}
    >
      <Text
        style={{
          color: COLORS.text,
          fontSize: size / 2.5,
          fontWeight: "800",
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
