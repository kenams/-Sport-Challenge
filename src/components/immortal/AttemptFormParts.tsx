import React from "react";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS } from "../../theme";
import { parseDeclaredScore, sanitizeScoreInput } from "../../screens/helpers/attempts";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null;

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  hint?: string;
  fullWidth?: boolean;
};

/** Bouton accessible : rôle, libellé, cible tactile >= 48 px, état désactivé/chargement. */
export function ActionButton({ label, onPress, variant = "primary", loading, disabled, hint, fullWidth = true }: ButtonProps) {
  const inactive = !!disabled || !!loading;
  const fg = variant === "primary" ? "#0B0B0B" : variant === "danger" ? "#F87171" : COLORS.primary;
  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" ? styles.buttonPrimary : variant === "danger" ? styles.buttonDanger : styles.buttonGhost,
        fullWidth ? null : styles.buttonAuto,
        inactive ? { opacity: 0.55 } : null,
        pressed && !inactive ? { opacity: 0.85 } : null,
        webCursor,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function FieldLabel({ children, optional }: { children: string; optional?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {children}
      {optional ? <Text style={styles.optional}>  facultatif</Text> : null}
    </Text>
  );
}

export function InlineMessage({ tone, children }: { tone: "error" | "info" | "success"; children: React.ReactNode }) {
  const palette =
    tone === "error"
      ? { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.45)", fg: "#FCA5A5" }
      : tone === "success"
        ? { bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.4)", fg: COLORS.success }
        : { bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.35)", fg: COLORS.text };
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      style={[styles.message, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={[styles.messageText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

type ScoreFieldProps = {
  value: string;
  onChange: (text: string) => void;
  max: number;
  disabled?: boolean;
  showError?: boolean;
};

/** Saisie du score déclaré : clavier numérique, bornes du format, message d'erreur lisible. */
export function ScoreField({ value, onChange, max, disabled, showError }: ScoreFieldProps) {
  const parsed = parseDeclaredScore(value, max);
  const error = showError && !parsed.ok ? parsed.message : null;
  return (
    <View style={{ gap: 6 }}>
      <FieldLabel>Score déclaré (répétitions)</FieldLabel>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(sanitizeScoreInput(text))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={4}
        editable={!disabled}
        placeholder={`1 à ${max}`}
        placeholderTextColor={COLORS.textMuted}
        accessibilityLabel={`Score déclaré, nombre de répétitions, de 1 à ${max}`}
        style={[styles.input, styles.scoreInput, error ? styles.inputError : null, disabled ? { opacity: 0.6 } : null]}
      />
      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : (
        <Text style={styles.helper}>Le nombre exact de répétitions complètes. La modération retient le score qu'elle compte sur la vidéo.</Text>
      )}
    </View>
  );
}

type ConfirmProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
};

/** Confirmation en fenêtre modale (fonctionne sur mobile et sur le web, contrairement à Alert). */
export function ConfirmModal({ visible, title, message, confirmLabel, cancelLabel = "Annuler", destructive, busy, error, onConfirm, onCancel, children }: ConfirmProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onCancel} accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityRole="alert">
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetMessage}>{message}</Text>
          {children}
          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
          <View style={{ gap: 10, marginTop: 4 }}>
            <ActionButton label={confirmLabel} onPress={onConfirm} variant={destructive ? "danger" : "primary"} loading={busy} />
            <ActionButton label={cancelLabel} onPress={onCancel} variant="ghost" disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type SuccessProps = { onViewChallenge?: () => void; onDone: () => void; doneLabel: string; kind: "challenge" | "response" };

/** Confirmation d'envoi : dit clairement ce qui se passe ensuite. Rien n'est validé à ce stade. */
export function SubmissionSuccess({ onViewChallenge, onDone, doneLabel, kind }: SuccessProps) {
  return (
    <View style={styles.success} accessibilityLiveRegion="polite">
      <View style={styles.successBadge}>
        <Text style={styles.successBadgeText}>En attente de validation</Text>
      </View>
      <Text style={styles.successTitle}>{kind === "challenge" ? "Ton défi est envoyé" : "Ta réponse est envoyée"}</Text>
      <View style={{ gap: 8 }}>
        <Text style={styles.successLine}>Un modérateur va visionner ta vidéo et compter les répétitions selon les règles du format.</Text>
        <Text style={styles.successLine}>Ton score est pour l'instant seulement déclaré : il ne compte pas encore dans les records.</Text>
        <Text style={styles.successLine}>
          {kind === "challenge"
            ? "Si ta performance est validée, le score retenu s'affiche. Sinon, le motif du refus t'est indiqué."
            : "Une fois les deux performances validées, le résultat du duel s'affiche sur la page du défi."}
        </Text>
        <Text style={styles.successLine}>Tu peux retirer ta performance tant qu'elle est en attente.</Text>
      </View>
      <View style={{ gap: 10, marginTop: 8 }}>
        {onViewChallenge ? <ActionButton label="Voir mon défi" onPress={onViewChallenge} /> : null}
        <ActionButton label={doneLabel} onPress={onDone} variant={onViewChallenge ? "ghost" : "primary"} />
      </View>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  section: { gap: 10 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 12 },
  heading: { color: COLORS.text, fontSize: 22, fontWeight: "900", letterSpacing: 0.4 },
  lead: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
});

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  buttonAuto: { alignSelf: "flex-start" },
  buttonPrimary: { backgroundColor: COLORS.primary, borderColor: "rgba(255,255,255,0.12)" },
  buttonGhost: { backgroundColor: "rgba(212,175,55,0.08)", borderColor: "rgba(212,175,55,0.5)" },
  buttonDanger: { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.5)" },
  buttonLabel: { fontSize: 14, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", textAlign: "center" },
  fieldLabel: { color: COLORS.text, fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
  optional: { color: COLORS.textMuted, fontSize: 12, fontWeight: "500" },
  message: { padding: 12, borderRadius: 12, borderWidth: 1 },
  messageText: { fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, paddingHorizontal: 14, fontSize: 16 },
  scoreInput: { fontSize: 24, fontWeight: "900", color: COLORS.primary },
  inputError: { borderColor: "rgba(239,68,68,0.7)" },
  helper: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  errorText: { color: "#FCA5A5", fontSize: 13, lineHeight: 18 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 20 },
  sheet: { width: "100%", maxWidth: 460, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 12 },
  sheetTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  sheetMessage: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  success: { padding: 20, borderRadius: 18, borderWidth: 1, borderColor: "rgba(250,204,21,0.35)", backgroundColor: COLORS.card, gap: 12 },
  successBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(250,204,21,0.14)" },
  successBadgeText: { color: "#FACC15", fontSize: 12, fontWeight: "800" },
  successTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  successLine: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
});
