import type { DuelEvent, EventStatus } from "../../domain/types";

export type EventTone = "muted" | "warning" | "success" | "danger" | "gold";

export const EVENT_STATUS_INFO: Record<EventStatus, { label: string; tone: EventTone; help: string }> = {
  proposed: { label: "Proposé", tone: "warning", help: "Proposé, en attente d'accord. Le duel n'est pas confirmé tant que l'adversaire n'a pas accepté." },
  accepted: { label: "Accepté", tone: "warning", help: "Au moins un joueur a accepté. Le duel n'est confirmé qu'une fois programmé par le serveur." },
  scheduled: { label: "Programmé", tone: "gold", help: "Les deux joueurs ont accepté : le duel est confirmé." },
  live: { label: "En cours", tone: "success", help: "Le duel a commencé." },
  finished: { label: "Terminé", tone: "muted", help: "Le duel est terminé." },
  cancelled: { label: "Annulé", tone: "danger", help: "Le duel a été annulé." },
  expired: { label: "Expiré", tone: "muted", help: "L'invitation n'a pas reçu de réponse sous 48 heures. Aucune défaite ni perte de points." },
};

export function eventStatusInfo(status: string) {
  return EVENT_STATUS_INFO[status as EventStatus] ?? { label: "Inconnu", tone: "muted" as EventTone, help: "" };
}

/** Seul le statut `scheduled` (ou ultérieur) est une confirmation. */
export function isConfirmed(status: EventStatus): boolean {
  return status === "scheduled" || status === "live" || status === "finished";
}

/** Bandeau d'affiche : un duel non confirmé ne doit jamais être présenté comme confirmé. */
export function posterBanner(status: EventStatus): string {
  switch (status) {
    case "proposed":
      return "Proposé, en attente d'accord";
    case "accepted":
      return "En attente de confirmation";
    case "scheduled":
      return "Duel confirmé";
    case "live":
      return "En cours";
    case "finished":
      return "Terminé";
    case "cancelled":
      return "Annulé";
    case "expired":
      return "Invitation expirée";
    default:
      return "";
  }
}

export type EventRole = "player_a" | "player_b" | "visitor";

export function roleOf(event: Pick<DuelEvent, "player_a" | "player_b">, uid: string | null): EventRole {
  if (uid && uid === event.player_a) return "player_a";
  if (uid && uid === event.player_b) return "player_b";
  return "visitor";
}

export function canRespond(event: DuelEvent, uid: string | null): boolean {
  const role = roleOf(event, uid);
  if (role === "visitor") return false;
  if (event.status !== "proposed" && event.status !== "accepted") return false;
  if (event.proposal_expires_at && Date.parse(event.proposal_expires_at) <= Date.now()) return false;
  const mine = role === "player_a" ? event.accepted_by_a : event.accepted_by_b;
  return !mine;
}

export function canCancel(event: DuelEvent, uid: string | null): boolean {
  if (roleOf(event, uid) === "visitor") return false;
  return event.status === "proposed" || event.status === "accepted" || event.status === "scheduled";
}

/** Soutiens et rappels : uniquement pour un duel confirmé et pas encore commencé. */
export function canSupport(status: EventStatus): boolean {
  return status === "scheduled";
}

export function supportClosedReason(status: EventStatus): string {
  if (status === "proposed" || status === "accepted") return "Le soutien ouvre quand les deux joueurs ont accepté le duel.";
  if (status === "cancelled") return "Ce duel est annulé.";
  if (status === "expired") return "L'invitation a expiré sans défaite ni perte de points.";
  if (status === "finished") return "Ce duel est terminé.";
  if (status === "live") return "Le soutien n'est plus modifiable pendant le duel.";
  return "";
}
