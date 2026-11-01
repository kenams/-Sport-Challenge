// Envoi des vidéos de preuve : limites claires, chemin dans le dossier du joueur, nettoyage si l'enregistrement échoue.
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { Platform } from "react-native";
import { supabase } from "../supabase";
import { describeError } from "./api";

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // identique à la limite du bucket serveur
export const ACCEPTED_MIME = ["video/mp4", "video/quicktime", "video/webm"] as const;

export type VideoCandidate = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  durationSeconds?: number | null;
};

export type VideoCheck = { ok: true } | { ok: false; message: string };

/** Contrôles faits avant l'envoi pour éviter un transfert voué à l'échec. */
export function checkVideoCandidate(video: VideoCandidate, maxSeconds: number): VideoCheck {
  if (video.fileSize && video.fileSize > MAX_VIDEO_BYTES) {
    return { ok: false, message: "La vidéo dépasse 50 Mo. Filme une version plus courte ou en qualité réduite." };
  }
  if (video.mimeType && !ACCEPTED_MIME.includes(video.mimeType as (typeof ACCEPTED_MIME)[number])) {
    return { ok: false, message: "Format non accepté. Utilise une vidéo MP4, MOV ou WebM." };
  }
  if (video.durationSeconds && video.durationSeconds > maxSeconds) {
    return { ok: false, message: `La vidéo dure plus de ${maxSeconds} secondes, la durée maximale de ce format.` };
  }
  return { ok: true };
}

function extensionFor(mime: string): string {
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  return "mp4";
}

async function readPayload(video: VideoCandidate): Promise<{ data: ArrayBuffer | Blob; contentType: string; size: number }> {
  if (Platform.OS === "web") {
    const response = await fetch(video.uri);
    const blob = await response.blob();
    return { data: blob, contentType: blob.type || video.mimeType || "video/mp4", size: blob.size };
  }
  const base64 = await FileSystem.readAsStringAsync(video.uri, { encoding: FileSystem.EncodingType.Base64 });
  const buffer = decode(base64);
  return { data: buffer, contentType: video.mimeType || "video/mp4", size: buffer.byteLength };
}

export type UploadResult = { ok: true; path: string } | { ok: false; message: string };

/** Envoie la vidéo dans le dossier du joueur (`<user_id>/<horodatage>-<aléa>.mp4`). */
export async function uploadAttemptVideo(userId: string, video: VideoCandidate): Promise<UploadResult> {
  try {
    const payload = await readPayload(video);
    if (payload.size > MAX_VIDEO_BYTES) {
      return { ok: false, message: "La vidéo dépasse 50 Mo. Filme une version plus courte ou en qualité réduite." };
    }
    if (!ACCEPTED_MIME.includes(payload.contentType as (typeof ACCEPTED_MIME)[number])) {
      return { ok: false, message: "Format non accepté. Utilise une vidéo MP4, MOV ou WebM." };
    }
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(payload.contentType)}`;
    const { error } = await supabase.storage.from("attempt-videos").upload(path, payload.data, {
      contentType: payload.contentType,
      upsert: false,
    });
    if (error) return { ok: false, message: describeError(error) };
    return { ok: true, path };
  } catch (caught) {
    return { ok: false, message: describeError(caught as { message?: string }) };
  }
}

/** Supprime une vidéo envoyée mais jamais rattachée à une performance (enregistrement refusé). */
export async function discardUploadedVideo(path: string): Promise<void> {
  try {
    await supabase.storage.from("attempt-videos").remove([path]);
  } catch {
    // Sans effet : le fichier orphelin sera nettoyé par la politique de conservation.
  }
}
