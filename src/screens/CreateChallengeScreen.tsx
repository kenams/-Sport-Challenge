// src/screens/CreateChallengeScreen.tsx
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import { supabase } from "../supabase";

const SPORTS = [
  "running", "pushups", "traction", "squat", "fitness",
  "basket", "foot", "nage", "course", "yoga", "mma",
  "corde", "vélo", "natation", "autre",
];

const UNITS: Record<string, string[]> = {
  running: ["km", "m", "min"],
  pushups: ["reps"],
  traction: ["reps"],
  squat: ["reps"],
  fitness: ["reps", "min"],
  basket: ["tirs", "reps"],
  foot: ["plots", "buts"],
  nage: ["m", "km"],
  course: ["m", "km", "min"],
  yoga: ["postures", "min"],
  mma: ["combos", "reps"],
  corde: ["sauts"],
  vélo: ["km", "min"],
  natation: ["m", "km"],
  autre: ["reps", "sec", "min", "km", "m"],
};

export default function CreateChallengeScreen({ navigation }: any) {
  const [userId, setUserId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [ranked, setRanked] = useState(false);
  const [betEnabled, setBetEnabled] = useState(false);
  const [betAmount, setBetAmount] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !mounted) return;
      setUserId(uid);
      const { data: prof } = await supabase.from("profiles").select("pseudo").eq("user_id", uid).maybeSingle();
      if (mounted && prof) setPseudo((prof as any).pseudo ?? null);
    });
    return () => { mounted = false; };
  }, []);

  const selectSport = (s: string) => {
    setSport(s);
    const units = UNITS[s] || ["reps"];
    setUnit(units[0]);
  };

  const handleSubmit = async () => {
    if (!userId) return Alert.alert("Connexion requise", "Connecte-toi pour publier un défi.");
    if (!title.trim()) return Alert.alert("Champ manquant", "Renseigne un titre.");
    if (!description.trim()) return Alert.alert("Champ manquant", "Renseigne une description.");
    if (!sport) return Alert.alert("Sport manquant", "Sélectionne un sport.");
    const target = parseFloat(targetValue);
    if (isNaN(target) || target <= 0) return Alert.alert("Objectif invalide", "Renseigne un objectif numérique.");
    if (!unit.trim()) return Alert.alert("Unité manquante", "Choisis une unité.");

    setLoading(true);
    try {
      const payload: any = {
        user_id: userId,
        pseudo: pseudo || "Joueur",
        title: title.trim(),
        description: description.trim(),
        sport,
        target_value: target,
        unit: unit.trim(),
        ranked,
        bet_enabled: betEnabled,
        bet_amount: betEnabled ? (parseFloat(betAmount) || 0) : 0,
      };
      if (videoUrl.trim()) payload.video_url = videoUrl.trim();

      const { data: inserted, error } = await supabase
        .from("challenges")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("activities").insert({
        user_id: userId,
        pseudo: pseudo || "Joueur",
        type: "challenge_created",
        challenge_id: inserted.id,
        message: `Nouveau défi : ${title.trim()}`,
      });

      Alert.alert("Défi publié !", "Ton défi est maintenant visible dans l'arène.", [
        { text: "Voir le défi", onPress: () => navigation?.navigate("ChallengeDetail", { id: inserted.id }) },
        { text: "OK", onPress: () => navigation?.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de publier le défi.");
    } finally {
      setLoading(false);
    }
  };

  const availableUnits = sport ? (UNITS[sport] || ["reps"]) : [];

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.kicker}>CRÉATION</Text>
            <Text style={styles.heroTitle}>Créer un défi</Text>
            <Text style={styles.subtitle}>Lance un défi propre, motivant et certifiable.</Text>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>

            {/* Titre */}
            <View style={styles.field}>
              <Text style={styles.label}>Titre du défi *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Pompes explosives 50 reps"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                maxLength={80}
              />
              <Text style={styles.charCount}>{title.length}/80</Text>
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Règles, conditions, amplitude requise..."
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, styles.inputMulti]}
                multiline
                numberOfLines={3}
                maxLength={300}
              />
              <Text style={styles.charCount}>{description.length}/300</Text>
            </View>

            {/* Sport */}
            <View style={styles.field}>
              <Text style={styles.label}>Sport *</Text>
              <View style={styles.sportsGrid}>
                {SPORTS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sportChip, sport === s && styles.sportChipActive]}
                    onPress={() => selectSport(s)}
                  >
                    <Text style={[styles.sportChipText, sport === s && styles.sportChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Objectif + Unité */}
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Objectif *</Text>
                <TextInput
                  value={targetValue}
                  onChangeText={setTargetValue}
                  placeholder="50"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Unité *</Text>
                {availableUnits.length > 1 ? (
                  <View style={styles.unitRow}>
                    {availableUnits.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, unit === u && styles.unitChipActive]}
                        onPress={() => setUnit(u)}
                      >
                        <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="reps"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.input}
                  />
                )}
              </View>
            </View>

            {/* URL Vidéo démo */}
            <View style={styles.field}>
              <Text style={styles.label}>Vidéo démo (URL optionnelle)</Text>
              <TextInput
                value={videoUrl}
                onChangeText={setVideoUrl}
                placeholder="https://..."
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            {/* Toggles */}
            <View style={styles.toggleSection}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <FontAwesome5 name="trophy" size={13} color={COLORS.primary} />
                  <View>
                    <Text style={styles.toggleLabel}>Défi classé</Text>
                    <Text style={styles.toggleDesc}>Apparaît dans le classement général</Text>
                  </View>
                </View>
                <Switch
                  value={ranked}
                  onValueChange={setRanked}
                  trackColor={{ false: "rgba(148,163,184,0.2)", true: COLORS.primary + "66" }}
                  thumbColor={ranked ? COLORS.primary : "#9CA3AF"}
                />
              </View>

              <View style={styles.separator} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <FontAwesome5 name="coins" size={13} color="#F59E0B" />
                  <View>
                    <Text style={styles.toggleLabel}>Mise de coins</Text>
                    <Text style={styles.toggleDesc}>Les participants misent des coins</Text>
                  </View>
                </View>
                <Switch
                  value={betEnabled}
                  onValueChange={setBetEnabled}
                  trackColor={{ false: "rgba(148,163,184,0.2)", true: "#F59E0B66" }}
                  thumbColor={betEnabled ? "#F59E0B" : "#9CA3AF"}
                />
              </View>

              {betEnabled && (
                <View style={styles.field}>
                  <Text style={styles.label}>Montant de la mise (coins)</Text>
                  <TextInput
                    value={betAmount}
                    onChangeText={setBetAmount}
                    placeholder="100"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.input}
                    keyboardType="numeric"
                  />
                </View>
              )}
            </View>

            {/* Checklist qualité */}
            <View style={styles.qualityCard}>
              <Text style={styles.qualityTitle}>Checklist qualité</Text>
              {[
                ["Titre clair et descriptif", !!title.trim()],
                ["Description avec règles précises", description.length > 20],
                ["Sport sélectionné", !!sport],
                ["Objectif défini", !!targetValue && !isNaN(parseFloat(targetValue))],
              ].map(([label, ok]) => (
                <View key={String(label)} style={styles.checkRow}>
                  <FontAwesome5 name={ok ? "check-circle" : "circle"} size={12} color={ok ? "#34D399" : COLORS.textMuted} />
                  <Text style={[styles.checkLabel, { color: ok ? COLORS.text : COLORS.textMuted }]}>{String(label)}</Text>
                </View>
              ))}
            </View>

            <AppButton
              label={loading ? "Publication..." : "Publier le défi"}
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80, gap: 16 },
  hero: {
    padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(12,12,16,0.92)",
  },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  heroTitle: { ...TYPO.display, color: COLORS.text, marginTop: 6 },
  subtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 4 },
  form: {
    padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)", backgroundColor: COLORS.surface, gap: 16,
  },
  field: { gap: 6 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  input: {
    borderWidth: 1, borderColor: "rgba(148,163,184,0.25)", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, color: COLORS.text,
    backgroundColor: "rgba(5,5,7,0.9)", fontSize: 13,
  },
  inputMulti: { height: 90, textAlignVertical: "top" },
  charCount: { color: COLORS.textMuted, fontSize: 10, alignSelf: "flex-end" },
  sportsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sportChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: "rgba(5,5,7,0.7)",
  },
  sportChipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.15)" },
  sportChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  sportChipTextActive: { color: COLORS.primary, fontWeight: "800" },
  row: { flexDirection: "row", gap: 12 },
  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  unitChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: "rgba(5,5,7,0.7)",
  },
  unitChipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.15)" },
  unitText: { color: COLORS.textMuted, fontSize: 12 },
  unitTextActive: { color: COLORS.primary, fontWeight: "700" },
  toggleSection: {
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(5,5,7,0.7)", padding: 14, gap: 12,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleInfo: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  toggleLabel: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  toggleDesc: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  separator: { height: 1, backgroundColor: "rgba(148,163,184,0.1)" },
  qualityCard: {
    padding: 14, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(52,211,153,0.25)", backgroundColor: "rgba(52,211,153,0.06)",
    gap: 8,
  },
  qualityTitle: { color: "#34D399", fontWeight: "800", fontSize: 12, letterSpacing: 0.5, marginBottom: 2 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkLabel: { fontSize: 12, fontWeight: "600" },
  submitBtn: { marginTop: 4 },
});
