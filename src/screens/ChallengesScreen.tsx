import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import ArenaSimulationScreen from "./ArenaSimulationScreen";
import ScreenContainer from "../components/ScreenContainer";
import AttemptCard from "../components/immortal/AttemptCard";
import EmptyState from "../components/immortal/EmptyState";
import ErrorState from "../components/immortal/ErrorState";
import { ActionButton } from "../components/immortal/AttemptFormParts";
import { getCurrentWeeklyChallenge, listChallengeFeed } from "../services/api";
import { formatLabel } from "../domain/formats";
import type { Attempt, FormatKey } from "../domain/types";
import { COLORS } from "../theme";
import { FEED_FILTERS, PAGE_SIZE, hasMorePages, mergeFeed } from "./helpers/attempts";

type Filter = "all" | FormatKey;
type Weekly = { week_start: string; format_key: FormatKey; note_fr: string | null };

export default function ChallengesScreen() {
  const [simulating, setSimulating] = useState(__DEV__);
  return simulating
    ? <ArenaSimulationScreen onExit={() => setSimulating(false)} />
    : <RealChallengesScreen onSimulate={() => setSimulating(true)} />;
}

function RealChallengesScreen({ onSimulate }: { onSimulate: () => void }) {
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [weekly, setWeekly] = useState<Weekly | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      const id = ++requestId.current;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      setMoreError(null);
      const result = await listChallengeFeed({ format: filter === "all" ? null : filter, limit: PAGE_SIZE, offset: 0 });
      if (id !== requestId.current) return;
      if (result.error || !result.data) {
        setError(result.error ?? "Une erreur est survenue. Réessaie dans un instant.");
        if (mode === "initial") setItems([]);
      } else {
        setItems(result.data);
        setMore(hasMorePages(result.data.length));
      }
      setLoading(false);
      setRefreshing(false);
    },
    [filter]
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  useEffect(() => {
    let alive = true;
    getCurrentWeeklyChallenge().then((result) => {
      if (alive) setWeekly(result.data && result.data.length > 0 ? result.data[0] : null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const loadMore = async () => {
    if (loadingMore || !more) return;
    setLoadingMore(true);
    setMoreError(null);
    const result = await listChallengeFeed({ format: filter === "all" ? null : filter, limit: PAGE_SIZE, offset: items.length });
    if (result.error || !result.data) {
      setMoreError(result.error ?? "Une erreur est survenue. Réessaie dans un instant.");
    } else {
      setItems((previous) => mergeFeed(previous, result.data ?? []));
      setMore(hasMorePages(result.data.length));
    }
    setLoadingMore(false);
  };

  const create = (formatKey?: FormatKey) => navigation.navigate("CreateChallenge", formatKey ? { formatKey } : undefined);

  const header = (
    <View style={styles.header}>
      <View style={{ gap: 4 }}>
        <Text style={styles.title} accessibilityRole="header">
          Défis
        </Text>
        <Text style={styles.lead}>Pompes et tractions. Un défi est lancé avec une vidéo, la modération valide le score.</Text>
      </View>

      {weekly ? (
        <View style={styles.weekly} accessible accessibilityLabel={`Défi de la semaine : ${formatLabel(weekly.format_key)}`}>
          <Text style={styles.weeklyKicker}>Défi de la semaine</Text>
          <Text style={styles.weeklyTitle}>{formatLabel(weekly.format_key)}</Text>
          {weekly.note_fr ? <Text style={styles.weeklyNote}>{weekly.note_fr}</Text> : null}
          <ActionButton label="Relever ce défi" variant="ghost" fullWidth={false} onPress={() => create(weekly.format_key)} />
        </View>
      ) : null}

      {__DEV__ ? <ActionButton label="Ouvrir la simulation vivante" variant="ghost" onPress={onSimulate} /> : null}
      <ActionButton label="Lancer un défi" onPress={() => create()} />

      <View style={styles.filters} accessibilityRole="tablist">
        {FEED_FILTERS.map((entry) => {
          const selected = entry.key === filter;
          return (
            <Pressable
              key={entry.key}
              onPress={() => setFilter(entry.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Filtrer : ${entry.label}`}
              style={[styles.chip, selected ? styles.chipSelected : null, Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  let body: React.ReactNode = null;
  if (loading) {
    body = (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.muted}>Chargement des défis…</Text>
      </View>
    );
  } else if (error && items.length === 0) {
    body = <ErrorState message={error} onRetry={() => load("initial")} />;
  } else if (items.length === 0) {
    body = (
      <EmptyState
        title={filter === "all" ? "Sois le premier à lancer un défi" : `Aucun défi en ${filter === "pushups_60s" ? "pompes" : "tractions"} pour le moment`}
        message="Filme ta performance, déclare ton score : la modération la valide, puis les autres joueurs peuvent te répondre."
        actionLabel="Lancer un défi"
        onAction={() => create(filter === "all" ? undefined : filter)}
      />
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        data={loading || (error && items.length === 0) ? [] : items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={body}
        renderItem={({ item }) => <AttemptCard attempt={item} onPress={() => navigation.navigate("ChallengeDetail", { challengeId: item.id })} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          items.length > 0 ? (
            <View style={styles.footer}>
              {error ? <Text style={styles.footerError}>Actualisation impossible : {error}</Text> : null}
              {moreError ? <Text style={styles.footerError}>{moreError}</Text> : null}
              {more ? <ActionButton label="Voir plus" variant="ghost" onPress={loadMore} loading={loadingMore} /> : <Text style={styles.muted}>Tu as tout vu.</Text>}
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: 0 },
  header: { gap: 16, paddingBottom: 16 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "900", letterSpacing: 0.4 },
  lead: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  weekly: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "rgba(212,175,55,0.5)", backgroundColor: "rgba(212,175,55,0.08)", gap: 6 },
  weeklyKicker: { color: COLORS.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  weeklyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  weeklyNote: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  filters: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  chipSelected: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.14)" },
  chipText: { color: COLORS.textMuted, fontSize: 14, fontWeight: "700" },
  chipTextSelected: { color: COLORS.primary },
  center: { alignItems: "center", gap: 10, paddingVertical: 40 },
  muted: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },
  footer: { paddingTop: 16, gap: 10 },
  footerError: { color: "#FCA5A5", fontSize: 13, textAlign: "center" },
});
