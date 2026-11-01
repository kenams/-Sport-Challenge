// Contrôles et métadonnées vidéo sans accès réseau ni authentification.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // identique à la limite du bucket serveur
export const ACCEPTED_MIME = ["video/mp4", "video/quicktime", "video/webm"] as const;

export type VideoCandidate = {
  uri: string;
  source?: "guided" | "imported";
  sessionCode?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  durationSeconds?: number | null;
};

export type VideoCheck = { ok: true } | { ok: false; message: string };

/** Contrôles faits avant l'envoi pour éviter un transfert voué à l'échec. */
export function checkVideoCandidate(video: VideoCandidate, maxSeconds: number): VideoCheck {
  if (video.fileSize != null && (!Number.isFinite(video.fileSize) || video.fileSize <= 0)) {
    return { ok: false, message: "La vidéo est vide ou invalide. Choisis un autre fichier." };
  }
  if (video.fileSize && video.fileSize > MAX_VIDEO_BYTES) {
    return { ok: false, message: "La vidéo dépasse 50 Mo. Filme une version plus courte ou en qualité réduite." };
  }
  if (video.mimeType && !ACCEPTED_MIME.includes(video.mimeType as (typeof ACCEPTED_MIME)[number])) {
    return { ok: false, message: "Format non accepté. Utilise une vidéo MP4, MOV ou WebM." };
  }
  if (video.durationSeconds != null && (!Number.isFinite(video.durationSeconds) || video.durationSeconds <= 0)) {
    return { ok: false, message: "La durée de la vidéo est invalide. Choisis un autre fichier." };
  }
  if (video.durationSeconds && video.durationSeconds > maxSeconds) {
    return { ok: false, message: `La vidéo dure plus de ${maxSeconds} secondes, la durée maximale de ce format.` };
  }
  return { ok: true };
}

/** Lit la durée réelle sur le web, où le sélecteur Expo ne la fournit pas. */
export function readWebVideoDuration(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const timer = setTimeout(() => finish(), 10000);
    const finish = (duration?: number) => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.ondurationchange = null;
      video.ontimeupdate = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      if (duration && Number.isFinite(duration)) resolve(duration);
      else reject(new Error("video_metadata_unavailable"));
    };
    const read = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) finish(video.duration);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration === Infinity) {
        // Certains WebM enregistrés par le navigateur n'ont pas de durée dans leur en-tête.
        video.currentTime = 1e10;
      } else read();
    };
    video.ondurationchange = read;
    video.ontimeupdate = read;
    video.onerror = () => finish();
    video.src = uri;
  });
}

