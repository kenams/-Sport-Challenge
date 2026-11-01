import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../ScreenContainer";
import LogoMark from "../LogoMark";
import { COLORS, TYPO } from "../../theme";

type Props = { title: string; subtitle?: string; children: React.ReactNode };

/** Mise en page commune connexion / inscription : colonne centrée, lisible sur mobile comme sur web. */
export default function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <ScreenContainer showHeader={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.column}>
            <View style={styles.brand} accessibilityRole="header">
              <LogoMark size={52} />
              <Text style={styles.name}>IMMORTAL</Text>
              <Text style={styles.tagline}>Il n'en restera qu'un</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  column: { width: "100%", maxWidth: 460, alignSelf: "center", gap: 20 },
  brand: { alignItems: "center", gap: 6 },
  name: { ...TYPO.display, color: COLORS.primary, fontSize: 24 },
  tagline: { color: COLORS.textMuted, fontSize: 13, letterSpacing: 1 },
  card: { backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 20, gap: 16 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20, marginTop: -8 },
});
