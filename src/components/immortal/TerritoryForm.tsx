import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../theme";
import { COUNTRIES } from "../../domain/formats";
import AccountField from "./AccountField";
import type { TerritoryInput } from "../../screens/helpers/validation";

type Props = {
  value: TerritoryInput;
  onChange: (next: TerritoryInput) => void;
  error?: string | null;
};

/** Territoire DÉCLARÉ (non vérifié) : pays via liste, région et ville en texte. Champs facultatifs mais encouragés. */
export default function TerritoryForm({ value, onChange, error }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Ton territoire</Text>
        <Text style={styles.note}>
          Déclaré, non vérifié. Il sert à te placer dans les records de ta ville, ta région et ton pays. Facultatif, mais sans lui tu n'apparais que dans le classement mondial.
        </Text>
      </View>
      <Text style={styles.label}>Pays</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {COUNTRIES.map((country) => {
          const selected = value.country === country;
          return (
            <TouchableOpacity
              key={country}
              onPress={() => onChange({ ...value, country: selected ? "" : country })}
              accessibilityRole="radio"
              accessibilityLabel={country}
              accessibilityState={{ selected }}
              style={[styles.chip, selected ? styles.chipOn : null, Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextOn : null]}>{country}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <AccountField
        label="Région"
        value={value.region}
        onChangeText={(region) => onChange({ ...value, region })}
        placeholder="Ex. Occitanie"
        maxLength={60}
        autoCapitalize="words"
      />
      <AccountField
        label="Ville"
        value={value.city}
        onChangeText={(city) => onChange({ ...value, city })}
        placeholder="Ex. Toulouse"
        maxLength={60}
        autoCapitalize="words"
        error={error}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  header: { gap: 4 },
  title: { color: COLORS.primary, fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  note: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", justifyContent: "center", backgroundColor: COLORS.surface },
  chipOn: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.16)" },
  chipText: { color: COLORS.textMuted, fontSize: 14 },
  chipTextOn: { color: COLORS.primary, fontWeight: "800" },
});
