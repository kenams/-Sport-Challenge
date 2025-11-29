// src/components/ScreenContainer.tsx
import React from "react";
import { StyleSheet, ViewStyle } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { COLORS } from "../theme";

type Props = {
  children: React.ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
};

export default function ScreenContainer({
  children,
  backgroundColor,
  style,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={[
        styles.container,
        {
          paddingTop: (insets.top || 0) + 12,
          paddingBottom: (insets.bottom || 0) + 12,
          backgroundColor: backgroundColor || COLORS.background,
        },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
  },
});