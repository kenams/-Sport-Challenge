import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { COLORS, TYPO } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "md" | "sm";
};

export default function AppButton({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
  size = "md",
}: Props) {
  const isGhost = variant === "ghost";
  const baseStyle = isGhost ? styles.ghost : styles.primary;
  const sizeStyle = size === "sm" ? styles.small : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
      style={[
        styles.button,
        baseStyle,
        sizeStyle,
        disabled ? { opacity: 0.6 } : null,
        Platform.OS === "web" ? { cursor: "pointer" } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? COLORS.primary : "#0B0B0B"} />
      ) : (
        <Text
          style={[
            styles.label,
            size === "sm" ? styles.labelSmall : null,
            { color: isGhost ? COLORS.primary : "#0B0B0B" },
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
    borderRadius: 14,
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  ghost: {
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.5)",
    backgroundColor: "rgba(212,175,55,0.08)",
  },
  label: {
    ...TYPO.button,
  },
  labelSmall: {
    fontSize: 13,
  },
});
