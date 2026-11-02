// Suppression de compte : mot de confirmation et texte de ce qui est supprimé (logique pure, testée).

export const DELETE_CONFIRM_WORD = "SUPPRIMER";

export function isDeletionConfirmed(input: string): boolean {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase() === DELETE_CONFIRM_WORD;
}

export const DELETION_SUMMARY: string[] = [
  "Ton profil, ton pseudo, ton territoire et tes statistiques.",
  "Toutes tes performances et tes vidéos (fichiers effacés du stockage).",
  "Tes défis, tes duels et tes événements. Tes commentaires et tes encouragements.",
  "Ton compte de connexion : tu ne pourras plus te connecter avec cet e-mail.",
];

export const DELETION_KEPT: string[] = [
  "Les performances et les classements des autres joueurs ne changent pas. Les réponses que d'autres ont données à tes défis restent visibles sans ton défi.",
  "Les groupes privés que tu as créés sont supprimés pour leurs membres.",
];

export const DELETION_PRO_WARNING =
  "Si tu as un abonnement Pro, supprimer ton compte ne le résilie pas automatiquement : résilie-le d'abord dans la boutique qui le facture.";
