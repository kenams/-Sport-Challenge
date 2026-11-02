import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../theme";
import { setMyAvatar, updateMyPrivateProfile, updateMyProfile } from "../../services/api";
import { AVATAR_OPTIONS, avatarUrl, type AvatarId } from "../../domain/avatars";
import type { MyPrivateProfile } from "../../domain/types";
import AccountField from "./AccountField";
import ActionButton from "./ActionButton";
import TerritoryForm from "./TerritoryForm";
import { cleanText, formatBirthDateInput, normalizeTerritory, parseBirthDateInput, validatePrivateSportProfile, validatePseudo, validateTerritory, type TerritoryInput } from "../../screens/helpers/validation";

type Props = {
  initialPseudo?: string | null;
  initialTerritory?: Partial<TerritoryInput>;
  initialPrivateProfile?: MyPrivateProfile | null;
  initialAvatarUrl?: string | null;
  submitLabel: string;
  intro?: string;
  onSaved: () => void;
  onCancel?: () => void;
};

/** Pseudo + territoire déclaré. Sert à compléter un profil neuf et à modifier un profil existant (même formulaire). */
export default function ProfileSetupForm({ initialPseudo, initialTerritory, initialPrivateProfile, initialAvatarUrl, submitLabel, intro, onSaved, onCancel }: Props) {
  const [pseudo, setPseudo] = useState(initialPseudo ?? "");
  const [avatarId, setAvatarId] = useState<AvatarId>(() => AVATAR_OPTIONS.find((item) => initialAvatarUrl?.endsWith("/" + item.id + ".jpg"))?.id ?? "locks");
  const [territory, setTerritory] = useState<TerritoryInput>({
    country: initialTerritory?.country ?? "",
    region: initialTerritory?.region ?? "",
    city: initialTerritory?.city ?? "",
  });
  const [pseudoError, setPseudoError] = useState<string | null>(null);
  const [territoryError, setTerritoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [privateError, setPrivateError] = useState<string | null>(null);
  const [privateOpen, setPrivateOpen] = useState(!!initialPrivateProfile && Object.values(initialPrivateProfile).some((value) => value !== null));
  const [birthDate, setBirthDate] = useState(formatBirthDateInput(initialPrivateProfile?.birth_date));
  const [gender, setGender] = useState(initialPrivateProfile?.gender ?? "");
  const [heightCm, setHeightCm] = useState(initialPrivateProfile?.height_cm ? String(initialPrivateProfile.height_cm) : "");
  const [weightKg, setWeightKg] = useState(initialPrivateProfile?.weight_kg ? String(initialPrivateProfile.weight_kg) : "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const pErr = validatePseudo(pseudo);
    const tErr = validateTerritory(territory);
    const dataError = validatePrivateSportProfile({ birthDate, gender, heightCm, weightKg });
    setPseudoError(pErr);
    setTerritoryError(tErr);
    setError(null);
    setPrivateError(dataError);
    if (pErr || tErr || dataError) return;
    setSaving(true);
    const t = normalizeTerritory(territory);
    const result = await updateMyProfile({ pseudo: cleanText(pseudo), city: t.city, region: t.region, country: t.country });
    if (result.error) {
      setSaving(false);
      setError(result.error);
      return;
    }
    const hasPrivateData = !!birthDate.trim() || !!gender || !!heightCm.trim() || !!weightKg.trim();
    if (hasPrivateData || initialPrivateProfile) {
      const privateResult = await updateMyPrivateProfile({
        birth_date: parseBirthDateInput(birthDate),
        gender: (gender || null) as MyPrivateProfile["gender"],
        height_cm: heightCm.trim() ? Number(heightCm) : null,
        weight_kg: weightKg.trim() ? Number(weightKg.replace(",", ".")) : null,
      });
      if (privateResult.error) {
        setSaving(false);
        setError(privateResult.error);
        return;
      }
    }
    const avatarResult = await setMyAvatar(avatarId);
    if (avatarResult.error) {
      setSaving(false);
      setError(avatarResult.error);
      return;
    }
    setSaving(false);
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
      <View style={styles.avatarSection}>
        <Text style={styles.inputLabel}>Ton avatar public</Text>
        <Text style={styles.privateHint}>Choisis un portrait illustré. Tu pourras le changer quand tu veux.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarList}>
          {AVATAR_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => setAvatarId(option.id)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: avatarId === option.id }}
              style={styles.avatarOption}
            >
              <Image source={{ uri: avatarUrl(option.id) }} style={[styles.avatarImage, avatarId === option.id ? styles.avatarImageSelected : null]} />
              <Text style={[styles.avatarLabel, avatarId === option.id ? styles.avatarLabelSelected : null]} numberOfLines={1}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.privateSection}>
        <TouchableOpacity
          onPress={() => setPrivateOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: privateOpen }}
          style={styles.privateToggle}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.privateTitle}>Données sportives privées</Text>
            <Text style={styles.privateHint}>Âge, sexe, taille et poids. Visibles par toi uniquement.</Text>
          </View>
          <Text style={styles.privateAction}>{privateOpen ? "Masquer" : "Compléter"}</Text>
        </TouchableOpacity>
        {privateOpen ? (
          <View style={styles.privateFields}>
            <Text style={styles.privateNote}>Ces informations ne changent ni ton niveau ni tes scores. Tu peux les laisser vides.</Text>
            <Text style={styles.inputLabel}>Date de naissance</Text>
            <TextInput
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="JJ/MM/AAAA"
              accessibilityLabel="Date de naissance"
              maxLength={10}
              style={styles.input}
            />
            <Text style={styles.inputLabel}>Sexe (facultatif)</Text>
            <View style={styles.genderChoices}>
              {([
                ["male", "Homme"],
                ["female", "Femme"],
                ["other", "Autre"],
                ["prefer_not_to_say", "Je préfère ne pas préciser"],
              ] as const).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setGender(gender === value ? "" : value)}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: gender === value }}
                  style={[styles.genderChoice, gender === value ? styles.genderChoiceOn : null]}
                >
                  <Text style={[styles.genderText, gender === value ? styles.genderTextOn : null]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.measureRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Taille (cm)</Text>
                <TextInput
                  value={heightCm}
                  onChangeText={(value) => setHeightCm(value.replace(/[^0-9]/g, "").slice(0, 3))}
                  placeholder="198"
                  keyboardType="number-pad"
                  accessibilityLabel="Taille en centimètres"
                  maxLength={3}
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Poids (kg)</Text>
                <TextInput
                  value={weightKg}
                  onChangeText={(value) => setWeightKg(value.replace(/[^0-9.,]/g, "").slice(0, 6))}
                  placeholder="115"
                  keyboardType="decimal-pad"
                  accessibilityLabel="Poids en kilogrammes"
                  maxLength={6}
                  style={styles.input}
                />
              </View>
            </View>
            {privateError ? <Text style={styles.error} accessibilityRole="alert">{privateError}</Text> : null}
          </View>
        ) : null}
      </View>
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
  avatarSection: { gap: 6 },
  avatarList: { gap: 10, paddingVertical: 6, paddingRight: 8 },
  avatarOption: { width: 76, alignItems: "center", gap: 5 },
  avatarImage: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: COLORS.border },
  avatarImageSelected: { borderColor: COLORS.primary },
  avatarLabel: { color: COLORS.textMuted, fontSize: 10, textAlign: "center", width: 76 },
  avatarLabelSelected: { color: COLORS.primary, fontWeight: "800" },
  privateSection: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 12 },
  privateToggle: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  privateTitle: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  privateHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  privateAction: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  privateFields: { gap: 10 },
  privateNote: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  inputLabel: { color: COLORS.text, fontSize: 12, fontWeight: "700", marginBottom: 5 },
  input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, color: COLORS.text, paddingHorizontal: 12, fontSize: 15 },
  genderChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderChoice: { minHeight: 40, justifyContent: "center", paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  genderChoiceOn: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.14)" },
  genderText: { color: COLORS.textMuted, fontSize: 13 },
  genderTextOn: { color: COLORS.primary, fontWeight: "800" },
  measureRow: { flexDirection: "row", gap: 10 },
});
