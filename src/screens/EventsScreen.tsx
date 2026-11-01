import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import EmptyState from "../components/immortal/EmptyState";
import ErrorState from "../components/immortal/ErrorState";
import EventAction from "../components/immortal/EventAction";
import EventStatusBadge from "../components/immortal/EventStatusBadge";
import { COLORS, TYPO } from "../theme";
import { listUpcomingEvents } from "../services/api";
import { formatLabel, formatTimeFr } from "../domain/formats";
import type { DuelEvent } from "../domain/types";
import { loadPlayers, playerName, playerTerritory, type PlayerInfo } from "./helpers/eventProfiles";
import { eventStatusInfo } from "./helpers/eventStatus";

/** Liste des événements à venir (onglet « Événements » et écran de pile). Aucune donnée fictive. */
export default function EventsScreen({ navigation }: any) {
  const [events, setEvents] = useState<DuelEvent[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerInfo>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    const result = await listUpcomingEvents();
    if (result.error || !result.data) {
      setError(result.error ?? "Chargement impossible.");
      setEvents([]);
    } else {
      setError(null);
      setEvents(result.data);
      setPlayers(await loadPlayers(result.data));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load("initial");
    }, [load])
  );

  const propose = () => navigation.navigate("ProposeEvent");

  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 200 }}>
        <Text style={styles.title} accessibilityRole="header">
          Événements
        </Text>
        <Text style={styles.subtitle}>Les duels annoncés. Un duel n'est confirmé que lorsque les deux joueurs ont accepté.</Text>
      </View>
      <View style={styles.cta}>
        <EventAction label="Proposer un duel" onPress={propose} />
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      {loading && events.length === 0 && !error ? (
        <View style={{ flex: 1 }}>
          {header}
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} accessibilityLabel="Chargement des événements" />
        </View>
      ) : (
        <FlatList
          data={error ? [] : events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            error ? (
              <ErrorState message={error} onRetry={() => load("initial")} />
            ) : (
              <EmptyState title="Aucun duel programmé." message="Propose-en un à un ami." actionLabel="Proposer un duel" onAction={propose} />
            )
          }
          renderItem={({ item }) => <EventRow event={item} players={players} onPress={() => navigation.navigate("EventDetail", { eventId: item.id })} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

function EventRow({ event, players, onPress }: { event: DuelEvent; players: Record<string, PlayerInfo>; onPress: () => void }) {
  const a = players[event.player_a];
  const b = players[event.player_b];
  const when = formatTimeFr(event.scheduled_at, event.timezone);
  const status = eventStatusInfo(event.status).label;
  const label = `${playerName(a)} contre ${playerName(b)}, ${formatLabel(event.format_key)}, ${when}, statut ${status}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Ouvre le détail du duel"
      style={({ pressed }) => [styles.row, pressed ? { opacity: 0.85 } : null, Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null]}
    >
      <View style={styles.rowTop}>
        <EventStatusBadge status={event.status} />
        <Text style={styles.format}>{formatLabel(event.format_key)}</Text>
      </View>
      <View style={styles.duel}>
        <View style={styles.side}>
          <Text style={styles.name} numberOfLines={1}>
            {playerName(a)}
          </Text>
          <Text style={styles.territory} numberOfLines={1}>
            {playerTerritory(a) || " "}
          </Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={[styles.side, { alignItems: "flex-end" }]}>
          <Text style={styles.name} numberOfLines={1}>
            {playerName(b)}
          </Text>
          <Text style={styles.territory} numberOfLines={1}>
            {playerTerritory(b) || " "}
          </Text>
        </View>
      </View>
      <Text style={styles.when}>{when}</Text>
      {event.status === "proposed" ? <Text style={styles.pending}>En attente d'accord de l'adversaire</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 90, gap: 12 },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 6 },
  title: { ...TYPO.display, color: COLORS.text, fontSize: 24 },
  subtitle: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  cta: { flexGrow: 1, flexBasis: 180, maxWidth: 320 },
  row: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 10, minHeight: 48 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  format: { color: COLORS.primary, fontSize: 12, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  duel: { flexDirection: "row", alignItems: "center", gap: 10 },
  side: { flex: 1 },
  name: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  territory: { color: COLORS.textMuted, fontSize: 13 },
  vs: { color: COLORS.primary, fontWeight: "900", fontSize: 14 },
  when: { color: COLORS.text, fontSize: 14 },
  pending: { color: "#FACC15", fontSize: 13, fontWeight: "700" },
});
