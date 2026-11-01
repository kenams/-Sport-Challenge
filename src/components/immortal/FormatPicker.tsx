import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme";
import type { ChallengeFormat, FormatKey } from "../../domain/types";
import { durationLabel } from "../../screens/helpers/attempts";

type Props = {
  formats: ChallengeFormat[];
  value: FormatKey | null;
  onChange: (key: FormatKey) => void;
  disabled?: boolean;
};

/** Choix du format d'épreuve : libellé + durée, un seul sélectionnable à la fois. */
export default function FormatPicker({ formats, value, onChange, disabled }: Props) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Format de l'épreuve" style={styles.group}>
      {formats.map((format) => {
        const selected = format.key === value;
        return (
          <Pressable
            key={format.key}
            onPress={() => onChange(format.key)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!disabled }}
            accessibilityLabel={`${format.label_fr}, ${durationLabel(format)}`}
            style={({ pressed }) => [
              styles.option,
              selected ? styles.optionSelected : null,
              disabled && !selected ? { opacity: 0.5 } : null,
              pressed ? { opacity: 0.85 } : null,
              Platform.OS === "web" ? ({ cursor: disabled ? "default" : "pointer" } as object) : null,
            ]}
          >
            <View style={[styles.radio, selected ? styles.radioSelected : null]}>{selected ? <View style={styles.radioDot} /> : null}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.label}>{format.label_fr}</Text>
              <Text style={styles.meta}>{durationLabel(format)}</Text>
              <Text style={styles.description}>{format.description_fr}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  option: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  optionSelected: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.10)" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.textMuted, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  label: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  meta: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  description: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
});
