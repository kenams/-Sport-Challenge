import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { COLORS, getSportPalette } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "md" | "sm";
  color?: string; // background or accent color for the button
  textColor?: string; // label color override
  sport?: string; // optional sport key to auto-derive color
};

export default function AppButton({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
  size = "md",
  color,
  textColor,
  sport,
}: Props) {
  const isGhost = variant === "ghost";
  const baseStyle = isGhost ? styles.ghost : styles.primary;
  const sizeStyle = size === "sm" ? styles.small : null;
  // derive colors: priority textColor > color > sport palette > defaults
  let derivedColor = color;
  let derivedTextColor = textColor;
  if (!derivedColor && sport) {
    const p = getSportPalette(sport);
    derivedColor = p.accent;
    derivedTextColor = derivedTextColor || p.text;
  }
  // Ensure a visible default color so navigation buttons remain themed
  if (!derivedColor) {
    derivedColor = COLORS.primary;
  }
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    try {
      // eslint-disable-next-line no-console
      console.log("AppButton debug:", { label, sport, derivedColor, derivedTextColor });
    } catch (e) {}
  }
  const overrideStyle: StyleProp<ViewStyle> = isGhost
    ? { borderColor: derivedColor ? `${derivedColor}44` : undefined }
    : { backgroundColor: derivedColor || undefined };
  const overrideTextColor = derivedTextColor || (isGhost ? derivedColor || COLORS.primary : "#050505");

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
      style={[
        styles.button,
        baseStyle,
        sizeStyle,
        overrideStyle,
        disabled ? { opacity: 0.6 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={overrideTextColor} />
      ) : (
        <Text
          style={[
            styles.label,
            size === "sm" ? styles.labelSmall : null,
            { color: overrideTextColor },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  small: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  ghost: {
    borderWidth: 1,
    borderColor: COLORS.primary + "44",
    backgroundColor: "transparent",
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 13,
  },
});
