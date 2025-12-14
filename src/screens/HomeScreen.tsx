// src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import {
  Challenge,
  UserProfile,
  GenderValue,
  RouletteDuel,
} from "../types";
import ChallengeCard from "../components/ChallengeCard";
import AnimatedPress from "../components/AnimatedPress";
import AppButton from "../components/AppButton";
import SportTag from "../components/SportTag";
import { COLORS, getSportPalette, SportPalette } from "../theme";
import { feedbackTap, playSportFeedback } from "../utils/feedback";
import { fetchProfilesMap } from "../services/profile";
import { getDepartmentLabel } from "../utils/departments";
import {
  groupChallengesByDomain,
  ChallengeSection,
} from "../utils/sports";
import FairPlayAlert from "../components/FairPlayAlert";
import { ARENA_FAIR_PLAY_THRESHOLD } from "../services/arenaLive";
import { getFairPlayTier } from "../utils/fairPlay";
import { useSportTheme } from "../context/SportThemeContext";
import RouletteBanner from "../components/RouletteBanner";
import { fetchRouletteAssignments } from "../services/roulette";

const HomeScreen = ({ navigation }: any) => {
  console.log("HomeScreen render — aggressive theme active");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, UserProfile>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fairPlayScore, setFairPlayScore] = useState<number | null>(null);
  const [playerLevel, setPlayerLevel] = useState<number | null>(null);
  const [playerGender, setPlayerGender] = useState<GenderValue>("male");
  const [allowMixedChallenges, setAllowMixedChallenges] = useState(true);
  const [allowInterDepartment, setAllowInterDepartment] = useState(true);
  const [playerDepartment, setPlayerDepartment] = useState("75");
  const [showRivalryIntro, setShowRivalryIntro] = useState(false);
  const [rouletteDuels, setRouletteDuels] = useState<RouletteDuel[]>([]);
  const [rouletteProfiles, setRouletteProfiles] = useState<
    Map<string, UserProfile>
  >(new Map());
  const [rouletteLoading, setRouletteLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const {
    palette: themePalette,
    setActiveSport,
    resolvedSport,
  } = useSportTheme();
  const selectedDomain = resolvedSport || null;

  const loadChallenges = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.log("HOME LOAD ERROR", error);
        setChallenges([]);
        setProfilesMap(new Map());
      } else if (data) {
        const parsed = data as Challenge[];
        setChallenges(parsed);

        const map = await fetchProfilesMap(parsed.map((c) => c.user_id));
        setProfilesMap(map);
      }
    } catch (e) {
      console.log("HOME LOAD EXCEPTION", e);
      setChallenges([]);
      setProfilesMap(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const fetchPlayerContext = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    const metaGender =
      (sessionData.session?.user?.user_metadata?.gender as GenderValue) ||
      "male";
    const metaAllowMixed =
      typeof sessionData.session?.user?.user_metadata?.allowMixed === "boolean"
        ? (sessionData.session?.user?.user_metadata?.allowMixed as boolean)
        : true;
    const metaDepartment =
      typeof sessionData.session?.user?.user_metadata?.department === "string"
        ? (sessionData.session?.user?.user_metadata?.department as string)
        : "75";
    const metaAllowInterDept =
      typeof sessionData.session?.user?.user_metadata?.allowInterDept ===
      "boolean"
        ? (sessionData.session?.user?.user_metadata?.allowInterDept as boolean)
        : true;
    const seenRivalryCoach =
      sessionData.session?.user?.user_metadata?.seenRivalryCoach === true;
    setShowRivalryIntro(!seenRivalryCoach);
    setPlayerGender(metaGender);
    setAllowMixedChallenges(metaAllowMixed);
    setAllowInterDepartment(metaAllowInterDept);
    setPlayerDepartment(metaDepartment);
    setCurrentUserId(uid || null);
    if (!uid) {
      setRouletteDuels([]);
      setRouletteProfiles(new Map());
      return;
    }
    const { data } = await supabase
      .from("players_stats")
      .select("fair_play_score, level")
      .eq("user_id", uid)
      .maybeSingle();
    if (data) {
      setFairPlayScore((data as any).fair_play_score ?? null);
      setPlayerLevel((data as any).level ?? null);
    }
  }, []);

  const loadRouletteAssignments = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setRouletteLoading(true);
      const { duels, profilesMap } = await fetchRouletteAssignments(
        currentUserId
      );
      setRouletteDuels(duels);
      setRouletteProfiles(profilesMap);
    } catch (err) {
      console.log("ROULETTE ASSIGNMENTS ERROR", err);
    } finally {
      setRouletteLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchPlayerContext();
  }, [fetchPlayerContext]);

  useEffect(() => {
    loadRouletteAssignments();
  }, [loadRouletteAssignments]);

  useFocusEffect(
    useCallback(() => {
      fetchPlayerContext();
      loadRouletteAssignments();
    }, [fetchPlayerContext, loadRouletteAssignments])
  );

  const handleDismissRivalryIntro = async () => {
    setShowRivalryIntro(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      await supabase.auth.updateUser({
        data: {
          ...sessionData.session.user.user_metadata,
          seenRivalryCoach: true,
        },
      });
    } catch (err) {
      console.log("RIVALRY INTRO DISMISS ERROR", err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChallenges();
    await loadRouletteAssignments();
    setRefreshing(false);
  };

  const handleOpenDetail = (challenge: Challenge) => {
    feedbackTap();
    const requiredLevel = challenge.min_level || challenge.level_required || 1;
    const currentLevel = playerLevel ?? 1;
    const meetsLevel = currentLevel >= requiredLevel;
    const meetsFairPlay =
      (fairPlayScore ?? 100) >= ARENA_FAIR_PLAY_THRESHOLD;

    if (!meetsLevel || !meetsFairPlay) {
      const reason = !meetsLevel
        ? `Niveau ${requiredLevel} requis (actuel ${currentLevel}).`
        : `Fair-play requis ${ARENA_FAIR_PLAY_THRESHOLD}+ (actuel ${
            fairPlayScore ?? "?"
          }).`;
      Alert.alert(
        "Encore un effort",
        `${reason}\nAtteins les objectifs coach ou prends ta récompense quotidienne pour progresser.`,
        [
          {
            text: "Monter de niveau",
            onPress: () => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Coach"}}]}),
          },
          {
            text: "Boutique / Quête quotidienne",
            onPress: () => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Boutique"}}]}),
          },
          {
            text: "Voir quand même",
            onPress: () =>
              navigation.navigate("ChallengeDetail", {
                challengeId: challenge.id,
              }),
          },
        ]
      );
      return;
    }

    const ownerProfile = profilesMap.get(challenge.user_id);
    const challengeGender = ownerProfile?.gender as GenderValue | undefined;
    const ownerDepartment = ownerProfile?.department;
    const ownerDepartmentLabel = getDepartmentLabel(ownerDepartment);
    const mismatchedGender =
      !allowMixedChallenges &&
      !!challengeGender &&
      challengeGender !== playerGender;
    const crossDepartment =
      !!ownerDepartment &&
      !!playerDepartment &&
      ownerDepartment !== playerDepartment;
    const blockedDepartment = !allowInterDepartment && crossDepartment;

    if (mismatchedGender) {
      Alert.alert(
        "Ligue différente",
        "Ce défi est associé à une ligue différente de la tienne. Active le mode mixte dans ton profil pour viser tout le monde.",
        [
          {
            text: "Ajuster mes préférences",
            onPress: () => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Profil"}}]}),
          },
          {
            text: "Défier quand même",
            onPress: () =>
              navigation.navigate("ChallengeDetail", {
                challengeId: challenge.id,
              }),
          },
          { text: "Plus tard", style: "cancel" },
        ]
      );
      return;
    }

    if (blockedDepartment) {
      Alert.alert(
        "Rivalité territoriale",
        `Tu représentes ${
          playerTerritoryLabel || playerDepartment
        }, ce défi est tenu par ${ownerDepartmentLabel || ownerDepartment}. Active les duels inter-territoires pour les provoquer plus souvent.`,
        [
          {
            text: "Ouvrir mes préférences",
            onPress: () => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Profil"}}]}),
          },
          {
            text: "Défier quand même",
            onPress: () =>
              navigation.navigate("ChallengeDetail", {
                challengeId: challenge.id,
              }),
          },
          { text: "Plus tard", style: "cancel" },
        ]
      );
      return;
    }

    navigation.navigate("ChallengeDetail", { challengeId: challenge.id });
  };

  const rewardShare = async (challenge: Challenge) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      const currentCoins = wallet ? (wallet as any).coins || 0 : 0;
      const reward = 2;
      const newCoins = currentCoins + reward;

      await supabase
        .from("wallets")
        .upsert({ user_id: userId, coins: newCoins });
      await supabase.from("wallet_logs").insert({
        user_id: userId,
        delta: reward,
        balance_after: newCoins,
        reason: `Partage ${challenge.title}`,
      });
      await supabase.from("activities").insert({
        user_id: userId,
        type: "heat_share",
        challenge_id: challenge.id,
        message: `Partage social sur ${challenge.title}`,
      });
    } catch (err) {
      console.log("SHARE REWARD ERROR", err);
    }
  };

  const handleShare = async (challenge: Challenge) => {
    try {
      feedbackTap();

      const message = [
        `Viens me chercher sur ${challenge?.sport || "?"} !`,
        "",
        `Titre : ${challenge.title}`,
        `Objectif : ${challenge.target_value} ${challenge.unit}`,
        "",
        "IMMORTAL-K - on règle ça en vidéo, pas en DM.",
      ].join("\n");

      const result = await Share.share({ message });
      if (result.action === Share.sharedAction) {
        await rewardShare(challenge);
      }
    } catch (e) {
      console.log("SHARE ERROR", e);
    }
  };

  const handleDomainPress = useCallback(
    (sportKey: string, isActive: boolean) => {
      const nextSport = isActive ? null : sportKey;
      setActiveSport(nextSport);
      if (nextSport) {
        playSportFeedback(nextSport);
      } else {
        feedbackTap();
      }
    },
    [setActiveSport]
  );

  const handleRouletteAction = useCallback(
    (duel: RouletteDuel, opponentId: string) => {
      if (!duel || !opponentId) return;
      if (duel.challenge_id && duel.status !== "penalized") {
        navigation.navigate("ChallengeDetail", {
          challengeId: duel.challenge_id,
        });
        return;
      }
      const opponent = rouletteProfiles.get(opponentId);
      navigation.navigate("CreateChallenge", {
        rouletteDuelId: duel.id,
        rouletteSport: duel.sport,
        rouletteOpponent: opponentId,
        rouletteOpponentPseudo:
          opponent?.pseudo ||
          `Joueur ${opponentId.slice(0, 4)}...${opponentId.slice(-2)}`,
      });
    },
    [navigation, rouletteProfiles]
  );

  const showRouletteRules = useCallback(() => {
    Alert.alert(
      "Roulette russe",
      "Chaque lundi matin, l'app sélectionne des duels au hasard entre joueurs de niveau proche. Tu dois publier ta vidéo avant la deadline ou tu perds automatiquement 10 points de fair-play et 20 points de classement."
    );
  }, []);

  const renderItem = ({ item }: { item: Challenge }) => {
    const palette = getSportPalette(item?.sport || "");
    const requiredLevel = item.min_level || item.level_required || 1;
    const currentLevel = playerLevel ?? 1;
    const canPlay = currentLevel >= requiredLevel;
    const ownerProfile = profilesMap.get(item.user_id);
    const ownerGender = ownerProfile?.gender as GenderValue | undefined;
    const ownerDept = ownerProfile?.department;
    const genderMismatch =
      !allowMixedChallenges &&
      !!ownerGender &&
      playerGender !== ownerGender;
    const crossDepartment =
      !!ownerDept &&
      !!playerDepartment &&
      ownerDept !== playerDepartment;
    const departmentBlocked = !allowInterDepartment && crossDepartment;
    const ownerDepartmentLabel = getDepartmentLabel(ownerDept);
    const availabilityLabel = genderMismatch
      ? "Autre ligue"
      : departmentBlocked
      ? "Autre territoire"
      : canPlay
      ? "Accessible maintenant"
      : "Encore un effort";
    const availabilityColor =
      genderMismatch || departmentBlocked
        ? COLORS.danger
        : canPlay
        ? COLORS.success
        : COLORS.danger;

    return (
      <View style={styles.challengeWrapper}>
        <AnimatedPress onPress={() => handleOpenDetail(item)}>
          <ChallengeCard
            challenge={item}
            profile={ownerProfile || undefined}
          />
        </AnimatedPress>

        <View style={styles.challengeMeta}>
          <View style={styles.challengeMetaRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.metaLabel,
                  { color: availabilityColor },
                ]}
              >
                {availabilityLabel}
              </Text>
              <Text style={styles.metaValue}>
                {genderMismatch
                  ? `Défi créé côté ${
                      ownerGender === "female" ? "ligue Femme" : "ligue Homme"
                    }`
                  : departmentBlocked
                  ? `Territoire ${ownerDepartmentLabel || ownerDept} domine pour l'instant`
                  : `Niveau requis ${requiredLevel} • Niveau actuel ${currentLevel}`}
              </Text>
              {item.bet_enabled && (
                <Text style={styles.metaValue}>
                  Mise : {(item as any).bet_amount} coins
                </Text>
              )}
              {ownerDepartmentLabel && (
                <Text style={styles.metaValue}>
                  Territoire leader : {ownerDepartmentLabel} ({ownerProfile?.department})
                </Text>
              )}
              {departmentBlocked && (
                <Text style={styles.metaValue}>
                  Active les rivalités inter-territoires pour viser {ownerDepartmentLabel || ownerDept}.
                </Text>
              )}
              {genderMismatch && (
                <Text style={styles.metaValue}>
                  Active le mode mixte pour viser tout le monde.
                </Text>
              )}
            </View>
              <SportTag sport={item?.sport || ""} />
          </View>

          {!canPlay && (
            <AppButton
              label="Monter de niveau"
              variant="ghost"
              onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Coach"}}]})}
              style={{ marginTop: 10 }}
              sport={item?.sport || undefined}
            />
          )}
          {departmentBlocked && (
            <AppButton
              label="Activer inter-territoires"
              variant="ghost"
              onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Profil"}}]})}
              style={{ marginTop: 10 }}
              sport={item?.sport || undefined}
            />
          )}
          {genderMismatch && (
            <AppButton
              label="Activer le mode mixte"
              variant="ghost"
              onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Profil"}}]})}
              style={{ marginTop: 10 }}
              sport={item?.sport || undefined}
            />
          )}
          <View style={styles.challengeActions}>
            <AppButton
              label="Partager"
              variant="ghost"
              size="sm"
              color={palette.accent}
              textColor={palette.text}
              onPress={() => handleShare(item)}
            />
            <AppButton
              label="Voir +"
              size="sm"
              color={palette.accent}
              textColor={palette.text}
              onPress={() => handleOpenDetail(item)}
            />
          </View>
        </View>
      </View>
    );
  };

  const fairPlayTier =
    typeof fairPlayScore === "number"
      ? getFairPlayTier(fairPlayScore)
      : null;

  const playerTerritoryLabel =
    getDepartmentLabel(playerDepartment) || playerDepartment;

  const departmentScores = useMemo(() => {
    const counts: Record<string, number> = {};
    challenges.forEach((challenge) => {
      const profile = profilesMap.get(challenge.user_id);
      const dep = profile?.department;
      if (!dep) return;
      if (!counts[dep]) counts[dep] = 0;
      counts[dep] += 1;
    });
    return counts;
  }, [challenges, profilesMap]);

    const renderHeader = () => (
      <View style={{ marginBottom: 20 }}>
        {currentUserId && (
          <RouletteBanner
            duels={rouletteDuels}
            currentUserId={currentUserId}
            profilesMap={rouletteProfiles}
            loading={rouletteLoading}
            onPressDuel={handleRouletteAction}
            onShowRules={showRouletteRules}
          />
        )}
        <View
          style={[
            styles.questCard,
            {
              borderColor: themePalette.border,
              backgroundColor: themePalette.card,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.questTitle}>Pas au niveau ?</Text>
            <Text style={styles.questSubtitle}>
            Boucle les ordres du coach et chope ta récompense du jour pour
            grimper plus vite que les autres.
          </Text>
        </View>
        <View style={styles.questButtons}>
          <AppButton
            label="Quêtes coach"
            size="sm"
            variant="ghost"
            onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Coach"}}]})}
          />
          <AppButton
            label="Récompense quotidienne"
            size="sm"
            variant="ghost"
            onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Boutique"}}]})}
          />
        </View>
      </View>
        <View
          style={[
            styles.liveCard,
            {
              borderColor: themePalette.border,
              backgroundColor: themePalette.card,
            },
          ]}
        >
        <View style={{ flex: 1 }}>
          <Text style={styles.liveTitle}>Arena Live en accès direct</Text>
          <Text style={styles.liveSubtitle}>
            Lance ta session ou rejoins un live en cours. Chaque minute compte.
          </Text>
        </View>
        <AppButton
          label="Page Live"
          onPress={() => navigation.navigate("LiveHub")}
          style={{ marginTop: 10 }}
            sport={selectedDomain || undefined}
          />
      </View>
        <View
          style={[
            styles.heroCard,
            {
              borderColor: themePalette.border,
              backgroundColor: themePalette.card,
            },
          ]}
        >
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Défis brûlants</Text>
          <Text style={styles.heroSubtitle}>
            Sélection taillée pour ton terrain, pas de place pour les touristes.
          </Text>
          <View style={styles.heroBadges}>
            <View style={styles.heroBadge}>
              <Text style={styles.badgeValue}>
                {challenges.length.toString().padStart(2, "0")}
              </Text>
              <Text style={styles.badgeLabel}>defis actifs</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.badgeValue}>100%</Text>
              <Text style={styles.badgeLabel}>videos reelles</Text>
            </View>
            {fairPlayTier && (
              <View style={styles.heroBadge}>
                <Text
                  style={[
                    styles.badgeValue,
                    { color: fairPlayTier.color },
                  ]}
                >
                  {fairPlayTier.label}
                </Text>
                <Text style={styles.badgeLabel}>Fair-play</Text>
              </View>
            )}
          </View>
        </View>
            <View style={styles.heroCTA}>
              <Text style={styles.heroCTAtext}>Balance le feu 🔥</Text>
            </View>
      </View>
      <View style={styles.heroLinksContainer}>
        <TouchableOpacity
          onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Coach"}}]})}
          style={styles.heroLink}
        >
          <Text style={styles.heroLinkText}>Dash Impitoyable</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("ArenaHistory")}
          style={styles.heroLink}
        >
          <Text style={styles.heroLinkText}>Historique Arena</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("ArenaChallenges")}
          style={styles.heroLink}
        >
          <Text style={styles.heroLinkText}>Défis Arena</Text>
        </TouchableOpacity>
      </View>
      {showRivalryIntro && (
        <View style={styles.onboardingCard}>
          <Text style={styles.onboardingTitle}>Briefing Coach Rivalité</Text>
          <Text style={styles.onboardingText}>
            Pose ton drapeau (Profil) et défends-le : Île-de-France face au
            Tarn-et-Garonne. Active les duels inter-territoires pour aller
            provoquer qui tu veux, quand tu veux.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <AppButton
              label="Régler mon camp"
              variant="ghost"
              size="sm"
              onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Profil"}}]})}
            />
            <AppButton
              label="Compris"
              size="sm"
              onPress={handleDismissRivalryIntro}
            />
          </View>
        </View>
      )}

      <View
        style={[
          styles.preferenceBanner,
          {
            borderColor: themePalette.border,
            backgroundColor: themePalette.card,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.preferenceTitle, { color: themePalette.text }]}
          >
            Mode {allowMixedChallenges ? "mixte" : "ligue dédiée"}
          </Text>
          <Text
            style={[
              styles.preferenceSubtitle,
              { color: themePalette.text },
            ]}
          >
            {allowMixedChallenges
              ? "Tu peux défier tout le monde. Ajuste dans ton profil si tu veux te concentrer sur ta ligue."
              : `On te présente d'abord les défis ${
                  playerGender === "female" ? "Femme" : "Homme"
                }. Active le mixte pour viser tout le monde.`}
          </Text>
          <Text
            style={[
              styles.preferenceSubtitle,
              { color: themePalette.text },
            ]}
          >
            {allowInterDepartment
              ? `Rivalité ouverte : tous les territoires peuvent te provoquer (tu représentes ${
                  playerTerritoryLabel || playerDepartment
                }).`
              : `Mode local : priorité à ${
                  playerTerritoryLabel || playerDepartment
                }. Active inter-territoires pour provoquer les voisins.`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Profil"}}]})}
          style={[
            styles.preferenceButton,
            {
              borderColor: themePalette.border,
              backgroundColor: themePalette.background,
            },
          ]}
        >
          <Text
            style={[styles.preferenceButtonText, { color: themePalette.text }]}
          >
            Modifier
          </Text>
        </TouchableOpacity>
      </View>
      <DepartmentBattleHeader
        playerDepartment={playerDepartment}
        scores={departmentScores}
        onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Classement"}}]})}
        palette={themePalette}
      />
      <Text
        style={{
          marginTop: 8,
          color: themePalette.text,
          fontSize: 12,
        }}
      >
        COACH & Motivé : impose ton style sur chaque défi.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 14 }}
      >
          {featuredSports.map((sport) => {
            const palette = getSportPalette(sport.key);
            const isActive = selectedDomain === sport.key;
            return (
              <TouchableOpacity
                key={sport.key}
                onPress={() => handleDomainPress(sport.key, isActive)}
                activeOpacity={0.9}
              >
              <View
                style={[
                  styles.sportChip,
                  {
                    borderColor: palette.accent,
                    backgroundColor: isActive
                      ? palette.accent
                      : palette.background,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isActive ? "#050505" : palette.accent,
                    fontWeight: "800",
                    fontSize: 13,
                  }}
                >
                  {sport.label}
                </Text>
                <Text
                  style={{
                    color: isActive ? "#050505" : palette.text,
                    fontSize: 11,
                  }}
                >
                  {sport.tagline}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
        {typeof fairPlayScore === "number" && (
          <FairPlayAlert
            score={fairPlayScore}
            threshold={ARENA_FAIR_PLAY_THRESHOLD}
            message="Tu es sous surveillance. Remonte ton fair-play pour accéder à l'Arena."
            onCtaPress={() =>
              navigation.navigate("FairPlayHelp")
            }
            sport={selectedDomain || undefined}
            paletteOverride={themePalette}
          />
        )}
    </View>
  );

  const sections: ChallengeSection[] = useMemo(
    () => groupChallengesByDomain(challenges),
    [challenges]
  );

  const displayedSections = useMemo(() => {
    if (!selectedDomain) return sections;
    return sections.filter((section) => section.domain.key === selectedDomain);
  }, [sections, selectedDomain]);

  const renderSectionHeader = ({
    section,
  }: {
    section: ChallengeSection;
  }) => {
    const palette = getSportPalette(section.domain.paletteKey);
    return (
      <View
        style={[
          styles.sectionHeader,
          {
            borderColor: palette.border,
            backgroundColor: palette.background,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {section.domain.label}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: palette.text }]}>
          {section.domain.tagline}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <SectionList
        sections={displayedSections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={{ marginTop: 40, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 14,
                color: COLORS.textMuted,
                textAlign: "center",
              }}
            >
              Aucun defi pour cette categorie.
            </Text>
            {selectedDomain && (
                <TouchableOpacity
                  style={{ marginTop: 8 }}
                  onPress={() => {
                    setActiveSport(null);
                    feedbackTap();
                  }}
                >
                  <Text style={{ color: COLORS.primary, fontWeight: "700" }}>
                    Retirer le filtre
                  </Text>
                </TouchableOpacity>
            )}
          </View>
        }
      />
    </ScreenContainer>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  challengeWrapper: {
    marginBottom: 16,
  },
  challengeMeta: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  challengeMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  metaValue: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  challengeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 18,
    flexDirection: "row",
    gap: 16,
  },
  questCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 16,
    marginBottom: 16,
  },
  questTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  questSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  questButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
  },
  heroSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  heroBadges: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  heroBadge: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
  },
  badgeValue: {
    color: COLORS.neonYellow,
    fontSize: 16,
    fontWeight: "900",
  },
  badgeLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  heroCTA: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heroCTAtext: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroCTAHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: "right",
  },
  heroLinksContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  heroLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
  },
  heroLinkText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  preferenceBanner: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  preferenceTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  preferenceSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  preferenceButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  preferenceButtonText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  liveCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  liveTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 6,
  },
  liveSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  onboardingCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  onboardingTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 6,
  },
  onboardingText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  rivalryCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rivalryTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  rivalrySubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  rivalryCTA: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  sectionHeader: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  sportChip: {
    marginRight: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 140,
  },
});
const featuredSports = [
  { key: "basket", label: "Basket", tagline: "Impact orange" },
  { key: "piscine", label: "Aqua", tagline: "Precision bleue" },
  { key: "muscu", label: "Muscu", tagline: "Acier & sueur" },
  { key: "running", label: "Course", tagline: "Flow rapide" },
];

