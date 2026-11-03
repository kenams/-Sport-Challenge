import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../theme";

export default function CameraJudgeTestScreen({ navigation }: any) {
  const route = useRoute<any>();
  const formatKey = route.params?.formatKey;
  const pullups = formatKey === "pullups_max";
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.headingRow}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour" style={styles.back}><FontAwesome5 name="arrow-left" size={14} color={COLORS.text} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Tester le cadrage</Text>
            <Text style={styles.subtitle}>{pullups ? "Tractions" : "Pompes"} · vérification caméra</Text>
          </View>
        </View>

        <View style={styles.preview}>
          {permission?.granted ? (
            <CameraView style={StyleSheet.absoluteFill} facing={facing} />
          ) : permission ? (
            <View style={styles.permission}>
              <FontAwesome5 name="camera" size={28} color={COLORS.primary} />
              <Text style={styles.permissionText}>Autorise la caméra pour vérifier que le cadrage convient.</Text>
              <Pressable onPress={() => void requestPermission()} accessibilityRole="button" style={styles.action}><Text style={styles.actionText}>Autoriser la caméra</Text></Pressable>
            </View>
          ) : <ActivityIndicator color={COLORS.primary} />}
          {permission?.granted ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.guideLine, { top: pullups ? "25%" : "50%" }]} />
            <View style={[styles.guideLine, styles.secondLine, { top: pullups ? "42%" : "76%" }]} />
            <Text style={styles.guideLabel}>{pullups ? "BARRE / MENTON" : "ALIGNEMENT DU CORPS"}</Text>
            <View style={styles.cameraTag}><Text style={styles.cameraTagText}>APERÇU CAMÉRA</Text></View>
          </View> : null}
        </View>

        {permission?.granted ? <Pressable onPress={() => setFacing((current) => current === "back" ? "front" : "back")} accessibilityRole="button" style={styles.secondary}>
          <FontAwesome5 name="sync-alt" size={13} color={COLORS.primary} /><Text style={styles.secondaryText}>Changer de caméra</Text>
        </Pressable> : null}

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>À vérifier avant le duel</Text>
          <Text style={styles.noteText}>{pullups ? "Cadre la barre, tes mains, ton menton et tes pieds. Pose le téléphone assez loin pour que le mouvement reste visible." : "Place le téléphone de profil. Garde les mains, les épaules, le bassin et les pieds dans le cadre."}</Text>
          <Text style={styles.limitation}>Cet aperçu aide au cadrage. L’arbitre automatique n’est pas encore disponible dans l’application mobile ; les répétitions restent provisoires et un modérateur valide le résultat.</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 14, paddingBottom: 12 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  subtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  preview: { flex: 1, minHeight: 250, maxHeight: 520, borderRadius: 18, overflow: "hidden", backgroundColor: "#09090B", alignItems: "center", justifyContent: "center", position: "relative" },
  permission: { alignItems: "center", gap: 14, padding: 24 },
  permissionText: { color: COLORS.text, fontSize: 14, textAlign: "center", lineHeight: 20 },
  action: { minHeight: 46, paddingHorizontal: 18, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  actionText: { color: COLORS.background, fontWeight: "900" },
  guideLine: { position: "absolute", left: 14, right: 14, height: 2, backgroundColor: "#EF6877", opacity: 0.95 },
  secondLine: { backgroundColor: "#49D6B0" },
  guideLabel: { position: "absolute", top: 10, left: 10, color: "#FFFFFF", backgroundColor: "#050507C9", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  cameraTag: { position: "absolute", right: 10, top: 10, backgroundColor: "rgba(239,68,68,0.85)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  cameraTagText: { color: "white", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  secondary: { minHeight: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  secondaryText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  noteCard: { padding: 14, gap: 8, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  noteTitle: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  noteText: { color: COLORS.text, fontSize: 13, lineHeight: 19 },
  limitation: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16 },
});
