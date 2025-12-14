// src/components/RouletteBanner.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import AppButton from "./AppButton";
import { COLORS } from "../theme";
import { RouletteDuel, UserProfile } from "../types";

type Props = {
  duels: RouletteDuel[];
  currentUserId: string;
  profilesMap: Map<string, UserProfile>;
  loading?: boolean;
  onPressDuel: (duel: RouletteDuel, opponentId: string) => void;
  onShowRules: () => void;
};

export default function RouletteBanner({
  duels,
  currentUserId,
  profilesMap,
  loading = false,
  onPressDuel,
  onShowRules,
}: Props) {
  if (!currentUserId || (!duels.length && !loading)) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Roulette russe</Text>
          <Text style={styles.subtitle}>
            Chaque semaine la roue tourne : duel tiré au hasard, pénalité si tu
            fuis.
          </Text>
        </View>
        <AppButton
          label="Règles"
          size="sm"
          variant="ghost"
          onPress={onShowRules}
        />
      </View>
      {loading && duels.length === 0 ? (
        <Text style={styles.loadingText}>Chargement du duel...</Text>
      ) : (
        duels.slice(0, 3).map((duel) => {
          const opponentId =
            duel.player_a === currentUserId ? duel.player_b : duel.player_a;
          const opponent = profilesMap.get(opponentId);
          const opponentLabel =
            opponent?.pseudo ||
            (opponentId
              ? `Joueur ${opponentId.slice(0, 4)}...${opponentId.slice(-2)}`
              : "Adversaire mystère");
          const deadline = new Date(duel.deadline);
          const overdue = deadline.getTime() < Date.now();
          const statusLabel = getStatusLabel(duel.status, overdue);
          const isPenalized = duel.status === "penalized";
          const ctaLabel = isPenalized
            ? "Pénalisé"
            : duel.challenge_id
            ? "Voir le défi"
            : "Créer le duel";
          return (
            <View style={styles.duelCard} key={duel.id}>
              <View style={{ flex: 1 }}>
                <Text style={styles.duelOpponent}>{opponentLabel}</Text>
                <Text style={styles.duelMeta}>
                  Sport imposé : {duel.sport} • Limite{" "}
                  {deadline.toLocaleDateString("fr-FR")}
                </Text>
                <Text
                  style={[
                    styles.duelStatus,
                    { color: overdue ? COLORS.danger : COLORS.neonYellow },
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
              <AppButton
                label={ctaLabel}
                size="sm"
                variant="ghost"
                disabled={isPenalized}
                onPress={() => {
                  if (!isPenalized) {
                    onPressDuel(duel, opponentId);
                  }
                }}
                sport={duel.sport}
              />
            </View>
          );
        })
      )}
      <Text style={styles.penaltyNote}>
        Pas d’échappatoire : si la vidéos n’est pas publiée avant la deadline,
        -10 fair-play et -20 points automatiquement.
      </Text>
    </View>
  );
}

function getStatusLabel(status: string, overdue: boolean) {
  if (status === "completed") return "Duel validé ✅";
  if (status === "penalized") return "Pénalité appliquée";
  if (overdue) return "En retard !";
  return status === "challenge_created"
    ? "Défi en attente de réponse"
    : "Action requise";
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    backgroundColor: COLORS.card,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 12,
  },
  duelCard: {
    marginTop: 14,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  duelOpponent: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  duelMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  duelStatus: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  penaltyNote: {
    marginTop: 14,
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
