import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme";
import { updateMyProfile } from "../../services/api";
import AccountField from "./AccountField";
import ActionButton from "./ActionButton";
import TerritoryForm from "./TerritoryForm";
import { cleanText, normalizeTerritory, validatePseudo, validateTerritory, type TerritoryInput } from "../../screens/helpers/validation";

type Props = {
  initialPseudo?: string | null;
  initialTerritory?: Partial<TerritoryInput>;
  submitLabel: string;
  intro?: string;
  onSaved: () => void;
  onCancel?: () => void;
};

/** Pseudo + territoire déclaré. Sert à compléter un profil neuf et à modifier un profil existant (même formulaire). */
export default function ProfileSetupForm({ initialPseudo, initialTerritory, submitLabel, intro, onSaved, onCancel }: Props) {
  const [pseudo, setPseudo] = useState(initialPseudo ?? "");
  const [territory, setTerritory] = useState<TerritoryInput>({
    country: initialTerritory?.country ?? "",
    region: initialTerritory?.region ?? "",
    city: initialTerritory?.city ?? "",
  });
  const [pseudoError, setPseudoError] = useState<string | null>(null);
  const [territoryError, setTerritoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const pErr = validatePseudo(pseudo);
    const tErr = validateTerritory(territory);
    setPseudoError(pErr);
    setTerritoryError(tErr);
    setError(null);
    if (pErr || tErr) return;
    setSaving(true);
    const t = normalizeTerritory(territory);
    const result = await updateMyProfile({ pseudo: cleanText(pseudo), city: t.city, region: t.region, country: t.country });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  return (
    <View style={styles.wrap}>
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      <AccountField
        label="Pseudo"
        value={pseudo}
        onChangeText={setPseudo}
        placeholder="Ton pseudo public"
        maxLength={24}
        autoCapitalize="none"
        autoCorrect={false}
        hint="2 à 24 caractères. Visible des autres joueurs."
        error={pseudoError}
      />
      <TerritoryForm value={territory} onChange={setTerritory} error={territoryError} />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <ActionButton label={submitLabel} onPress={submit} loading={saving} />
      {onCancel ? <ActionButton label="Annuler" variant="link" onPress={onCancel} disabled={saving} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  intro: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  error: { color: "#F87171", fontSize: 14, lineHeight: 20 },
});
