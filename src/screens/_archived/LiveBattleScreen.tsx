// src/screens/LiveBattleScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";
import UserAvatar from "../components/UserAvatar";
import VideoPlayer from "../components/VideoPlayer";

const { width: SW, height: SH } = Dimensions.get("window");

const REACTION_TYPES = ["🔥", "💪", "❤️", "👑", "💯"];
const REACTION_COLORS: Record<string, string> = {
  "🔥": "#F97316",
  "💪": "#60A5FA",
  "❤️": "#EF4444",
  "👑": "#D4AF37",
  "💯": "#34D399",
};

interface Battle {
  id: number;
  title?: string | null;
  sport?: string | null;
  status: string;
  player1_id?: string | null;
  player2_id?: string | null;
  player1_pseudo?: string | null;
  player2_pseudo?: string | null;
  player1_avatar?: string | null;
  player2_avatar?: string | null;
  player1_votes: number;
  player2_votes: number;
  viewer_count: number;
  scheduled_at?: string | null;
  started_at?: string | null;
  stream_url?: string | null;
  description?: string | null;
}

interface ChatMsg {
  id: number;
  user_id: string;
  pseudo?: string | null;
  avatar_url?: string | null;
  message: string;
  created_at: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  translateY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
}

function useCountdown(targetIso?: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) return;
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return remaining;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function LiveBattleScreen({ navigation }: any) {
  const route = useRoute<any>();
  const battleId = Number(route.params?.id ?? 0);

  const [battle, setBattle] = useState<Battle | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myPseudo, setMyPseudo] = useState<string | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<"player1" | "player2" | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [selectedReaction, setSelectedReaction] = useState("🔥");
  const [reactionCount, setReactionCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const chatRef = useRef<FlatList>(null);
  const countdown = useCountdown(battle?.status === "scheduled" ? battle?.scheduled_at : null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !mounted) return;
      setMyUserId(uid);
      const { data: prof } = await supabase.from("profiles").select("pseudo,avatar_url").eq("user_id", uid).maybeSingle();
      if (mounted && prof) {
        setMyPseudo((prof as any).pseudo);
        setMyAvatar((prof as any).avatar_url);
      }
    });
    return () => { mounted = false; };
  }, []);

  const loadBattle = useCallback(async () => {
    const { data } = await supabase
      .from("live_events")
      .select("id,title,sport,status,player1_id,player2_id,player1_pseudo,player2_pseudo,player1_avatar,player2_avatar,player1_votes,player2_votes,viewer_count,scheduled_at,started_at,stream_url,description")
      .eq("id", battleId)
      .maybeSingle();
    setBattle(data as unknown as Battle | null);
  }, [battleId]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from("live_comments")
      .select("id,user_id,pseudo,avatar_url,message,created_at")
      .eq("live_event_id", battleId)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages((data as unknown as ChatMsg[]) || []);
  }, [battleId]);

  useEffect(() => {
    if (!battleId) return;
    loadBattle();
    loadMessages();

    const channel = supabase.channel(`battle-${battleId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_events", filter: `id=eq.${battleId}` }, (payload) => {
        setBattle((prev) => prev ? { ...prev, ...(payload.new as any) } : prev);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_comments", filter: `live_event_id=eq.${battleId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as unknown as ChatMsg]);
        setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_reactions", filter: `live_event_id=eq.${battleId}` }, (payload) => {
        const emoji = (payload.new as any).type || "🔥";
        triggerRemoteReaction(emoji);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [battleId, loadBattle, loadMessages]);

  const triggerReaction = (emoji: string, x?: number) => {
    const posX = x ?? Math.random() * (SW - 60) + 20;
    const id = `${Date.now()}-${Math.random()}`;
    const translateY = new Animated.Value(0);
    const opacity = new Animated.Value(1);
    const scale = new Animated.Value(0.5);

    setReactions((prev) => [...prev.slice(-15), { id, emoji, x: posX, translateY, opacity, scale }]);
    setReactionCount((c) => c + 1);

    Animated.parallel([
      Animated.timing(translateY, { toValue: -200 - Math.random() * 100, duration: 1800, useNativeDriver: true }),
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.4, friction: 4, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    ]).start(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    });
  };

  const triggerRemoteReaction = (emoji: string) => {
    triggerReaction(emoji, Math.random() * (SW - 60) + 20);
  };

  const handleTapVideo = async (evt: any) => {
    const x = evt.nativeEvent?.locationX ?? SW / 2;
    triggerReaction(selectedReaction, x);
    if (!myUserId) return;
    await supabase.from("live_reactions").insert({
      live_event_id: battleId,
      user_id: myUserId,
      type: selectedReaction,
    });
  };

  const sendMessage = async () => {
    const msg = inputMsg.trim();
    if (!msg || !myUserId || sending) return;
    setSending(true);
    setInputMsg("");
    await supabase.from("live_comments").insert({
      live_event_id: battleId,
      user_id: myUserId,
      pseudo: myPseudo || "Joueur",
      avatar_url: myAvatar,
      message: msg,
    });
    setSending(false);
  };

  const handleVote = async (side: "player1" | "player2") => {
    if (!myUserId || myVote) return;
    const { data: existing } = await supabase
      .from("live_votes")
      .select("id")
      .eq("live_event_id", battleId)
      .eq("user_id", myUserId)
      .maybeSingle();
    if (existing) { setMyVote(side); return; }
    await supabase.from("live_votes").insert({ live_event_id: battleId, user_id: myUserId, voted_for: side });
    const col = side === "player1" ? "player1_votes" : "player2_votes";
    await supabase.from("live_events").update({ [col]: ((battle?.[col as keyof Battle] as number) || 0) + 1 }).eq("id", battleId);
    setBattle((prev) => prev ? { ...prev, [col]: ((prev as any)[col] || 0) + 1 } : prev);
    setMyVote(side);
  };

  if (!battle) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <FontAwesome5 name="broadcast-tower" size={32} color={COLORS.primary} style={{ marginBottom: 12 }} />
          <Text style={styles.loadText}>Chargement de l'arène...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const totalVotes = (battle.player1_votes || 0) + (battle.player2_votes || 0);
  const p1Pct = totalVotes > 0 ? Math.round(((battle.player1_votes || 0) / totalVotes) * 100) : 50;
  const p2Pct = 100 - p1Pct;
  const isLive = battle.status === "live";
  const isScheduled = battle.status === "scheduled";
  const isEnded = battle.status === "ended";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenContainer>

        {/* ── ARENA HEADER ── */}
        <View style={styles.arenaHeader}>
          {/* Joueur 1 */}
          <View style={[styles.playerSide, myVote === "player1" && styles.playerSideVoted]}>
            <UserAvatar uri={battle.player1_avatar} label={battle.player1_pseudo || "?"} size={44} />
            <Text style={styles.playerName} numberOfLines={1}>{battle.player1_pseudo || "Joueur 1"}</Text>
            <View style={styles.voteCountWrap}>
              <FontAwesome5 name="thumbs-up" size={10} color="#60A5FA" />
              <Text style={[styles.voteCountTxt, { color: "#60A5FA" }]}>{battle.player1_votes || 0}</Text>
            </View>
          </View>

          {/* Centre VS */}
          <View style={styles.vsBlock}>
            {isLive && (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            {isScheduled && countdown !== null && countdown > 0 && (
              <View style={styles.countdownPill}>
                <FontAwesome5 name="clock" size={10} color={COLORS.primary} />
                <Text style={styles.countdownTxt}>{formatCountdown(countdown)}</Text>
              </View>
            )}
            {isEnded && (
              <View style={[styles.livePill, { backgroundColor: "rgba(148,163,184,0.15)" }]}>
                <Text style={[styles.liveText, { color: COLORS.textMuted }]}>TERMINÉ</Text>
              </View>
            )}
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.viewersRow}>
              <FontAwesome5 name="eye" size={9} color={COLORS.textMuted} />
              <Text style={styles.viewersTxt}>{battle.viewer_count || 0}</Text>
            </View>
          </View>

          {/* Joueur 2 */}
          <View style={[styles.playerSide, styles.playerSideRight, myVote === "player2" && styles.playerSideVoted]}>
            <UserAvatar uri={battle.player2_avatar} label={battle.player2_pseudo || "?"} size={44} />
            <Text style={styles.playerName} numberOfLines={1}>{battle.player2_pseudo || "Joueur 2"}</Text>
            <View style={styles.voteCountWrap}>
              <FontAwesome5 name="thumbs-up" size={10} color="#F97316" />
              <Text style={[styles.voteCountTxt, { color: "#F97316" }]}>{battle.player2_votes || 0}</Text>
            </View>
          </View>
        </View>

        {/* Barre de vote */}
        <View style={styles.voteBar}>
          <View style={[styles.voteBarP1, { flex: p1Pct }]} />
          <View style={[styles.voteBarP2, { flex: p2Pct }]} />
        </View>
        <View style={styles.votePctRow}>
          <Text style={[styles.votePct, { color: "#60A5FA" }]}>{p1Pct}%</Text>
          <Text style={styles.votePctLabel}>{totalVotes} votes</Text>
          <Text style={[styles.votePct, { color: "#F97316" }]}>{p2Pct}%</Text>
        </View>

        {/* ── ZONE VIDÉO + RÉACTIONS ── */}
        <View style={styles.videoZone}>
          {battle.stream_url ? (
            <TouchableWithoutFeedback onPress={handleTapVideo}>
              <View style={{ flex: 1 }}>
                <VideoPlayer
                  uri={battle.stream_url}
                  style={{ height: "100%", width: "100%" }}
                  contentFit="cover"
                  autoPlay={isLive}
                  shouldPlay={isLive}
                  allowUserToggle
                  showControlButton={!isLive}
                />
              </View>
            </TouchableWithoutFeedback>
          ) : (
            <TouchableWithoutFeedback onPress={handleTapVideo}>
              <View style={styles.noStreamZone}>
                {isScheduled ? (
                  <>
                    <FontAwesome5 name="satellite-dish" size={36} color={COLORS.textMuted} />
                    <Text style={styles.noStreamTitle}>Battle non démarrée</Text>
                    {countdown !== null && countdown > 0 && (
                      <Text style={styles.noStreamSub}>Dans {formatCountdown(countdown)}</Text>
                    )}
                  </>
                ) : (
                  <>
                    <FontAwesome5 name="broadcast-tower" size={36} color={COLORS.primary} />
                    <Text style={styles.noStreamTitle}>Tape pour réagir !</Text>
                    <Text style={styles.noStreamSub}>Le stream démarrera bientôt</Text>
                  </>
                )}
                <Text style={styles.tapHint}>👆 Tape ici pour envoyer des réactions</Text>
              </View>
            </TouchableWithoutFeedback>
          )}

          {/* Floating reactions */}
          {reactions.map((r) => (
            <Animated.Text
              key={r.id}
              style={[
                styles.floatingReaction,
                { left: r.x, transform: [{ translateY: r.translateY }, { scale: r.scale }], opacity: r.opacity },
              ]}
            >
              {r.emoji}
            </Animated.Text>
          ))}

          {/* Compteur réactions */}
          {reactionCount > 0 && (
            <View style={styles.reactionCounter}>
              <Text style={styles.reactionCounterTxt}>🔥 {reactionCount}</Text>
            </View>
          )}
        </View>

        {/* ── SÉLECTEUR RÉACTION + VOTES ── */}
        <View style={styles.controlBar}>
          <View style={styles.reactionPicker}>
            {REACTION_TYPES.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiBtn, selectedReaction === emoji && styles.emojiBtnActive]}
                onPress={() => setSelectedReaction(emoji)}
              >
                <Text style={styles.emojiTxt}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.voteButtons}>
            <TouchableOpacity
              style={[styles.voteBtn, styles.voteBtnP1, myVote === "player1" && styles.voteBtnActive]}
              onPress={() => handleVote("player1")}
              disabled={!!myVote || isEnded || isScheduled}
            >
              <FontAwesome5 name="thumbs-up" size={12} color={myVote === "player1" ? "#000" : "#60A5FA"} />
              <Text style={[styles.voteBtnTxt, { color: myVote === "player1" ? "#000" : "#60A5FA" }]}>
                {battle.player1_pseudo?.split(" ")[0] || "P1"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteBtn, styles.voteBtnP2, myVote === "player2" && styles.voteBtnActive]}
              onPress={() => handleVote("player2")}
              disabled={!!myVote || isEnded || isScheduled}
            >
              <FontAwesome5 name="thumbs-up" size={12} color={myVote === "player2" ? "#000" : "#F97316"} />
              <Text style={[styles.voteBtnTxt, { color: myVote === "player2" ? "#000" : "#F97316" }]}>
                {battle.player2_pseudo?.split(" ")[0] || "P2"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CHAT LIVE ── */}
        <View style={styles.chatSection}>
          <TouchableOpacity style={styles.chatToggle} onPress={() => setChatOpen((o) => !o)}>
            <FontAwesome5 name="comments" size={12} color={COLORS.primary} />
            <Text style={styles.chatToggleTxt}>Chat live ({messages.length})</Text>
            <FontAwesome5 name={chatOpen ? "chevron-down" : "chevron-up"} size={10} color={COLORS.textMuted} />
          </TouchableOpacity>

          {chatOpen && (
            <>
              <FlatList
                ref={chatRef}
                data={messages}
                keyExtractor={(item) => String(item.id)}
                style={styles.chatList}
                contentContainerStyle={{ paddingVertical: 8 }}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                  <Text style={styles.chatEmpty}>Sois le premier à réagir !</Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.chatBubble}>
                    <UserAvatar uri={item.avatar_url} label={item.pseudo || "?"} size={22} />
                    <View style={styles.chatContent}>
                      <Text style={styles.chatPseudo}>{item.pseudo || "Joueur"}</Text>
                      <Text style={styles.chatMsg}>{item.message}</Text>
                    </View>
                  </View>
                )}
              />

              <View style={styles.chatInputRow}>
                <TextInput
                  value={inputMsg}
                  onChangeText={setInputMsg}
                  placeholder="Commente en live..."
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.chatInput}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                  maxLength={200}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!inputMsg.trim() || sending) && { opacity: 0.4 }]}
                  onPress={sendMessage}
                  disabled={!inputMsg.trim() || sending}
                >
                  <FontAwesome5 name="paper-plane" size={14} color="#000" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadText: { color: COLORS.textMuted, fontSize: 14 },

  // Arena header
  arenaHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 18, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)", backgroundColor: "rgba(12,12,16,0.95)", marginBottom: 8,
  },
  playerSide: {
    flex: 1, alignItems: "center", gap: 4, padding: 8, borderRadius: 14,
    borderWidth: 1, borderColor: "transparent",
  },
  playerSideRight: {},
  playerSideVoted: { borderColor: COLORS.primary + "44", backgroundColor: COLORS.primary + "08" },
  playerName: { color: COLORS.text, fontWeight: "800", fontSize: 11, textAlign: "center" },
  voteCountWrap: { flexDirection: "row", alignItems: "center", gap: 3 },
  voteCountTxt: { fontSize: 11, fontWeight: "700" },
  vsBlock: { alignItems: "center", gap: 6, paddingHorizontal: 4 },
  livePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.4)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  liveText: { color: "#EF4444", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  countdownPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: "rgba(212,175,55,0.35)",
  },
  countdownTxt: { color: COLORS.primary, fontSize: 11, fontWeight: "800" },
  vsText: { color: COLORS.primary, fontSize: 22, fontWeight: "900", letterSpacing: 2 },
  viewersRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  viewersTxt: { color: COLORS.textMuted, fontSize: 10 },

  // Vote bar
  voteBar: { flexDirection: "row", height: 5, borderRadius: 99, overflow: "hidden", marginBottom: 4 },
  voteBarP1: { backgroundColor: "#60A5FA", minWidth: 2 },
  voteBarP2: { backgroundColor: "#F97316", minWidth: 2 },
  votePctRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  votePct: { fontSize: 11, fontWeight: "800" },
  votePctLabel: { color: COLORS.textMuted, fontSize: 10 },

  // Video zone
  videoZone: {
    height: 200, borderRadius: 18, overflow: "hidden", borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)", backgroundColor: "#080808",
    marginBottom: 8, position: "relative",
  },
  noStreamZone: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#080808",
  },
  noStreamTitle: { color: COLORS.text, fontWeight: "800", fontSize: 15 },
  noStreamSub: { color: COLORS.textMuted, fontSize: 12 },
  tapHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 8 },
  floatingReaction: {
    position: "absolute", bottom: 20, fontSize: 32, zIndex: 99,
  },
  reactionCounter: {
    position: "absolute", top: 8, right: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(249,115,22,0.4)",
  },
  reactionCounterTxt: { color: COLORS.text, fontWeight: "700", fontSize: 11 },

  // Control bar
  controlBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10, gap: 10,
  },
  reactionPicker: { flexDirection: "row", gap: 6 },
  emojiBtn: {
    width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  emojiBtnActive: { borderColor: COLORS.primary + "88", backgroundColor: COLORS.primary + "15" },
  emojiTxt: { fontSize: 18 },
  voteButtons: { flexDirection: "row", gap: 8 },
  voteBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
  },
  voteBtnP1: { borderColor: "#60A5FA44", backgroundColor: "#60A5FA12" },
  voteBtnP2: { borderColor: "#F9731644", backgroundColor: "#F9731612" },
  voteBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  voteBtnTxt: { fontSize: 11, fontWeight: "700" },

  // Chat
  chatSection: {
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.15)",
    backgroundColor: COLORS.surface, overflow: "hidden",
  },
  chatToggle: {
    flexDirection: "row", alignItems: "center", gap: 8, padding: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  chatToggleTxt: { flex: 1, color: COLORS.text, fontWeight: "700", fontSize: 13 },
  chatList: { maxHeight: 180, paddingHorizontal: 12 },
  chatEmpty: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", paddingVertical: 16 },
  chatBubble: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  chatContent: { flex: 1, gap: 2 },
  chatPseudo: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  chatMsg: { color: COLORS.text, fontSize: 12, lineHeight: 17 },
  chatInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.04)",
  },
  chatInput: {
    flex: 1, color: COLORS.text, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(5,5,7,0.9)", fontSize: 13,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
});
