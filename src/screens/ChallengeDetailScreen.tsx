// src/screens/ChallengeDetailScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Button,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import { Video, ResizeMode } from "expo-av";

import ScreenContainer from "../components/ScreenContainer";
import SportTag from "../components/SportTag";
import UserAvatar from "../components/UserAvatar";
import AppButton from "../components/AppButton";
import { supabase } from "../supabase";
import { COLORS, getSportPalette } from "../theme";
import { Challenge, ChallengeResponse, Battle, UserProfile } from "../types";
import { getSportDomain } from "../utils/sports";
import {
  feedbackError,
  feedbackSuccess,
  feedbackTap,
} from "../utils/feedback";
import { fetchProfilesMap } from "../services/profile";
import { logEvent } from "../services/telemetry";
import { getDepartmentLabel } from "../utils/departments";

type Props = {
  route: { params: { challengeId: number } };
  navigation: any;
};

export default function ChallengeDetailScreen({ route, navigation }: Props) {
  const { challengeId } = route.params;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [responses, setResponses] = useState<ChallengeResponse[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserLevel, setCurrentUserLevel] = useState<number>(1);
  const [backToBackLoading, setBackToBackLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profilesMap, setProfilesMap] = useState<Map<string, UserProfile>>(
    new Map()
  );

  const palette = getSportPalette(challenge?.sport || "");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // session
      const { data: ses } = await supabase.auth.getSession();
      const authUserId = ses.session ? ses.session.user.id : null;
      setCurrentUserId(authUserId);
      if (authUserId) {
        const { data: statsRow } = await supabase
          .from("players_stats")
          .select("level")
          .eq("user_id", authUserId)
          .maybeSingle();
        setCurrentUserLevel((statsRow as any)?.level || 1);
      } else {
        setCurrentUserLevel(1);
      }

      // defi
      const { data: chData, error: chError } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single();

      if (chError) {
        console.log("CHALLENGE DETAIL ERROR", chError);
        setChallenge(null);
      }

      let loadedChallenge: Challenge | null = null;

      if (chData) {
        loadedChallenge = chData as Challenge;
        setChallenge(loadedChallenge);
      }

      // reponses
      const { data: respData, error: respError } = await supabase
        .from("challenge_responses")
        .select("*")
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: true });

      if (respError) {
        console.log("RESPONSES ERROR", respError);
        setResponses([]);
      } else if (respData) {
        setResponses(respData as ChallengeResponse[]);
      }
      const loadedResponses = (respData as ChallengeResponse[]) || [];

      // battles liees
      const { data: battlesData, error: battlesError } = await supabase
        .from("battles")
        .select("*")
        .eq("challenge_id", challengeId);

      if (battlesError) {
        console.log("BATTLES ERROR", battlesError);
        setBattles([]);
      } else if (battlesData) {
        setBattles(battlesData as Battle[]);
      }

      const userIds: string[] = [];
      if (loadedChallenge) {
        userIds.push(loadedChallenge.user_id);
      }
      loadedResponses.forEach((resp) => userIds.push(resp.user_id));

      const profileMap = await fetchProfilesMap(userIds);
      setProfilesMap(profileMap);
    } catch (e) {
      console.log("DETAIL LOAD EXCEPTION", e);
      setProfilesMap(new Map());
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isOwner =
    !!challenge && !!currentUserId && challenge.user_id === currentUserId;

  const handleShare = async () => {
    if (!challenge) return;
    try {
      feedbackTap();
      const message = [
        ` Fight ${challenge?.sport || "?"} en cours`,
        "",
        `Titre : ${challenge.title}`,
        `Description : ${challenge.description}`,
        `Objectif : ${challenge.target_value} ${challenge.unit}`,
        "",
        "IMMORTAL-K - viens te mesurer en vidéo, pas de blabla.",
      ].join("\n");

      await Share.share({ message });
    } catch (e) {
      console.log("DETAIL SHARE ERROR", e);
    }
  };

  const handleOpenArenaLive = () => {
    if (!challenge) return;
    if (liveLocked) {
      Alert.alert(
        "Niveau insuffisant",
        `Mode Arena Live disponible a partir du niveau ${LIVE_MIN_LEVEL}.`
      );
      return;
    }
    navigation.navigate("ArenaLive", { challengeId: challenge.id });
  };

  const handleOpenArenaSimulation = () => {
    if (!challenge) return;
    navigation.navigate("ArenaLive", {
      challengeId: challenge.id,
      mode: "simulation",
      role: "host",
    });
  };

  const handleChooseWinner = async (response: ChallengeResponse) => {
    if (!challenge || !currentUserId || !isOwner) {
      return;
    }

    try {
      feedbackTap();

      const ownerProfileCached = profilesMap.get(challenge.user_id);
      const responderProfile = profilesMap.get(response.user_id);
      const responderName =
        responderProfile?.pseudo ||
        response.pseudo ||
        `Joueur ${response.user_id.slice(0, 8)}`;

      // trouver une battle existante entre createur et ce challenger
      let battle = battles.find(
        (b) => b.player2_id === response.user_id && !b.completed
      );

      // si pas de battle -> en creer une si pari
      const isBet =
        !!(challenge as any).bet_enabled &&
        ((challenge as any).bet_amount || 0) > 0;
      const betAmount = (challenge as any).bet_amount || 0;
      const totalAmount = isBet ? betAmount * 2 : 0;
      const commission = isBet ? Math.floor(totalAmount * 0.1) : 0;

      if (!battle) {
        const { data: newBattle, error: insertError } = await supabase
          .from("battles")
          .insert({
            challenge_id: challengeId,
            player1_id: challenge.user_id,
            player2_id: response.user_id,
            amount: totalAmount,
            commission,
          })
          .select("*")
          .single();

        if (insertError) {
          console.log("BATTLE INSERT ERROR", insertError);
          feedbackError();
          Alert.alert(
            "Erreur",
            "Impossible de creer une battle pour ce defi."
          );
          return;
        }

        battle = newBattle as Battle;
      }

      // mettre a jour la battle avec gagnant/perdant
      const { error: updError } = await supabase
        .from("battles")
        .update({
          winner_id: response.user_id,
          loser_id: challenge.user_id,
          completed: true,
        })
        .eq("id", battle.id);

      if (updError) {
        console.log("UPDATE BATTLE ERROR", updError);
        feedbackError();
        Alert.alert("Erreur", "Impossible d'enregistrer le gagnant.");
        return;
      }

      // si pari -> distribuer les coins au gagnant
      if (isBet) {
        const effectiveTotal =
          battle.amount && battle.amount > 0 ? battle.amount : totalAmount;
        const effectiveCommission =
          battle.commission && battle.commission > 0
            ? battle.commission
            : commission;
        const prize = Math.max(effectiveTotal - effectiveCommission, 0);

        const { data: winnerWallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", response.user_id)
          .maybeSingle();

        if (winnerWallet) {
          const currentCoins = (winnerWallet as any).coins || 0;
          const { error: walletUpdError } = await supabase
            .from("wallets")
            .update({ coins: currentCoins + prize })
            .eq("user_id", response.user_id);

          if (walletUpdError) {
            console.log("WINNER WALLET UPDATE ERROR", walletUpdError);
          }
        } else {
          const { error: walletInsError } = await supabase
            .from("wallets")
            .insert({ user_id: response.user_id, coins: prize });

          if (walletInsError) {
            console.log("WINNER WALLET INSERT ERROR", walletInsError);
          }
        }

        // bonus de points pour le gagnant
        const { error: bonusError } = await supabase.rpc("add_points", {
          p_user_id: response.user_id,
          p_points: 50,
        });
        if (bonusError) {
          console.log("ADD_POINTS ERROR", bonusError);
        }
      }

      // punition du createur (perdant)
      const { error: punishError } = await supabase.from("punishments").insert({
        user_id: challenge.user_id,
        battle_id: battle.id,
        ads_remaining: 3,
        active: true,
      });
      if (punishError) {
        console.log("PUNISHMENT INSERT ERROR", punishError);
      }

      // activite "battle_finished"
      const { data: ses } = await supabase.auth.getSession();
      const pseudoActivity =
        ses.session?.user.user_metadata?.pseudo ||
        ses.session?.user.email ||
        "Un joueur";

      await supabase.from("activities").insert({
        user_id: currentUserId,
        pseudo: pseudoActivity,
        type: "battle_finished",
        challenge_id: challengeId,
        message: `${pseudoActivity} a declare un gagnant sur ce defi`,
      });
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("user_id,pseudo")
        .eq("user_id", challenge.user_id)
        .maybeSingle();
      const ownerPseudo =
        (ownerProfile as any)?.pseudo ||
        `Joueur ${challenge.user_id.slice(0, 4)}`;
      await supabase.from("coach_notifications").insert({
        user_id: challenge.user_id,
        title: "Tu as été défié",
        body: `${ownerPseudo}, ${responderName} prend l'avantage. Reviens défendre ton titre !`,
        type: "rematch",
      });

      const ownerDept = ownerProfileCached?.department;
      const challengerDept = responderProfile?.department;
      if (ownerDept && challengerDept && ownerDept !== challengerDept) {
        const ownerDeptLabel = getDepartmentLabel(ownerDept) || ownerDept;
        const challengerDeptLabel =
          getDepartmentLabel(challengerDept) || challengerDept;
        await supabase.from("coach_notifications").insert({
          user_id: challenge.user_id,
          title: `${challengerDeptLabel} prend le toit`,
          body: `${challengerDeptLabel} passe devant sur ${challenge.title}. Défends ${ownerDeptLabel} et récupère ton rang.`,
          type: "dept_rivalry",
        });
        await logEvent("rivalite_perdue", {
          challenge_id: challenge.id,
          owner_dept: ownerDept,
          challenger_dept: challengerDept,
        });
      }

      feedbackSuccess();
      Alert.alert("Gagnant defini", "Le gagnant a ete enregistre.");
      await loadData();
    } catch (e: any) {
      console.log("CHOOSE WINNER ERROR", e);
      feedbackError();
      Alert.alert("Erreur", e.message || "Une erreur est survenue");
    }
  };

  const handleRespond = async () => {
    if (!challenge) return;

    if (!currentUserId) {
      feedbackError();
      Alert.alert("Connexion requise", "Tu dois etre connecte.");
      return;
    }

    if (currentUserId === challenge.user_id) {
      feedbackError();
      Alert.alert(
        "Impossible",
        "Tu ne peux pas repondre a ton propre defi."
      );
      return;
    }

    // verifier s'il y a une punition active sur ce user
    const { data: punishment } = await supabase
      .from("punishments")
      .select("*")
      .eq("user_id", currentUserId)
      .eq("active", true)
      .maybeSingle();

    if (punishment) {
      feedbackTap();
      navigation.navigate("PunishmentScreen", {
        adsRemaining: punishment.ads_remaining,
        punishmentId: punishment.id,
      });
      return;
    }

    feedbackTap();
    navigation.navigate("RespondChallenge", { challengeId });
  };

  const handleBackToBack = async () => {
    if (!challenge || !isOwner || backToBackLoading) return;
    try {
      setBackToBackLoading(true);
      feedbackTap();
      const roundSuffix = /Round\s+\d+/i.test(challenge.title)
        ? challenge.title.replace(/Round\s+(\d+)/i, (match, p1) => {
            const next = Number(p1) + 1;
            return `Round ${next}`;
          })
        : `${challenge.title} - Round 2`;

      const baseBet = (challenge as any).bet_amount || 0;
      const boostedBet = baseBet > 0 ? Math.min(baseBet + 5, baseBet * 2 || 20) : 0;
      const payload: any = {
        user_id: challenge.user_id,
        title: roundSuffix,
        description: `${challenge.description}\nRound supplémentaire pour défendre ton titre.`,
        sport: challenge?.sport || "",
        target_value: challenge.target_value,
        unit: challenge.unit,
        video_url: challenge.video_url,
        bet_enabled: challenge.bet_enabled,
        bet_amount: challenge.bet_enabled ? boostedBet : 0,
        min_level: (challenge.min_level || challenge.level_required || 1) + 1,
      };

      if (Object.prototype.hasOwnProperty.call(challenge, "level_required")) {
        payload.level_required =
          (challenge.level_required || challenge.min_level || 1) + 1;
      }

      const { data: inserted, error } = await supabase
        .from("challenges")
        .insert(payload)
        .select("*")
        .single();
      if (error || !inserted) {
        throw error || new Error("Création impossible");
      }

      await supabase.from("activities").insert({
        user_id: challenge.user_id,
        type: "challenge_created",
        challenge_id: inserted.id,
        message: `${ownerName} lance un Round 2 (${inserted.title}).`,
      });

      Alert.alert(
        "Round 2 prêt",
        "Ton défi back-to-back est en ligne. Enflamme encore le classement !",
        [
          {
            text: "Voir le nouveau défi",
            onPress: () =>
              navigation.replace("ChallengeDetail", {
                challengeId: inserted.id,
              }),
          },
          {
            text: "OK",
            style: "cancel",
          },
        ]
      );
    } catch (err: any) {
      console.log("BACK TO BACK ERROR", err);
      Alert.alert(
        "Impossible",
        err?.message || "La revanche instantanée a échoué."
      );
    } finally {
      setBackToBackLoading(false);
    }
  };

  const renderResponseItem = ({ item }: { item: ChallengeResponse }) => {
    const battle = battles.find((b) => b.player2_id === item.user_id);
    const isWinner = battle?.winner_id === item.user_id;
    const isCompleted = !!battle?.completed;
    const profile = profilesMap.get(item.user_id);
    const responderName =
      profile?.pseudo ||
      item.pseudo ||
      `Joueur ${item.user_id.slice(0, 6)}...${item.user_id.slice(-4)}`;

    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 14,
          padding: 12,
          marginBottom: 14,
          backgroundColor: palette.card,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <UserAvatar
            uri={profile?.avatar_url || item.avatar_url || undefined}
            label={responderName}
            size={44}
          />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: palette.text,
              }}
            >
              {responderName}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: COLORS.textMuted,
              }}
            >
              Challenger
            </Text>
          </View>
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: 18,
          padding: 16,
          marginBottom: 18,
          backgroundColor: COLORS.surface,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "900",
            color: COLORS.text,
            marginBottom: 4,
          }}
        >
          Arena Live
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 10 }}>
          Pyramide push-up IMPITOYABLE avec mise et camera live.
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: COLORS.text, fontSize: 13 }}>
            Niveau requis : {LIVE_MIN_LEVEL}
          </Text>
          <Text
            style={{
              color: liveLocked ? COLORS.danger : COLORS.success,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {liveLocked ? `Niveau actuel ${currentUserLevel}` : "Pret"}
          </Text>
        </View>
        <AppButton
          label="Ouvrir Arena Live"
          onPress={handleOpenArenaLive}
          disabled={liveLocked}
          sport={challenge?.sport || undefined}
        />
        <AppButton
          label="Simuler le mode (demo)"
          variant="ghost"
          onPress={handleOpenArenaSimulation}
          style={{ marginTop: 12 }}
          sport={challenge?.sport || undefined}
        />
      </View>

        <Video
          source={{ uri: item.video_url }}
          style={{ height: 220, borderRadius: 8, backgroundColor: "#000" }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
        />

        <View style={{ marginTop: 8 }}>
          {isWinner ? (
            <Text
              style={{ fontSize: 13, fontWeight: "800", color: palette.accent }}
            >
              CC Gagnant de la battle
            </Text>
          ) : isCompleted ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: COLORS.textMuted,
              }}
            >
              Battle termin...e (un autre gagnant a ...t... choisi)
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
              En attente de d...cision...
            </Text>
          )}
        </View>

        {isOwner && !isCompleted && (
          <View style={{ marginTop: 10 }}>
            <Button
              title="D...clarer gagnant"
              onPress={() => handleChooseWinner(item)}
            />
          </View>
        )}
      </View>
    );
  };

  if (loading && !challenge) {
    return (
      <ScreenContainer sport={challenge?.sport || undefined}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!challenge) {
    return (
      <ScreenContainer sport={challenge?.sport || undefined}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text style={{ color: palette.text }}>Defi introuvable</Text>
        </View>
      </ScreenContainer>
    );
  }

  const isBet =
    !!(challenge as any).bet_enabled &&
    ((challenge as any).bet_amount || 0) > 0;
  const ownerProfile = challenge
    ? profilesMap.get(challenge.user_id)
    : undefined;
  const ownerName =
    ownerProfile?.pseudo ||
    challenge.pseudo ||
    `Joueur ${challenge.user_id.slice(0, 4)}...${challenge.user_id.slice(-4)}`;
  const challengeDomain = getSportDomain(challenge?.sport || "");
  const domainPalette = getSportPalette(challengeDomain.paletteKey);
  const LIVE_MIN_LEVEL = 5;
  const liveLocked = currentUserLevel < LIVE_MIN_LEVEL;

  return (
    <ScreenContainer sport={challenge?.sport || undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tete defi + bouton partager */}
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
            borderRadius: 20,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 20,
                fontWeight: "900",
                color: palette.text,
                marginRight: 12,
              }}
            >
              {challenge.title}
            </Text>
            <SportTag sport={challenge?.sport || ""} />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
          <UserAvatar
            uri={ownerProfile?.avatar_url || challenge.avatar_url || undefined}
            label={ownerName}
            size={52}
          />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: palette.text,
                }}
              >
                {ownerName}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                }}
              >
                Createur du defi
              </Text>
            </View>
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: domainPalette.border,
              backgroundColor: domainPalette.background,
              borderRadius: 14,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: domainPalette.accent,
              }}
            >
              {challengeDomain.label}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: domainPalette.text,
                marginTop: 4,
              }}
            >
              {challengeDomain.tagline}
            </Text>
          </View>

          <Text
            style={{
              fontSize: 13,
              color: COLORS.textMuted,
              marginBottom: 8,
            }}
          >
            {challenge.description}
          </Text>

          <View style={{ flexDirection: "row", marginBottom: 4 }}>
            <Text style={{ fontSize: 13, color: COLORS.textMuted }}>
              Terrain :
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: palette.text,
                fontWeight: "700",
                marginLeft: 6,
              }}
            >
              {challenge?.sport || ""}
            </Text>
          </View>

          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: COLORS.textMuted }}>
              Objectif :
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: palette.text,
                fontWeight: "700",
                marginLeft: 6,
              }}
            >
              {challenge.target_value} {challenge.unit}
            </Text>
          </View>

          {isBet && (
            <View
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 14,
                backgroundColor: palette.background,
                borderWidth: 1,
                borderColor: palette.accent,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: palette.accent,
                  marginBottom: 2,
                }}
              >
                 Defi classe
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                }}
              >
                Mise : {(challenge as any).bet_amount} coins
              </Text>
            </View>
          )}

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <TouchableOpacity
              onPress={handleShare}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: "#020617",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: COLORS.primary,
                }}
              >
                Partager ce defi
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenArenaLive}
              disabled={liveLocked}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: liveLocked ? COLORS.border : domainPalette.accent,
                backgroundColor: liveLocked
                  ? "transparent"
                  : domainPalette.background,
                opacity: liveLocked ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: liveLocked ? COLORS.textMuted : domainPalette.accent,
                }}
              >
                Arena Live
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isOwner && (
          <View
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              backgroundColor: COLORS.surface,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: COLORS.text,
                marginBottom: 4,
              }}
            >
              Champion ? Lance un back-to-back
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 12 }}>
              Défends ton titre avec un Round 2 boosté (niveau +1, mise relevée)
              pour attirer encore plus de challengers.
            </Text>
            <AppButton
              label="Lancer Round 2"
              onPress={handleBackToBack}
              loading={backToBackLoading}
              sport={challenge?.sport || undefined}
            />
          </View>
        )}

        {/* Video du createur */}
        <Text
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: palette.text,
            marginBottom: 8,
          }}
        >
          Video du createur
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 18,
            overflow: "hidden",
            marginBottom: 18,
            backgroundColor: palette.card,
          }}
        >
          <Video
            source={{ uri: challenge.video_url }}
            style={{ height: 240 }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
          />
        </View>

        {/* Bouton repondre */}
        {!isOwner && (
          <View style={{ marginBottom: 18 }}>
            <TouchableOpacity
              onPress={handleRespond}
              activeOpacity={0.9}
              style={{
                borderRadius: 999,
                paddingVertical: 14,
                backgroundColor: palette.accent,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontWeight: "900",
                  color: "#050505",
                }}
              >
                Repondre a ce defi
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Liste des reponses */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: palette.text,
            marginBottom: 10,
          }}
        >
          Reponses au defi
        </Text>

        {responses.length === 0 ? (
          <Text style={{ fontSize: 13, color: COLORS.textMuted }}>
            Personne n'a encore repondu a ce defi.
          </Text>
        ) : (
          responses.map((item) => (
            <React.Fragment key={item.id}>
              {renderResponseItem({ item })}
            </React.Fragment>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
