// src/components/ScreenContainer.tsx
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { COLORS } from "../theme";
import { useSportTheme } from "../context/SportThemeContext";
import { SCREEN_PADDING } from "../utils/layout";
import BrandHeader from "./BrandHeader";

type Props = {
  children: React.ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
  showHeader?: boolean;
  sport?: string | null;
};

export default function ScreenContainer({
  children,
  backgroundColor,
  style,
  showHeader = true,
  sport,
}: Props) {
  const insets = useSafeAreaInsets();
  const { palette } = useSportTheme(sport);
  const resolvedBackground = backgroundColor || palette.background || COLORS.background;
  const accentColor = palette.accent || COLORS.accent;

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={[
        styles.container,
        {
          paddingTop: (insets.top || 0) + SCREEN_PADDING.vertical,
          paddingBottom: (insets.bottom || 0) + SCREEN_PADDING.vertical,
          paddingHorizontal: SCREEN_PADDING.horizontal,
          backgroundColor: resolvedBackground,
        },
        style,
      ]}
    >
      <View style={styles.backdrop} pointerEvents="none">
        <View
          style={[
            styles.blob,
            styles.blobPrimary,
            { backgroundColor: accentColor + "22" },
          ]}
        />
        <View
          style={[
            styles.blob,
            styles.blobAccent,
            { backgroundColor: COLORS.neonPurple + "22" },
          ]}
        />
      </View>
      <View style={{ flex: 1, zIndex: 1 }}>
        {showHeader && <BrandHeader />}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: COLORS.background,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },
  blob: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 200,
    opacity: 0.3,
    transform: [{ rotate: "25deg" }],
  },
  blobPrimary: {
    top: -40,
    right: -60,
    backgroundColor: "rgba(250,204,21,0.22)",
  },
  blobAccent: {
    bottom: -60,
    left: -60,
    backgroundColor: "rgba(255,107,0,0.18)",
  },
});
