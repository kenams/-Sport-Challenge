// src/screens/ChallengeDetailScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import { supabase } from "../supabase";

const PLAYERS = [
  "Kah Alpha",
  "Maya Flash",
  "Noah Sprint",
  "Lina Force",
  "Zara Wave",
  "Owen Blaze",
  "Nora Heat",
  "Leo Arrow",
];

const TERRITORIES = [
  { code: "75", label: "Paris" },
  { code: "92", label: "Hauts-de-Seine" },
  { code: "93", label: "Seine-Saint-Denis" },
  { code: "69", label: "Rhone" },
  { code: "13", label: "Bouches-du-Rhone" },
];

const SPORTS = ["pushups", "course", "traction", "basket", "squat", "fitness", "running", "foot"];

export default function ChallengeDetailScreen({ navigation }: any) {
  const route = useRoute<any>();
  const challengeId = Number(route?.params?.id ?? 0);
  const [isAuthed, setIsAuthed] = useState(false);

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

  const detail = useMemo(() => {
    const seed = challengeId || 1;
    const sport = SPORTS[seed % SPORTS.length];
    const title = `Defi #${seed} - ${sport}`;
    const best = PLAYERS.slice(0, 3).map((name, idx) => ({
      title: name,
      meta: `Score ${Math.max(10, 60 - idx * 6)}`,
      value: idx === 0 ? "Top 1" : idx === 1 ? "Top 2" : "Top 3",
    }));
    const players = PLAYERS.map((name, idx) => ({
      title: name,
      meta: `Niveau ${4 + (idx % 5)}`,
      value: idx % 2 === 0 ? "Actif" : "Pret",
    }));
    const territories = TERRITORIES.map((item, idx) => ({
      title: `${item.code} ${item.label}`,
      meta: `Leader ${PLAYERS[idx % PLAYERS.length]}`,
      value: `${240 - idx * 12} pts`,
    }));
    const nextChallenge = {
      title: `Prochain defi ${SPORTS[(seed + 1) % SPORTS.length]}`,
      meta: "Demain 20:00",
      value: "Ouvert",
    };
    const hasLive = seed % 2 === 0;
    const nextLive = hasLive
      ? {
          title: "Live associe",
          meta: "Ce soir 21:00",
          value: "2 joueurs",
        }
      : {
          title: "Aucun live programme",
          meta: "Pas de session active",
          value: "A venir",
        };

    return {
      title,
      sport,
      hasLive,
      stats: [
        { label: "Participants", value: String(12 + (seed % 8)) },
        { label: "Votes", value: String(120 + seed * 3) },
        { label: "Territoires", value: String(TERRITORIES.length) },
      ],
      sections: [
        {
          title: "Meilleures performances",
          subtitle: "Les leaders actuels sur ce defi.",
          items: best,
        },
        {
          title: "Joueurs engages",
          subtitle: "Qui est deja dans l'arene.",
          items: players,
        },
        {
          title: "Territoires en feu",
          subtitle: "Les zones qui dominent ce defi.",
          items: territories,
        },
        {
          title: "Prochain defi",
          subtitle: "Ce qui arrive apres celui-ci.",
          items: [nextChallenge],
        },
        {
          title: "Prochain live",
          subtitle: "Session live liee a ce defi.",
          items: [nextLive],
        },
      ],
    };
  }, [challengeId]);

  if (!isAuthed) {
    return (
      <ScreenContainer>
        <View style={styles.lockedCard}>
          <Text style={styles.kicker}>ACCES RESTREINT</Text>
          <Text style={styles.title}>Connecte-toi pour voir le detail</Text>
          <Text style={styles.subtitle}>
            Les infos completes (joueurs, territoires, meilleurs, lives) sont reservees aux membres.
          </Text>
          <View style={styles.actions}>
            <AppButton label="Connexion" onPress={() => navigation?.navigate("Login")} />
            <AppButton label="Inscription" variant="ghost" onPress={() => navigation?.navigate("Register")} />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>DEFI</Text>
          <Text style={styles.title}>{detail.title}</Text>
          <Text style={styles.subtitle}>Sport: {detail.sport}</Text>
          <View style={styles.statsRow}>
            {detail.stats.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <AppButton
              label="Participer"
              size="sm"
              onPress={() =>
                navigation?.navigate("RespondChallenge", {
                  id: challengeId,
                  sport: detail.sport,
                  title: detail.title,
                })
              }
            />
            <AppButton
              label="Voir live"
              size="sm"
              variant="ghost"
              onPress={() =>
                detail.hasLive
                  ? navigation?.navigate("LiveEventDetail", { challengeId })
                  : navigation?.navigate("LiveEvents")
              }
            />
          </View>
        </View>

        {detail.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
            <View style={styles.cardGrid}>
              {section.items.map((item, idx) => (
                <View key={section.title + "-" + idx} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>{item.meta}</Text>
                  <Text style={styles.cardValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80 },
  hero: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
    marginBottom: 18,
  },
  lockedCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
    marginTop: 40,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  title: {
    ...TYPO.display,
    color: COLORS.text,
    marginTop: 6,
  },
  subtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statsRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(3,7,18,0.6)",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    ...TYPO.title,
    color: COLORS.text,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: 220,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: COLORS.surface,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  cardMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  cardValue: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 8,
    fontWeight: "700",
  },
});
