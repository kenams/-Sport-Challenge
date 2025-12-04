import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { COLORS } from "../theme";

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
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? COLORS.text : "#050505"} />
      ) : (
        <Text
          style={[
            styles.label,
            size === "sm" ? styles.labelSmall : null,
            { color: isGhost ? COLORS.text : "#050505" },
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
    borderColor: COLORS.border,
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
