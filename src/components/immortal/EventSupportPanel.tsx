import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import EventAction from "./EventAction";
import EventAuthPrompt from "./EventAuthPrompt";
import { COLORS } from "../../theme";
import type { EventStatus } from "../../domain/types";
import { canSupport, supportClosedReason } from "../../screens/helpers/eventStatus";

type Side = { id: string; name: string; supporters: number };

type Props = {
  status: EventStatus;
  a: Side;
  b: Side;
  authed: boolean;
  supportedId: string | null;
  reminderOn: boolean;
  busy: "support" | "reminder" | null;
  feedback: { text: string; error: boolean } | null;
  onSupport: (playerId: string) => void;
  onToggleReminder: () => void;
  onLogin: () => void;
  onRegister: () => void;
};

function plural(n: number): string {
  return n === 1 ? "1 soutien" : `${n} soutiens`;
}

/** Compteurs réels de soutiens + actions Soutenir / Me rappeler. Les soutiens ne modifient jamais le score. */
export default function EventSupportPanel(p: Props) {
  const [choosing, setChoosing] = useState(false);
  const [needAuth, setNeedAuth] = useState<null | "support" | "reminder">(null);
  const open = canSupport(p.status);

  const startSupport = () => {
    if (!p.authed) return setNeedAuth("support");
    setChoosing((v) => !v);
  };
  const remind = () => {
    if (!p.authed) return setNeedAuth("reminder");
    p.onToggleReminder();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Soutiens</Text>
      <View style={styles.counters}>
        {[p.a, p.b].map((side) => (
          <View key={side.id} style={styles.counter} accessible accessibilityLabel={`${side.name} : ${plural(side.supporters)}`}>
            <Text style={styles.count}>{side.supporters}</Text>
            <Text style={styles.counterName} numberOfLines={1}>
              {side.name}
            </Text>
            {p.supportedId === side.id ? <Text style={styles.mine}>Ton soutien</Text> : null}
          </View>
        ))}
      </View>
      <Text style={styles.note}>Les soutiens ne modifient pas le score. Ils montrent seulement qui vient encourager chaque joueur.</Text>

      {open ? (
        <View style={styles.actions}>
          <EventAction
            label={p.supportedId ? "Changer mon soutien" : "Je viens soutenir"}
            onPress={startSupport}
            selected={choosing}
            accessibilityHint="Choisir le joueur à soutenir"
          />
          {choosing && p.authed ? (
            <View style={styles.choices}>
              {[p.a, p.b].map((side) => (
                <View key={side.id} style={styles.choice}>
                  <EventAction
                    label={`Soutenir ${side.name}`}
                    variant="ghost"
                    selected={p.supportedId === side.id}
                    busy={p.busy === "support"}
                    onPress={() => {
                      p.onSupport(side.id);
                      setChoosing(false);
                    }}
                  />
                </View>
              ))}
            </View>
          ) : null}
          <EventAction
            label={p.reminderOn ? "Rappel activé (désactiver)" : "Me rappeler"}
            variant="ghost"
            onPress={remind}
            busy={p.busy === "reminder"}
            selected={p.reminderOn}
            accessibilityHint="Active ou désactive un rappel avant le duel"
          />
          {needAuth ? (
            <EventAuthPrompt
              reason={needAuth === "support" ? "Connecte-toi pour choisir le joueur que tu soutiens." : "Connecte-toi pour recevoir un rappel avant le duel."}
              onLogin={p.onLogin}
              onRegister={p.onRegister}
            />
          ) : null}
        </View>
      ) : (
        <Text style={styles.closed}>{supportClosedReason(p.status)}</Text>
      )}
      {p.feedback ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.feedback, p.feedback.error ? styles.err : styles.okText]}>
          {p.feedback.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 12 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  counters: { flexDirection: "row", gap: 10 },
  counter: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", gap: 2 },
  count: { color: COLORS.primary, fontSize: 28, fontWeight: "900" },
  counterName: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  mine: { color: COLORS.success, fontSize: 12, fontWeight: "800" },
  note: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  actions: { gap: 10 },
  choices: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  choice: { flexGrow: 1, flexBasis: 150 },
  closed: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  feedback: { fontSize: 14, lineHeight: 20 },
  err: { color: "#F87171" },
  okText: { color: COLORS.success },
});
