// Onglet « Records » : classement serveur par format et par périmètre territorial (territoire déclaré).
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import EmptyState from "../components/immortal/EmptyState";
import ErrorState from "../components/immortal/ErrorState";
import ActionButton from "../components/immortal/ActionButton";
import LeaderboardRow from "../components/immortal/LeaderboardRow";
import { COLORS } from "../theme";
import { supabase } from "../supabase";
import { getLeaderboard, getMyProfile } from "../services/api";
import { FALLBACK_FORMATS } from "../domain/formats";
import type { FormatKey, LeaderboardRow as Row, MyProfile, TerritoryScope } from "../domain/types";
import { SCOPE_OPTIONS, resolveScope } from "./helpers/leaderboardScope";

const UNITS: Record<FormatKey, string> = { pushups_60s: "pompes", pullups_max: "tractions" };
const FORMAT_TABS: Array<{ key: FormatKey; label: string }> = [
  { key: "pushups_60s", label: "Pompes 60 s" },
  { key: "pullups_max", label: "Tractions max" },
];

export default function LeaderboardScreen({ navigation }: any) {
  const [format, setFormat] = useState<FormatKey>("pushups_60s");
  const [scope, setScope] = useState<TerritoryScope>("world");
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const resolved = resolveScope(scope, profile);

  const load = useCallback(
    async (mode: "load" | "refresh" = "load") => {
      const id = ++requestId.current;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [profileRes, sessionRes] = await Promise.all([getMyProfile(), supabase.auth.getSession()]);
      if (id !== requestId.current) return;
      setProfile(profileRes.data);
      setUid(sessionRes.data.session?.user?.id ?? null);

      const target = resolveScope(scope, profileRes.data);
      if (target.missing) {
        setRows([]);
      } else {
        const result = await getLeaderboard(format, scope, target.value);
        if (id !== requestId.current) return;
        if (result.error) setError(result.error);
        setRows(result.data ?? []);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [format, scope]
  );

  useFocusEffect(
    useCallback(() => {
      load("load");
    }, [load])
  );

  const champion = rows.find((r) => r.rank === 1) ?? null;
  const unit = UNITS[format];
  const formatLabelText = FALLBACK_FORMATS.find((f) => f.key === format)?.label_fr ?? "";
  const scopeText = scope === "world" ? "dans le monde" : resolved.label ? `à ${resolved.label}` : "";

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.primary} />}
      >
        <View accessibilityRole="tablist" style={styles.seg}>
          {FORMAT_TABS.map((tab) => (
            <Chip key={tab.key} label={tab.label} selected={format === tab.key} onPress={() => setFormat(tab.key)} />
          ))}
        </View>
        <View accessibilityRole="tablist" style={styles.seg}>
          {SCOPE_OPTIONS.map((option) => (
            <Chip key={option.key} label={option.label} selected={scope === option.key} onPress={() => setScope(option.key)} small />
          ))}
        </View>

        <Text style={styles.heading} accessibilityRole="header">
          {formatLabelText}
          {scopeText ? ` · ${scopeText}` : ""}
        </Text>

        {resolved.missing ? (
          <EmptyState
            title={`Renseigne ${SCOPE_OPTIONS.find((o) => o.key === scope)?.missingHint ?? "ton territoire"}`}
            message="Ce classement utilise le territoire que tu déclares dans ton profil. Sans lui, tu ne peux pas voir ni apparaître dans ce périmètre."
            actionLabel="Compléter mon profil"
            onAction={() => navigation.navigate("Profil")}
          />
        ) : loading && !refreshing ? (
          <View style={styles.center} accessibilityLabel="Chargement du classement">
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={() => load("load")} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Aucun record validé ici."
            message="Sois le premier à établir un record. Ta performance comptera dès qu'elle aura été validée par la modération."
            actionLabel="Lancer un défi"
            onAction={() => navigation.navigate("CreateChallenge", { formatKey: format })}
          />
        ) : (
          <>
            {champion ? (
              <View style={styles.championCard} accessible accessibilityLabel={`Champion actuel : ${champion.pseudo ?? "Joueur"}, ${champion.best_score} ${unit}`}>
                <Text style={styles.championKicker}>Champion actuel</Text>
                <Text style={styles.championName} numberOfLines={1}>
                  {champion.pseudo?.trim() || "Joueur"}
                </Text>
                <Text style={styles.championScore}>
                  {champion.best_score} <Text style={styles.championUnit}>{unit}</Text>
                </Text>
                <Text style={styles.small}>Le titre reste à son détenteur tant qu'aucune performance validée ne le dépasse.</Text>
              </View>
            ) : null}
            <View style={{ gap: 8 }}>
              {rows.map((row) => (
                <LeaderboardRow key={row.attempt_id ?? row.user_id} row={row} isMe={!!uid && row.user_id === uid} isChampion={row.rank === 1} unit={unit} />
              ))}
            </View>
          </>
        )}

        <Text style={styles.footnote}>
          Classement établi sur les performances validées et le territoire déclaré par les joueurs. À score égal, le premier à l'avoir réalisé passe devant.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Chip({ label, selected, onPress, small }: { label: string; selected: boolean; onPress: () => void; small?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, small ? styles.chipSmall : null, selected ? styles.chipOn : null, Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextOn : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40, gap: 14, width: "100%", maxWidth: 720, alignSelf: "center" },
  seg: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { flexGrow: 1, minHeight: 46, paddingHorizontal: 14, borderRadius: 23, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  chipSmall: { minHeight: 44, flexBasis: 0 },
  chipOn: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.16)" },
  chipText: { color: COLORS.textMuted, fontSize: 14, fontWeight: "600" },
  chipTextOn: { color: COLORS.primary, fontWeight: "800" },
  heading: { color: COLORS.text, fontSize: 17, fontWeight: "800", marginTop: 4 },
  center: { paddingVertical: 50, alignItems: "center" },
  championCard: { padding: 18, borderRadius: 18, borderWidth: 1, borderColor: "rgba(212,175,55,0.6)", backgroundColor: "rgba(212,175,55,0.08)", gap: 4 },
  championKicker: { color: COLORS.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  championName: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  championScore: { color: COLORS.primary, fontSize: 34, fontWeight: "900" },
  championUnit: { color: COLORS.textMuted, fontSize: 14, fontWeight: "600" },
  small: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  footnote: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 8 },
});
