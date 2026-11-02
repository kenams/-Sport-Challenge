// Suppression de compte en deux étapes (fenêtres modales : Alert.alert est inactif sur le web).
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ConfirmModal, FieldLabel } from "./AttemptFormParts";
import { COLORS } from "../../theme";
import { deleteMyAccount } from "../../services/api";
import { DELETE_CONFIRM_WORD, DELETION_KEPT, DELETION_PRO_WARNING, DELETION_SUMMARY, isDeletionConfirmed } from "../../screens/helpers/accountDeletion";

type Props = { visible: boolean; onClose: () => void; onDeleted: () => void };

export default function DeleteAccountFlow({ visible, onClose, onDeleted }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setStep(1);
    setTyped("");
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (busy) return;
    if (step === 1) {
      setStep(2);
      return;
    }
    if (!isDeletionConfirmed(typed)) {
      setError(`Écris ${DELETE_CONFIRM_WORD} pour confirmer.`);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await deleteMyAccount();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDeleted();
  };

  if (step === 1) {
    return (
      <ConfirmModal
        visible={visible}
        title="Supprimer mon compte ?"
        message="Cette action est définitive. Voici ce qui sera supprimé :"
        confirmLabel="Continuer"
        destructive
        onConfirm={confirm}
        onCancel={close}
      >
        <View style={styles.list}>
          {DELETION_SUMMARY.map((line) => (
            <Text key={line} style={styles.item}>
              {"•  "}
              {line}
            </Text>
          ))}
          <Text style={styles.sub}>Ce qui ne change pas</Text>
          {DELETION_KEPT.map((line) => (
            <Text key={line} style={styles.item}>
              {"•  "}
              {line}
            </Text>
          ))}
          <Text style={styles.warn}>{DELETION_PRO_WARNING}</Text>
        </View>
      </ConfirmModal>
    );
  }

  return (
    <ConfirmModal
      visible={visible}
      title="Dernière confirmation"
      message={`Pour supprimer définitivement ton compte et tes vidéos, écris ${DELETE_CONFIRM_WORD} ci-dessous.`}
      confirmLabel="Supprimer définitivement"
      destructive
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={close}
    >
      <View style={{ gap: 6 }}>
        <FieldLabel>Confirmation</FieldLabel>
        <TextInput
          value={typed}
          onChangeText={(t) => {
            setTyped(t);
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
          placeholder={DELETE_CONFIRM_WORD}
          placeholderTextColor={COLORS.textMuted}
          accessibilityLabel={`Écris ${DELETE_CONFIRM_WORD} pour confirmer la suppression`}
          style={styles.input}
        />
      </View>
    </ConfirmModal>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  item: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  sub: { color: COLORS.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 8 },
  warn: { color: "#FCA5A5", fontSize: 13, lineHeight: 18, marginTop: 8 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, color: COLORS.text, backgroundColor: COLORS.surface, fontSize: 16 },
});
