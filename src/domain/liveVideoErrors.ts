export function liveVideoErrorMessage(code?: string): string {
  switch (code) {
    case "live_video_not_configured":
      return "Le live vidéo n’est pas configuré sur le serveur. Filmer puis envoyer une vidéo reste possible, mais le direct à deux nécessite LiveKit.";
    case "live_event_not_started":
      return "Le live ouvrira 30 minutes avant l’heure prévue.";
    case "live_event_not_found":
      return "Ce duel n’est plus disponible pour le live.";
    default:
      return "Connexion vidéo impossible. Vérifie le serveur live et le réseau, puis réessaie.";
  }
}
