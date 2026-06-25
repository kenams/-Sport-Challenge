// src/screens/CreateLiveBattleScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import UserAvatar from "../components/UserAvatar";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";

const SPORTS = [
  "pushups", "running", "squat", "traction", "fitness",
  "basket", "foot", "boxe", "nage", "velo", "danse", "parkour", "mma", "yoga",
];

interface Player {
  user_id: string;
  pseudo: string;
  avatar_url?: string | null;
  total_points: number;
  wins: number;
}

interface PlayerPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (p: Player) => void;
  excludeId?: string | null;
  label: string;
}

function PlayerPickerModal({ visible, onClose, onSelect, excludeId, label }: PlayerPickerProps) {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    let sq = supabase
      .from("leaderboard_view")
      .select("user_id,pseudo,avatar_url,total_points,wins")
      .order("total_points", { ascending: false })
      .limit(30);
    if (q.trim().length > 1) sq = sq.ilike("pseudo", `%${q.trim()}%`);
    const { data } = await sq;
    const rows = ((data || []) as unknown as Player[]).filter(
      (p) => p.user_id !== excludeId
    );
    setPlayers(rows);
    setLoading(false);
  }, [excludeId]);

  useEffect(() => {
    if (visible) search(query);
  }, [visible, search, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={pm.header}>
            <Text style={pm.title}>{label}</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome5 name="times" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={pm.search}
            placeholder="Rechercher un joueur..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={(t) => { setQuery(t); search(t); }}
          />
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={players}
              keyExtractor={(p) => p.user_id}
              style={{ maxHeight: 350 }}
              ListEmptyComponent={<Text style={pm.empty}>Aucun joueur trouvé</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={pm.row} onPress={() => { onSelect(item); onClose(); }}>
                  <UserAvatar uri={item.avatar_url} label={item.pseudo} size={36} />
                  <View style={pm.rowInfo}>
                    <Text style={pm.pseudo}>{item.pseudo}</Text>
                    <Text style={pm.pts}>{item.total_points} pts · {item.wins} victoires</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={11} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40,
    borderTopWidth: 1, borderColor: "rgba(212,175,55,0.25)",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  search: {
    color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 13,
    backgroundColor: "rgba(255,255,255,0.04)", marginBottom: 10,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowInfo: { flex: 1 },
  pseudo: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  pts: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  empty: { color: COLORS.textMuted, textAlign: "center", paddingVertical: 20, fontSize: 13 },
});

export default function CreateLiveBattleScreen({ navigation }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("20:00");
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [picker1Open, setPicker1Open] = useState(false);
  const [picker2Open, setPicker2Open] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    title.trim().length >= 4 &&
    sport &&
    player1 &&
    player2 &&
    scheduledDate.trim().length >= 8;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const [dd, mm, yyyy] = scheduledDate.includes("/")
      ? scheduledDate.split("/")
      : scheduledDate.split("-").reverse();
    const isoDate = `${yyyy || scheduledDate}-${mm || "01"}-${dd || "01"}`;
    const scheduledIso = `${isoDate}T${scheduledTime}:00`;

    const payload: Record<string, any> = {
      title: title.trim(),
      description: description.trim() || null,
      sport,
      status: "scheduled",
      player1_id: player1!.user_id,
      player2_id: player2!.user_id,
      player1_pseudo: player1!.pseudo,
      player2_pseudo: player2!.pseudo,
      player1_avatar: player1!.avatar_url ?? null,
      player2_avatar: player2!.avatar_url ?? null,
      player1_votes: 0,
      player2_votes: 0,
      viewer_count: 0,
      scheduled_at: scheduledIso,
    };

    const { data, error } = await supabase.from("live_events").insert(payload).select("id").maybeSingle();
    setSubmitting(false);

    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }

    Alert.alert(
      "Battle programmée !",
      `La battle "${title}" est planifiée pour le ${scheduledDate} à ${scheduledTime}.`,
      [
        { text: "Voir la battle", onPress: () => navigation?.navigate("LiveBattle", { id: (data as any)?.id }) },
        { text: "Hub Live", onPress: () => navigation?.navigate("LiveHub") },
      ]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.hero}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.back}>
            <FontAwesome5 name="arrow-left" size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>IMMORTAL ARENA</Text>
            <Text style={styles.heroTitle}>Programmer une Battle</Text>
            <Text style={styles.heroSub}>Choisis deux adversaires et planifie le duel.</Text>
          </View>
        </View>

        {/* Sélection joueurs */}
        <Text style={styles.sectionLabel}>LES COMBATTANTS</Text>
        <View style={styles.playersRow}>
          <TouchableOpacity style={[styles.playerSlot, player1 && styles.playerSlotFilled]} onPress={() => setPicker1Open(true)}>
            {player1 ? (
              <>
                <UserAvatar uri={player1.avatar_url} label={player1.pseudo} size={44} />
                <Text style={styles.slotName} numberOfLines={1}>{player1.pseudo}</Text>
                <Text style={styles.slotPts}>{player1.total_points} pts</Text>
              </>
            ) : (
              <>
                <View style={styles.slotEmpty}>
                  <FontAwesome5 name="user-plus" size={18} color={COLORS.textMuted} />
                </View>
                <Text style={styles.slotLabel}>Joueur 1</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.vsCenter}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <TouchableOpacity style={[styles.playerSlot, player2 && styles.playerSlotFilled]} onPress={() => setPicker2Open(true)}>
            {player2 ? (
              <>
                <UserAvatar uri={player2.avatar_url} label={player2.pseudo} size={44} />
                <Text style={styles.slotName} numberOfLines={1}>{player2.pseudo}</Text>
                <Text style={styles.slotPts}>{player2.total_points} pts</Text>
              </>
            ) : (
              <>
                <View style={styles.slotEmpty}>
                  <FontAwesome5 name="user-plus" size={18} color={COLORS.textMuted} />
                </View>
                <Text style={styles.slotLabel}>Joueur 2</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Titre */}
        <Text style={styles.sectionLabel}>TITRE DE LA BATTLE</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Battle Pushup élite du samedi"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
        <Text style={styles.charCount}>{title.length}/80</Text>

        {/* Description */}
        <Text style={styles.sectionLabel}>DESCRIPTION (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Règles, enjeux, context de la battle..."
          placeholderTextColor={COLORS.textMuted}
          value={description}
          onChangeText={setDescription}
          maxLength={300}
          multiline
          numberOfLines={3}
        />

        {/* Sport */}
        <Text style={styles.sectionLabel}>DISCIPLINE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={styles.chips}>
            {SPORTS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, sport === s && styles.chipActive]}
                onPress={() => setSport(s)}
              >
                <Text style={[styles.chipTxt, sport === s && styles.chipTxtActive]}>
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Date & Heure */}
        <Text style={styles.sectionLabel}>DATE & HEURE</Text>
        <View style={styles.dateRow}>
          <View style={[styles.dateField, { flex: 2 }]}>
            <FontAwesome5 name="calendar" size={12} color={COLORS.textMuted} style={styles.fieldIcon} />
            <TextInput
              style={styles.dateInput}
              placeholder="JJ/MM/AAAA"
              placeholderTextColor={COLORS.textMuted}
              value={scheduledDate}
              onChangeText={setScheduledDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
          <View style={[styles.dateField, { flex: 1 }]}>
            <FontAwesome5 name="clock" size={12} color={COLORS.textMuted} style={styles.fieldIcon} />
            <TextInput
              style={styles.dateInput}
              placeholder="HH:MM"
              placeholderTextColor={COLORS.textMuted}
              value={scheduledTime}
              onChangeText={setScheduledTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        </View>

        {/* Résumé */}
        {player1 && player2 && title && sport && scheduledDate && (
          <View style={styles.summary}>
            <FontAwesome5 name="fire" size={12} color={COLORS.primary} />
            <Text style={styles.summaryTxt}>
              {player1.pseudo} vs {player2.pseudo} · {sport.toUpperCase()} · {scheduledDate} {scheduledTime}
            </Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && { opacity: 0.4 }]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <FontAwesome5 name="broadcast-tower" size={14} color="#000" />
              <Text style={styles.submitTxt}>Programmer la Battle</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      <PlayerPickerModal
        visible={picker1Open}
        onClose={() => setPicker1Open(false)}
        onSelect={setPlayer1}
        excludeId={player2?.user_id}
        label="Choisir le Joueur 1"
      />
      <PlayerPickerModal
        visible={picker2Open}
        onClose={() => setPicker2Open(false)}
        onSelect={setPlayer2}
        excludeId={player1?.user_id}
        label="Choisir le Joueur 2"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    padding: 16, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)", backgroundColor: "rgba(12,12,16,0.95)",
    marginBottom: 20,
  },
  back: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: COLORS.border,
    marginTop: 2,
  },
  kicker: { fontSize: 10, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  heroTitle: { ...TYPO.title, color: COLORS.text, marginTop: 4 },
  heroSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 3 },

  sectionLabel: {
    fontSize: 10, letterSpacing: 2.5, color: COLORS.textMuted, fontWeight: "800",
    marginBottom: 10, marginTop: 4,
  },

  playersRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20,
  },
  playerSlot: {
    flex: 1, alignItems: "center", gap: 6, padding: 14, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  playerSlotFilled: { borderColor: COLORS.primary + "44", backgroundColor: COLORS.primary + "06" },
  slotEmpty: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  slotLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  slotName: { color: COLORS.text, fontWeight: "800", fontSize: 12, textAlign: "center" },
  slotPts: { color: COLORS.primary, fontSize: 10, fontWeight: "700" },
  vsCenter: { width: 44, alignItems: "center" },
  vsText: { color: COLORS.primary, fontWeight: "900", fontSize: 20, letterSpacing: 2 },

  input: {
    color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13,
    backgroundColor: COLORS.surface, marginBottom: 4,
  },
  textArea: { height: 80, textAlignVertical: "top" },
  charCount: { color: COLORS.textMuted, fontSize: 10, textAlign: "right", marginBottom: 14 },

  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.primary + "18", borderColor: COLORS.primary + "66" },
  chipTxt: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  chipTxtActive: { color: COLORS.primary },

  dateRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  dateField: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
    backgroundColor: COLORS.surface, paddingHorizontal: 12,
  },
  fieldIcon: { marginRight: 8 },
  dateInput: { flex: 1, color: COLORS.text, paddingVertical: 11, fontSize: 13 },

  summary: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.primary + "30", backgroundColor: COLORS.primary + "08",
    marginBottom: 20,
  },
  summaryTxt: { color: COLORS.primary, fontSize: 12, fontWeight: "700", flex: 1 },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 28, marginBottom: 8,
  },
  submitTxt: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
});
