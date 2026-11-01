// Envoi d'une performance : vidéo puis enregistrement. Si l'enregistrement échoue, la vidéo envoyée est supprimée.
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { submitAttempt } from "../../services/api";
import { discardUploadedVideo, uploadAttemptVideo, type VideoCandidate } from "../../services/video";
import type { FormatKey } from "../../domain/types";

export type SendResult = { ok: true; attemptId: string } | { ok: false; message: string };

export async function sendAttempt(input: {
  userId: string;
  format: FormatKey;
  score: number;
  video: VideoCandidate;
  title?: string | null;
  challengeId?: string | null;
  recipientId?: string | null;
}): Promise<SendResult> {
  const upload = await uploadAttemptVideo(input.userId, input.video);
  if (!upload.ok) return { ok: false, message: upload.message };
  const saved = await submitAttempt({
    format: input.format,
    declaredScore: input.score,
    videoPath: upload.path,
    durationSeconds: input.video.durationSeconds ?? null,
    title: input.title ?? null,
    challengeId: input.challengeId ?? null,
    recipientId: input.recipientId ?? null,
  });
  if (saved.error || !saved.data) {
    await discardUploadedVideo(upload.path);
    return { ok: false, message: saved.error ?? "Une erreur est survenue. Réessaie dans un instant." };
  }
  return { ok: true, attemptId: saved.data };
}

/** Identifiant du joueur connecté (null tant qu'inconnu ou hors connexion). */
export function useUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setUserId(data.session?.user?.id ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return userId;
}
