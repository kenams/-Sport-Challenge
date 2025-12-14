// src/screens/LiveHubScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Share,
  StyleSheet,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import AppButton from "../components/AppButton";
import { Challenge } from "../types";
import { fetchProfilesMap } from "../services/profile";
import { getDepartmentLabel } from "../utils/departments";
import { logEvent } from "../services/telemetry";
import { SPACING, SCREEN_PADDING } from "../utils/layout";
import { useSportTheme } from "../context/SportThemeContext";

type HighlightedChallenge = Challenge & {
  pseudo?: string | null;
  territory?: string | null;
};

type ScheduledLive = {
  id: number;
  title: string;
  scheduled_at: string;
  challenge_id: number;
  pseudo: string;
  territory?: string | null;
};

export default function LiveHubScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState<HighlightedChallenge[]>([]);
  const [scheduledLives, setScheduledLives] = useState<ScheduledLive[]>([]);
  const [filterTerritory, setFilterTerritory] = useState<"all" | "idf" | "tarn">(
    "all"
  );
  const [scheduling, setScheduling] = useState(false);
  const { palette, resolvedSport } = useSportTheme();

  const loadChallenges = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data, error }, { data: scheduled, error: scheduleError }] =
        await Promise.all([
          supabase
            .from("challenges")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("lives_schedule")
            .select("id,title,scheduled_at,challenge_id,user_id")
            .order("scheduled_at", { ascending: true }),
        ]);

      const parsed = (data as Challenge[]) || [];
      const profileMap = await fetchProfilesMap(parsed.map((c) => c.user_id));
      const enhanced = parsed.map((challenge) => {
        const profile = profileMap.get(challenge.user_id);
        return {
          ...challenge,
          pseudo:
            profile?.pseudo ||
            challenge.pseudo ||
            `Joueur ${challenge.user_id.slice(0, 6)}`,
          territory:
            getDepartmentLabel(profile?.department || "") ||
            profile?.department ||
            null,
        };
      });
      setChallenges(enhanced);

      if (scheduled && !scheduleError) {
        const scheduleProfiles = await fetchProfilesMap(
          scheduled.map((live) => live.user_id)
        );
        setScheduledLives(
          scheduled.map((live) => {
            const host = scheduleProfiles.get(live.user_id);
            return {
              id: live.id,
              title: live.title,
              scheduled_at: live.scheduled_at,
              challenge_id: live.challenge_id,
              pseudo:
                host?.pseudo || `Joueur ${live.user_id.slice(0, 6)}`,
              territory:
                getDepartmentLabel(host?.department || "") ||
                host?.department ||
                null,
            };
          })
        );
      } else {
        setScheduledLives([]);
      }
    } catch (err) {
      console.log("LIVE HUB LOAD ERROR", err);
      setChallenges([]);
      setScheduledLives([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const filteredChallenges = challenges.filter((challenge) => {
    if (filterTerritory === "all") return true;
    if (filterTerritory === "idf") {
      return (
        challenge.territory?.includes("75") ||
        challenge.territory?.includes("77") ||
        challenge.territory?.includes("78") ||
        challenge.territory?.includes("91") ||
        challenge.territory?.includes("92") ||
        challenge.territory?.includes("93") ||
        challenge.territory?.includes("94") ||
        challenge.territory?.includes("95")
      );
    }
    return challenge.territory?.includes("82");
  });

  const handleSchedulePrompt = (challenge: HighlightedChallenge) => {
    Alert.alert(
      "Programmer un live",
      "Choisis ton créneau",
      [
        { text: "Dans 15 min", onPress: () => handleSchedule(challenge, 15) },
        { text: "Dans 30 min", onPress: () => handleSchedule(challenge, 30) },
        {
          text: "Demain (même heure)",
          onPress: () => handleSchedule(challenge, 24 * 60),
        },
        { text: "Annuler", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const handleSchedule = async (
    challenge: HighlightedChallenge,
    offsetMinutes: number
  ) => {
    if (scheduling) return;
    try {
      setScheduling(true);
      const { data: ses } = await supabase.auth.getSession();
      const userId = ses.session?.user.id;
      if (!userId) {
        Alert.alert("Connexion requise");
        return;
      }
      const scheduledAt = new Date(Date.now() + offsetMinutes * 60000)
        .toISOString()
        .slice(0, 19);
      const { error } = await supabase.from("lives_schedule").insert({
        user_id: userId,
        title: challenge.title,
        challenge_id: challenge.id,
        scheduled_at: scheduledAt,
        reminder_sent: false,
      });
      if (error) throw error;
      await logEvent("live_programme", {
        challenge_id: challenge.id,
        scheduled_at: scheduledAt,
      });
      Alert.alert("Live programmé", "On te pingera 15 min avant.");
      await loadChallenges();
    } catch (err) {
      console.log("SCHEDULE ERROR", err);
      Alert.alert("Impossible de programmer ce live");
    } finally {
      setScheduling(false);
    }
  };

  const handleShareLive = async (challenge: HighlightedChallenge) => {
    try {
      const link = `https://immortal-k.app/live/${challenge.id}`;
      await Share.share({
        message: [
          `Je t'attends en live sur ${challenge?.sport || "?"}.`,
        `Défi : ${challenge.title}`,
        `Objectif : ${challenge.target_value} ${challenge.unit}`,
        `Territoire : ${challenge.territory || "?"}`,
        "",
        `Rejoins-moi : ${link}`,
      ].join("\n"),
    });
      await logEvent("live_share", {
        challenge_id: challenge.id,
      });
    } catch (err) {
      console.log("SHARE LIVE ERROR", err);
    }
  };

  const renderChallenge = (item: HighlightedChallenge) => (
    <View
      key={item.id}
      style={{
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        backgroundColor: COLORS.surface,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "800",
          color: COLORS.text,
          marginBottom: 4,
        }}
      >
        {item.title}
      </Text>
      <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
        Host : {item.pseudo}
      </Text>
      {item.territory && (
        <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
          Territoire : {item.territory}
        </Text>
      )}
      <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
        Objectif : {item.target_value} {item.unit}
      </Text>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        <AppButton
          label="Regarder"
          size="sm"
          onPress={() =>
            navigation.navigate("ChallengeDetail", { challengeId: item.id })
          }
          sport={item?.sport || undefined}
        />
        <AppButton
          label="Passer en live"
          size="sm"
          variant="ghost"
          onPress={() =>
            navigation.navigate("ArenaLive", { challengeId: item.id })
          }
          sport={item?.sport || undefined}
        />
        <AppButton
          label="Programmer"
          size="sm"
          variant="ghost"
          onPress={() => handleSchedulePrompt(item)}
          disabled={scheduling}
          sport={item?.sport || undefined}
        />
        <AppButton
          label="Partager"
          size="sm"
          variant="ghost"
          onPress={() => handleShareLive(item)}
          sport={item?.sport || undefined}
        />

      </View>
    </View>
  );

  return (
    <ScreenContainer sport={resolvedSport || undefined}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: palette.text,
            marginBottom: 8,
          }}
        >
          Hub Arena Live
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            marginBottom: 16,
          }}
        >
          Programme ton live, invite ton crew, surveille les sessions rivales.
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderRadius: 18,
            borderColor: palette.border,
            padding: 16,
            marginBottom: 18,
            backgroundColor: palette.card,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: palette.text,
              marginBottom: 6,
            }}
          >
            Lancer un live
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
            Choisis ton défi, annonce la couleur et partage le lien.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <AppButton
              label="Choisir un défi"
              onPress={() =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: "MainTabs", params: { screen: "Defis" } }],
                })
              }
            />
            <AppButton
              label="Historique Arena"
              variant="ghost"
              onPress={() => navigation.navigate("ArenaHistory")}
            />
          </View>
        </View>

        <View
          style={{
            borderWidth: 1,
            borderRadius: 18,
            borderColor: palette.border,
            padding: 16,
            marginBottom: 18,
            backgroundColor: palette.card,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: palette.text,
              marginBottom: 6,
            }}
          >
            Lives en vue
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 12 }}>
            Les derniers défis prêts à passer en live. On clique, on rejoint ou
            on provoque.
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            {[
              { key: "all", label: "Tous" },
              { key: "idf", label: "Île-de-France" },
              { key: "tarn", label: "Tarn-et-Garonne" },
            ].map((filter) => {
              const active = filterTerritory === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setFilterTerritory(filter.key as any)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? COLORS.primary : COLORS.border,
                    backgroundColor: active ? COLORS.primary : "transparent",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#050505" : COLORS.text,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <View
              style={{
                paddingVertical: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : filteredChallenges.length === 0 ? (
            <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
              Personne n'a encore annoncé de live. Sois le premier à allumer
              l'arène.
            </Text>
          ) : (
            filteredChallenges.map(renderChallenge)
          )}
        </View>

        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            backgroundColor: "#111827",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: COLORS.text,
              marginBottom: 6,
            }}
          >
            Lives programmés
          </Text>
          {scheduledLives.length === 0 ? (
            <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
              Aucun live programmé. Clique sur “Programmer” pour annoncer ton
              créneau.
            </Text>
          ) : (
            scheduledLives.map((live) => (
              <View
                key={live.id}
                style={{
                  marginBottom: 10,
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#020617",
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontWeight: "800",
                    marginBottom: 4,
                  }}
                >
                  {live.title}
                </Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                  Host : {live.pseudo}
                </Text>
                {live.territory && (
                  <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                    Territoire : {live.territory}
                  </Text>
                )}
                <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                  Créneau :{" "}
                  {new Date(live.scheduled_at).toLocaleString("fr-FR")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <AppButton
                    label="Voir le défi"
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      navigation.navigate("ChallengeDetail", {
                        challengeId: live.challenge_id,
                      })
                    }
                  />
                  <AppButton
                    label="Go Live"
                    size="sm"
                    onPress={() =>
                      navigation.navigate("ArenaLive", {
                        challengeId: live.challenge_id,
                      })
                    }
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate("ArenaLive", { mode: "simulation" })
          }
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 18,
            padding: 16,
            backgroundColor: "#111827",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: COLORS.text,
              marginBottom: 6,
            }}
          >
            Mode démo
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 10 }}>
            Pas encore prêt à te lancer ? Teste la simulation pour comprendre
            les repères.
          </Text>
          <AppButton
            label="Tester Arena Live"
            onPress={() =>
              navigation.navigate("ArenaLive", { mode: "simulation" })
            }
          />
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
