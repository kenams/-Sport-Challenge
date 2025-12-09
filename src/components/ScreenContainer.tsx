// src/components/ScreenContainer.tsx
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { COLORS } from "../theme";
import { SCREEN_PADDING } from "../utils/layout";
import BrandHeader from "./BrandHeader";

type Props = {
  children: React.ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
  showHeader?: boolean;
};

export default function ScreenContainer({
  children,
  backgroundColor,
  style,
  showHeader = true,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={[
        styles.container,
        {
          paddingTop: (insets.top || 0) + SCREEN_PADDING.vertical,
          paddingBottom: (insets.bottom || 0) + SCREEN_PADDING.vertical,
          paddingHorizontal: SCREEN_PADDING.horizontal,
          backgroundColor: backgroundColor || COLORS.background,
        },
        style,
      ]}
    >
      <View style={styles.backdrop} pointerEvents="none">
        <View style={[styles.blob, styles.blobPrimary]} />
        <View style={[styles.blob, styles.blobAccent]} />
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
