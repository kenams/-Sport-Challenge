// src/screens/ProfileScreen.tsx
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import VideoPlayer from "../components/VideoPlayer";

export default function ProfileScreen({ navigation }: any) {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) {
        setResponses([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("challenge_responses")
        .select("id, challenge_id, video_url, created_at, votes, is_winner, challenges(title, sport)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (active) {
        setResponses(data || []);
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Profil</Text>
          <Text style={styles.title}>{email || "Invite"}</Text>
          <Text style={styles.subtitle}>
            Gere ton identite, tes stats et tes infos publiques.
          </Text>
          <View style={styles.row}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>8</Text>
              <Text style={styles.statLabel}>Niveau</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>1240</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>Victoires</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <AppButton label="Modifier" size="sm" onPress={() => {}} />
            <AppButton
              label="Historique"
              size="sm"
              variant="ghost"
              onPress={() => navigation?.navigate("WalletHistory")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dernieres performances</Text>
          <Text style={styles.sectionSubtitle}>
            Tes submissions video les plus recentes.
          </Text>
          {!userId ? (
            <Text style={styles.empty}>Connecte-toi pour voir tes performances.</Text>
          ) : loading ? (
            <Text style={styles.empty}>Chargement...</Text>
          ) : responses.length === 0 ? (
            <Text style={styles.empty}>Aucune performance pour le moment.</Text>
          ) : (
            <View style={styles.responseGrid}>
              {responses.map((item) => (
                <View key={item.id} style={styles.responseCard}>
                  <Text style={styles.responseTitle}>
                    {item?.challenges?.title || `Defi #${item.challenge_id}`}
                  </Text>
                  <Text style={styles.responseMeta}>
                    {item?.challenges?.sport || "Sport"} -{" "}
                    {new Date(item.created_at).toLocaleDateString("fr-FR")}
                  </Text>
                  <View style={styles.responseVideo}>
                    <VideoPlayer
                      uri={item.video_url}
                      style={styles.responsePlayer}
                      contentFit="cover"
                      autoPlay={false}
                      shouldPlay={false}
                      allowUserToggle
                      showControlButton
                    />
                  </View>
                  <Text style={styles.responseMeta}>
                    Votes: {item.votes ?? 0} {item.is_winner ? "・ Winner" : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 80,
  },
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
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
  row: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  stat: {
    flex: 1,
    minWidth: 120,
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
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    ...TYPO.title,
    color: COLORS.text,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  empty: {
    color: COLORS.textMuted,
  },
  responseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  responseCard: {
    flex: 1,
    minWidth: 240,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: COLORS.surface,
  },
  responseTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  responseMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  responseVideo: {
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  responsePlayer: {
    width: "100%",
    minHeight: 160,
  },
});
