// src/components/BrandHeader.tsx
import React from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";

import { COLORS, TYPO } from "../theme";
import LogoMark from "./LogoMark";

const SUBTITLES: Record<string, string> = {
  Defis: "Défis",
  Classement: "Records",
  Evenements: "Événements",
  Profil: "Mon profil",
  CreateChallenge: "Lancer un défi",
  ChallengeDetail: "Détail du défi",
  RespondChallenge: "Répondre au défi",
  Moderation: "Modération",
  Events: "Événements",
  ProposeEvent: "Proposer un duel",
  EventDetail: "Événement",
  PublicEvent: "Duel annoncé",
  Pro: "IMMORTAL Pro",
};

/** En-tête commun : retour (si possible), marque et titre de l'écran. Aucune action sans effet. */
export default function BrandHeader() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const canGoBack = navigation.canGoBack();
  const subtitle = SUBTITLES[route.name as string] ?? "Pompes et tractions";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 12,
        minHeight: 48,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
        {canGoBack ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.card,
              ...(Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null),
            }}
          >
            <FontAwesome5 name="chevron-left" size={16} color={COLORS.text} />
          </TouchableOpacity>
        ) : (
          <LogoMark size={36} />
        )}
        <View style={{ flexShrink: 1 }}>
          <Text style={[TYPO.title, { color: COLORS.primary }]} numberOfLines={1}>
            IMMORTAL
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
}