type DepartmentBattleProps = {
  playerDepartment: string;
  scores: Record<string, number>;
  onPress: () => void;
  palette: SportPalette;
};

function DepartmentBattleHeader({
  playerDepartment,
  scores,
  onPress,
  palette,
}: DepartmentBattleProps) {
  const playerLabel =
    getDepartmentLabel(playerDepartment) || playerDepartment;
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const leader = sorted[0];
  const playerScore = scores[playerDepartment] || 0;
  const leaderLabel = leader
    ? `${leader[0]} (${getDepartmentLabel(leader[0]) || "?"})`
    : "Aucun leader";
  const leaderScore = leader ? leader[1] : 0;

  return (
    <TouchableOpacity
      style={[
        styles.rivalryCard,
        { borderColor: palette.border, backgroundColor: palette.card },
      ]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rivalryTitle, { color: palette.text }]}>
          Rivalité Île-de-France / Tarn-et-Garonne
        </Text>
        <Text
          style={[styles.rivalrySubtitle, { color: palette.text }]}
        >
          Ton territoire : {playerLabel} • score {playerScore}
        </Text>
        <Text
          style={[styles.rivalrySubtitle, { color: palette.text }]}
        >
          Leader actuel : {leaderLabel} ({leaderScore} défis)
        </Text>
      </View>
      <Text style={[styles.rivalryCTA, { color: palette.accent }]}>Voir</Text>
    </TouchableOpacity>
  );
}
