import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { COLORS } from "../../theme";

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
};

/** Champ de formulaire étiqueté (le libellé reste visible), avec aide et erreur annoncées. */
export default function AccountField({ label, hint, error, style, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#7C7D84"
        accessibilityLabel={label}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...input}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  inputError: { borderColor: "rgba(239,68,68,0.8)" },
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  error: { color: "#F87171", fontSize: 13, lineHeight: 18 },
});
