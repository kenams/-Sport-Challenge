// src/screens/NotificationsScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";

interface Notif {
  id: number;
  user_id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  challenge: { icon: "fire", color: "#F59E0B" },
  vote: { icon: "thumbs-up", color: "#34D399" },
  winner: { icon: "trophy", color: "#D4AF37" },
  level_up: { icon: "star", color: "#C084FC" },
  fairplay: { icon: "shield-alt", color: "#60A5FA" },
  coach: { icon: "user-tie", color: "#F97316" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const loadNotifs = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("id,user_id,title,body,type,read,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifs((data as unknown as Notif[]) || []);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !mounted) { setLoading(false); return; }
      setUserId(uid);
      await loadNotifs(uid);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [loadNotifs]);

  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: number) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const unread = notifs.filter((n) => !n.read).length;

  const renderItem = ({ item }: { item: Notif }) => {
    const cfg = TYPE_CONFIG[item.type || ""] || { icon: "bell", color: COLORS.textMuted };
    return (
      <TouchableOpacity
        style={[styles.item, !item.read && styles.itemUnread]}
        activeOpacity={0.85}
        onPress={() => !item.read && markRead(item.id)}
      >
        <View style={[styles.iconCircle, { borderColor: cfg.color + "55", backgroundColor: cfg.color + "18" }]}>
          <FontAwesome5 name={cfg.icon as any} size={14} color={cfg.color} />
        </View>
        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
          </View>
          {item.body ? (
            <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          ) : null}
        </View>
        {!item.read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <Text style={styles.kicker}>NOTIFICATIONS</Text>
        <Text style={styles.heroTitle}>Centre d'alertes</Text>
        <Text style={styles.heroSubtitle}>Tes activités, victoires et alertes.</Text>
        {unread > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
            <FontAwesome5 name="check-double" size={11} color={COLORS.primary} />
            <Text style={styles.markAllText}>Tout marquer lu ({unread})</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <FontAwesome5 name="bell-slash" size={32} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>Tes alertes apparaîtront ici.</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(12,12,16,0.92)", marginBottom: 16,
  },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  heroTitle: { ...TYPO.display, color: COLORS.text, marginTop: 6 },
  heroSubtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 4 },
  markAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.1)", borderWidth: 1, borderColor: "rgba(212,175,55,0.3)",
  },
  markAllText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  list: { paddingBottom: 80, gap: 2 },
  item: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  itemUnread: { backgroundColor: "rgba(212,175,55,0.04)" },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  content: { flex: 1, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  notifTitle: { flex: 1, color: COLORS.textMuted, fontWeight: "600", fontSize: 13 },
  notifTitleUnread: { color: COLORS.text, fontWeight: "800" },
  time: { color: COLORS.textMuted, fontSize: 11, flexShrink: 0 },
  body: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary,
    alignSelf: "center", flexShrink: 0,
  },
  emptyBox: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16, marginBottom: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },
});
