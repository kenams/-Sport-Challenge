// src/screens/ChallengeDetailScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Button,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import { Video, ResizeMode } from "expo-av";

import ScreenContainer from "../components/ScreenContainer";
import SportTag from "../components/SportTag";
import { supabase } from "../supabase";
import { COLORS, getSportPalette } from "../theme";
import { Challenge, ChallengeResponse, Battle } from "../types";
import {
  feedbackError,
  feedbackSuccess,
  feedbackTap,
} from "../utils/feedback";

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
  const [loading, setLoading] = useState(true);

  const palette = getSportPalette(challenge?.sport || "");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // session
      const { data: ses } = await supabase.auth.getSession();
      setCurrentUserId(ses.session ? ses.session.user.id : null);

      // défi
      const { data: chData, error: chError } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single();

      if (chError) {
        console.log("CHALLENGE DETAIL ERROR", chError);
        setChallenge(null);
      } else if (chData) {
        setChallenge(chData as Challenge);
      }

      // réponses
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

      // battles liées
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
    } catch (e) {
      console.log("DETAIL LOAD EXCEPTION", e);
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
      const message = `🔥 Défi sur ${challenge.sport}

Titre : ${challenge.title}
Description : ${challenge.description}
Objectif : ${challenge.target_value} ${challenge.unit}

Application Sport Challenge – viens me défier en vidéo.`;

      await Share.share({ message });
    } catch (e) {
      console.log("DETAIL SHARE ERROR", e);
    }
  };

  const handleChooseWinner = async (response: ChallengeResponse) => {
    if (!challenge || !currentUserId || !isOwner) {
      return;
    }

    try {
      feedbackTap();

      // trouver une battle existante entre créateur et ce challenger
      let battle = battles.find(
        (b) => b.player2_id === response.user_id && !b.completed
      );

      // si pas de battle → en créer une si pari
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
            "Impossible de créer une battle pour ce défi."
          );
          return;
        }

        battle = newBattle as Battle;
      }

      // mettre à jour la battle avec gagnant/perdant
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
        Alert.alert("Erreur", "Impossible d’enregistrer le gagnant.");
        return;
      }

      // si pari → distribuer les coins au gagnant
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

      // punition du créateur (perdant)
      const { error: punishError } = await supabase.from("punishments").insert({
        user_id: challenge.user_id,
        battle_id: battle.id,
        ads_remaining: 3,
        active: true,
      });
      if (punishError) {
        console.log("PUNISHMENT INSERT ERROR", punishError);
      }

      // activité "battle_finished"
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
        message: `${pseudoActivity} a déclaré un gagnant sur ce défi`,
      });

      feedbackSuccess();
      Alert.alert("Gagnant défini", "Le gagnant a été enregistré.");
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
      Alert.alert("Connexion requise", "Tu dois être connecté.");
      return;
    }

    if (currentUserId === challenge.user_id) {
      feedbackError();
      Alert.alert(
        "Impossible",
        "Tu ne peux pas répondre à ton propre défi."
      );
      return;
    }

    // vérifier s'il y a une punition active sur ce user
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

  const renderResponseItem = ({ item }: { item: ChallengeResponse }) => {
    const battle = battles.find((b) => b.player2_id === item.user_id);
    const isWinner = battle?.winner_id === item.user_id;
    const isCompleted = !!battle?.completed;

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
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: palette.text,
            marginBottom: 4,
          }}
        >
          Réponse d’un challenger
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: COLORS.textMuted,
            marginBottom: 8,
          }}
        >
          Joueur : {item.user_id.slice(0, 8)}…
        </Text>

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
              🏆 Gagnant de la battle
            </Text>
          ) : isCompleted ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: COLORS.textMuted,
              }}
            >
              Battle terminée (un autre gagnant a été choisi)
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
              En attente de décision…
            </Text>
          )}
        </View>

        {isOwner && !isCompleted && (
          <View style={{ marginTop: 10 }}>
            <Button
              title="Déclarer gagnant"
              onPress={() => handleChooseWinner(item)}
            />
          </View>
        )}
      </View>
    );
  };

  if (loading && !challenge) {
    return (
      <ScreenContainer backgroundColor={palette.background}>
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
      <ScreenContainer backgroundColor={palette.background}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text style={{ color: palette.text }}>Défi introuvable</Text>
        </View>
      </ScreenContainer>
    );
  }

  const isBet =
    !!(challenge as any).bet_enabled &&
    ((challenge as any).bet_amount || 0) > 0;

  return (
    <ScreenContainer backgroundColor={palette.background}>
      <View style={{ flex: 1 }}>
        {/* En-tête défi + bouton partager */}
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
            <SportTag sport={challenge.sport} />
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
              {challenge.sport}
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
                💰 Défi classé
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
                📤 Partager ce défi
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Vidéo du créateur */}
        <Text
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: palette.text,
            marginBottom: 8,
          }}
        >
          Vidéo du créateur
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

        {/* Bouton répondre */}
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
                Répondre à ce défi ⚡
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Liste des réponses */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: palette.text,
            marginBottom: 10,
          }}
        >
          Réponses au défi
        </Text>

        {responses.length === 0 ? (
          <Text style={{ fontSize: 13, color: COLORS.textMuted }}>
            Personne n’a encore répondu à ce défi.
          </Text>
        ) : (
          <FlatList
            data={responses}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderResponseItem}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
