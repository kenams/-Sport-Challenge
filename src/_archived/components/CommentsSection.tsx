// src/components/CommentsSection.tsx
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../supabase";
import { COLORS, TYPO } from "../theme";
import AppButton from "./AppButton";
import UserAvatar from "./UserAvatar";

type CommentRow = {
  id: number;
  user_id: string | null;
  pseudo: string | null;
  avatar_url?: string | null;
  body: string;
  created_at: string;
};

type Props = {
  challengeId: number;
};

export default function CommentsSection({ challengeId }: Props) {
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [draft, setDraft] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("challenge_comments")
        .select("*")
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        console.log("COMMENTS LOAD ERROR", error);
        setComments([]);
        return;
      }
      setComments((data as CommentRow[]) || []);
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

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

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;

    if (!isAuthed) {
      Alert.alert("Connexion requise", "Connecte-toi pour commenter.");
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    const user = session.session?.user;
    if (!user) {
      Alert.alert("Connexion requise", "Connecte-toi pour commenter.");
      return;
    }

    const { error } = await supabase.from("challenge_comments").insert({
      challenge_id: challengeId,
      user_id: user.id,
      pseudo: user.user_metadata?.pseudo || user.email || "Joueur",
      body: text,
    });

    if (error) {
      console.log("COMMENT INSERT ERROR", error);
      Alert.alert("Erreur", "Impossible d'envoyer le commentaire.");
      return;
    }

    setDraft("");
    await loadComments();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Commentaires</Text>
      {comments.length === 0 ? (
        <Text style={styles.empty}>Aucun commentaire pour le moment.</Text>
      ) : (
        comments.map((comment) => (
          <View key={`comment-${comment.id}`} style={styles.commentRow}>
            <UserAvatar uri={comment.avatar_url || undefined} label={comment.pseudo || "Joueur"} size={32} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.commentAuthor}>{comment.pseudo || "Joueur"}</Text>
              <Text style={styles.commentBody}>{comment.body}</Text>
            </View>
          </View>
        ))
      )}
      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ajouter un commentaire..."
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
          multiline
        />
        <AppButton label={loading ? "..." : "Envoyer"} size="sm" onPress={handleSend} disabled={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(10,10,14,0.75)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  title: {
    ...TYPO.title,
    color: COLORS.text,
    marginBottom: 8,
  },
  empty: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },
  commentBody: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  inputRow: {
    marginTop: 10,
    gap: 10,
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(8,8,12,0.6)",
    color: COLORS.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
});
