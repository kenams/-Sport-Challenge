import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import { listCommunityActivity, type CommunityActivity } from "../services/api";
import { formatLabel } from "../domain/formats";
import { supabase } from "../supabase";
import { COLORS } from "../theme";

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return "il y a " + minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return "il y a " + hours + " h";
  return "il y a " + Math.floor(hours / 24) + " j";
}

export default function CommunityActivityFeed() {
  const [items, setItems] = useState<CommunityActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listCommunityActivity(10);
    if (result.error) setError(result.error);
    else { setItems(result.data ?? []); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel("immortal-community-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "attempts" }, () => { load(); })
      .subscribe();
    const timer = setInterval(load, 60000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>L’actualité IMMORTAL</Text>
          <Text style={styles.subtitle}>Performances validées, en temps réel</Text>
        </View>
        <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View>
      </View>
      {loading ? <ActivityIndicator color={COLORS.primary} style={{ paddingVertical: 12 }} /> : null}
      {error ? <Text style={styles.muted}>L’actualité sera disponible dès qu’une performance sera validée.</Text> : null}
      {!loading && !error && items.length === 0 ? <Text style={styles.muted}>Le fil démarre avec la première performance validée. À toi de lancer le mouvement !</Text> : null}
      {items.map((item) => {
        const name = item.pseudo || "Un joueur";
        const action = item.kind === "challenge"
          ? "a validé un défi de " + formatLabel(item.format_key)
          : item.beat_opponent && item.opponent_pseudo
            ? "a battu " + item.opponent_pseudo + " en " + formatLabel(item.format_key)
            : "a terminé " + formatLabel(item.format_key);
        return (
          <View key={item.id} style={styles.row}>
            <UserAvatar uri={item.avatar_url} label={name} size={38} />
            <View style={styles.copy}>
              <Text style={styles.message}><Text style={styles.name}>{name}</Text> {action}{item.score != null ? " · " + item.score : ""}{item.kind === "response" && item.beat_opponent ? " 🏆" : ""}</Text>
              <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
            </View>
            {item.beat_opponent ? <FontAwesome5 name="trophy" size={15} color={COLORS.primary} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.025)", padding: 14, gap: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  subtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  live: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(52,211,153,0.12)" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  liveText: { color: COLORS.success, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  copy: { flex: 1, gap: 3 },
  message: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  name: { color: COLORS.text, fontWeight: "800" },
  time: { color: COLORS.textMuted, fontSize: 10 },
  muted: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
});
