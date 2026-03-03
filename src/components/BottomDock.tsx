// src/components/BottomDock.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Animated,
} from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { SIMPLE_MODE } from "../config";
import { COLORS } from "../theme";
import { supabase } from "../supabase";

type DockItem = {
  key: string;
  label: string;
  icon: string;
};

const SIMPLE_TABS: DockItem[] = [
  { key: "Accueil", label: "Accueil", icon: "home" },
  { key: "Creer", label: "Créer", icon: "plus-circle" },
  { key: "Classement", label: "Classement", icon: "trophy" },
  { key: "Profil", label: "Profil", icon: "user" },
];

const MAIN_TABS: DockItem[] = [
  { key: "Defis", label: "Arène", icon: "fire" },
  { key: "Activite", label: "Flux", icon: "stream" },
  { key: "Classement", label: "Tableau", icon: "trophy" },
  { key: "Boutique", label: "Boutique", icon: "store" },
  { key: "Coach", label: "Coach", icon: "user-ninja" },
  { key: "Profil", label: "Profil", icon: "user" },
];

function getActiveTab(state: any) {
  if (!state || !state.routes) return null;
  const mainTabs = state.routes.find((route: any) => route.name === "MainTabs");
  const nested = mainTabs?.state;
  if (nested?.routes && typeof nested.index === "number") {
    return nested.routes[nested.index]?.name || null;
  }
  return state.routes[state.index]?.name || null;
}

export default function BottomDock() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const state = useNavigationState((s) => s);
  const activeTab = getActiveTab(state);
  const { width } = useWindowDimensions();
  const isCompact = width < 520 || Platform.OS !== "web";
  const isTiny = width < 360;
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAuthed, setIsAuthed] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const livePulse = useRef(new Animated.Value(0)).current;
  const tabs = useMemo(() => (SIMPLE_MODE ? SIMPLE_TABS : MAIN_TABS), []);

  const goTo = (key: string) => {
    navigation.navigate("MainTabs", { screen: key });
  };

  useEffect(() => {
    let mounted = true;

    const loadUnread = async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        if (mounted) setUnreadCount(0);
        return;
      }
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("read", false);
      if (mounted) setUnreadCount(count ?? 0);
    };

    const loadLive = async () => {
      const { count } = await supabase
        .from("live_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "live");
      if (mounted) setLiveActive((count ?? 0) > 0);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setIsAuthed(!!session);
      loadUnread();
      loadLive();
    });

    loadUnread();
    loadLive();
    const interval = setInterval(() => {
      loadUnread();
      loadLive();
    }, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!liveActive) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [liveActive, livePulse]);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
      <LinearGradient
        colors={["rgba(8,8,12,0.95)", "rgba(16,16,22,0.95)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.dock, isCompact ? styles.dockCompact : null]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const badgeCount = isAuthed && tab.key === "Coach" ? unreadCount : 0;
          const showLiveBadge = liveActive && tab.key === "Activite";
          return (
            <Pressable
              key={tab.key}
              onPress={() => goTo(tab.key)}
              style={({ pressed }) => [
                styles.item,
                isCompact ? styles.itemCompact : null,
                isActive ? styles.itemActive : null,
                pressed ? { opacity: 0.75 } : null,
                Platform.OS === "web" ? { cursor: "pointer" } : null,
              ]}
            >
              <View style={styles.iconWrap}>
                <FontAwesome5
                  name={tab.icon as any}
                  size={isCompact ? 14 : 16}
                  color={isActive ? COLORS.primary : COLORS.textMuted}
                />
                {badgeCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
                  </View>
                )}
                {showLiveBadge && (
                  <Animated.View
                    style={[
                      styles.liveBadge,
                      {
                        opacity: livePulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.65, 1],
                        }),
                        transform: [
                          {
                            scale: livePulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.96, 1.06],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </Animated.View>
                )}
              </View>
              {!isTiny && (
                <Text
                  style={[
                    styles.label,
                    isCompact ? styles.labelCompact : null,
                    { color: isActive ? COLORS.primary : COLORS.textMuted },
                  ]}
                >
                  {tab.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 10,
  },
  dock: {
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  dockCompact: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 14,
  },
  itemCompact: {
    paddingVertical: 6,
  },
  itemActive: {
    backgroundColor: "rgba(212,175,55,0.18)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.45)",
  },
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0B0B0B",
  },
  liveBadge: {
    position: "absolute",
    top: -10,
    left: -14,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#DC2626",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#DC2626",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  liveBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.6,
  },
  label: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  labelCompact: {
    fontSize: 9,
    letterSpacing: 0.4,
  },
});
