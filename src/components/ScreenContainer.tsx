// src/components/ScreenContainer.tsx
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../theme";
import BrandHeader from "./BrandHeader";
import BottomDock from "./BottomDock";

type Props = {
  children: React.ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
  showHeader?: boolean;
  showFooter?: boolean;
};

export default function ScreenContainer({
  children,
  backgroundColor,
  style,
  showHeader = true,
  showFooter = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { width } = useWindowDimensions();
  const isNarrow = width < 720;
  const isTablet = isWeb && width >= 720 && width < 1100;
  const horizontalPadding = isWeb
     ? isNarrow
       ? 14
      : 24
    : isNarrow
     ? 14
    : 16;
  // Footer always shown when showFooter is true (web + mobile).
  const shouldShowFooter = showFooter;
  const footerPadding = shouldShowFooter ? 96 : 12;
  const shouldShowCredit = !showHeader;

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={[
        styles.container,
        {
          paddingTop: (insets.top || 0) + 12,
          paddingBottom: (insets.bottom || 0) + footerPadding,
          paddingHorizontal: horizontalPadding,
          backgroundColor: backgroundColor || COLORS.background,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={["#050507", "#0E0E12", "#0A0A0E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      <View style={styles.backdrop} pointerEvents="none">
        <View
          style={[
            styles.blob,
            isNarrow ? styles.blobSmall : null,
            styles.blobPrimary,
          ]}
        />
        <View
          style={[
            styles.blob,
            isNarrow ? styles.blobSmall : null,
            styles.blobAccent,
          ]}
        />
      </View>
      <View
        style={[
          styles.content,
          isWeb && !isNarrow ? styles.contentWeb : null,
          isTablet ? styles.contentTablet : null,
          shouldShowFooter ? styles.contentWithFooter : null,
        ]}
      >
        {showHeader && <BrandHeader />}
        {children}
      </View>
      {shouldShowFooter && <BottomDock />}
      {shouldShowCredit && (
        <View
          pointerEvents="none"
          style={[styles.credit, { bottom: (insets.bottom || 0) + 10 }]}
        >
          <Text style={styles.creditText}>Developed by Kah-Digital</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    zIndex: 1,
    width: "100%",
  },
  contentWeb: {
    maxWidth: 1320,
    alignSelf: "center",
  },
  contentTablet: {
    maxWidth: 980,
  },
  contentWithFooter: {
    paddingBottom: 8,
  },
  credit: {
    position: "absolute",
    right: 18,
    opacity: 0.7,
  },
  creditText: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.textMuted,
    textTransform: "uppercase",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },
  blob: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 260,
    opacity: 0.18,
    transform: [{ rotate: "20deg" }],
  },
  blobSmall: {
    width: 220,
    height: 220,
    borderRadius: 200,
  },
  blobPrimary: {
    top: -120,
    right: -140,
    backgroundColor: "rgba(212,175,55,0.22)",
  },
  blobAccent: {
    bottom: -140,
    left: -120,
    backgroundColor: "rgba(185,28,28,0.22)",
  },
});