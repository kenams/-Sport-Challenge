// src/components/BrandHeader.tsx
import React, { useEffect, useState } from "react";
import { Platform, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";

import { COLORS, TYPO } from "../theme";
import LogoMark from "./LogoMark";
import { SIMPLE_MODE } from "../config";
import { supabase } from "../supabase";

export default function BrandHeader() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const canGoBack = navigation.canGoBack();
  const { width } = useWindowDimensions();
  const isCompact = Platform.OS !== "web" || width < 640;
  const isTiny = width < 360;
  const [isAuthed, setIsAuthed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const subtitleMap: Record<string, string> = {
    CreateChallenge: "Publier une performance",
    ChallengeDetail: "Détail du défi",
    SimpleChallengeDetail: "Détail de la performance",
    RespondChallenge: "Répondre au défi",
    ArenaLive: "Arena live",
    ArenaHistory: "Historique",
    ArenaReports: "Signalements",
    CoachNotifications: "Notifications coach",
    WalletHistory: "Historique du wallet",
    AdminAudit: "Audit admin",
    ArenaChallenges: "Défis arena",
    LiveHub: "Live hub",
    LiveEvents: "Live hebdo",
    LiveEventDetail: "Live en cours",
    TerritoryDetail: "Territoire",
  };
  const subtitle = subtitleMap[route.name as string] || "Ligue performance";
  const APP_TITLE = "IMMORTAL ARENA";

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setIsAuthed(!!session);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

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
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isAuthed]);

  const handleAuthAction = async () => {
    if (isAuthed) {
      await supabase.auth.signOut();
      const parent = navigation.getParent?.();
      const parentNames: string[] = parent?.getState?.()?.routeNames || [];
      if (parentNames.includes("GuestTabs")) {
        parent.navigate("GuestTabs", { screen: "AccueilInvite" });
      }
      return;
    }
    navigation.navigate("Login");
  };

  const goHome = () => {
    const homeTab = SIMPLE_MODE ? "Accueil" : "Defis";
    const state = navigation.getState?.();
    const routeNames: string[] = state?.routeNames || [];
    const tryNavigate = (name: string, params?: any) => {
      if (routeNames.includes(name)) {
        navigation.navigate(name, params);
        return true;
      }
      return false;
    };

    if (tryNavigate("Accueil")) return;
    if (tryNavigate("AccueilInvite")) return;
    if (tryNavigate("Defis")) return;

    const parent = navigation.getParent?.();
    if (parent) {
      const parentNames: string[] = parent.getState?.()?.routeNames || [];
      if (parentNames.includes("MainTabs")) {
        parent.navigate("MainTabs", { screen: homeTab });
        return;
      }
      if (parentNames.includes("GuestTabs")) {
        parent.navigate("GuestTabs", { screen: "AccueilInvite" });
        return;
      }
    }

    navigation.navigate("MainTabs", { screen: homeTab });
  };

  return (
    <View
      style={{
        marginBottom: isCompact ? 16 : 24,
        flexDirection: isCompact ? "column" : "row",
        alignItems: isCompact ? "flex-start" : "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {canGoBack && (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(212,175,55,0.4)",
            backgroundColor: "rgba(212,175,55,0.12)",
            ...(Platform.OS === "web" ? { cursor: "pointer" } : null),
          }}
        >
          <FontAwesome5 name="chevron-left" size={12} color={COLORS.primary} />
          <Text
            style={{
              color: COLORS.primary,
              fontWeight: "800",
              fontSize: 12,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Retour
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={goHome}
        activeOpacity={0.8}
        style={[
          { flex: 1, flexDirection: "row", alignItems: "center" },
          Platform.OS === "web" ? { cursor: "pointer" } : null,
        ]}
      >
        <LogoMark size={isTiny ? 34 : isCompact ? 40 : 48} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={{
              color: COLORS.text,
              ...TYPO.title,
              letterSpacing: 2.2,
            }}
          >
            {APP_TITLE}
          </Text>
          <Text
            style={{
              color: COLORS.textMuted,
              ...TYPO.subtitle,
              letterSpacing: 2.6,
            }}
          >
            {subtitle}
          </Text>
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: 10,
              letterSpacing: 2.4,
              marginTop: 4,
              textTransform: "uppercase",
            }}
          >
            Kah-Digital
          </Text>
        </View>
      </TouchableOpacity>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          alignSelf: isCompact ? "stretch" : "auto",
          flexWrap: "wrap",
        }}
      >
        {isAuthed && (
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.85}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "rgba(148,163,184,0.35)",
              backgroundColor: "rgba(8,8,12,0.7)",
              ...(Platform.OS === "web" ? { cursor: "pointer" } : null),
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <FontAwesome5 name="bell" size={12} color={COLORS.text} />
              {unreadCount > 0 && (
                <View
                  style={{
                    minWidth: 18,
                    paddingHorizontal: 6,
                    borderRadius: 999,
                    backgroundColor: COLORS.primary,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: "#0B0B0B",
                    }}
                  >
                    {unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        {!isAuthed && (
          <TouchableOpacity
            onPress={() => navigation.navigate("Register")}
            activeOpacity={0.85}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "rgba(212,175,55,0.5)",
              backgroundColor: "rgba(212,175,55,0.12)",
              ...(Platform.OS === "web" ? { cursor: "pointer" } : null),
            }}
          >
            <Text
              style={{
                color: COLORS.primary,
                fontWeight: "800",
                fontSize: 11,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              Inscription
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleAuthAction}
          activeOpacity={0.85}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.35)",
            backgroundColor: "rgba(8,8,12,0.7)",
            ...(Platform.OS === "web" ? { cursor: "pointer" } : null),
          }}
        >
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "800",
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: "uppercase",
            }}
          >
            {isAuthed ? "Déconnexion" : "Connexion"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
