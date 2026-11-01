// Validation et messages d'erreur d'authentification (logique pure, sans dépendance native).

export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 24;
export const PASSWORD_MIN = 8;
export const TERRITORY_MAX = 60;

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Saisis ton adresse e-mail.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Cette adresse e-mail ne semble pas valide.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Choisis un mot de passe.";
  if (value.length < PASSWORD_MIN) return `Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`;
  return null;
}

export function validatePseudo(value: string): string | null {
  const pseudo = cleanText(value);
  if (pseudo.length < PSEUDO_MIN || pseudo.length > PSEUDO_MAX) {
    return `Le pseudo doit faire entre ${PSEUDO_MIN} et ${PSEUDO_MAX} caractères.`;
  }
  return null;
}

export type TerritoryInput = { country: string; region: string; city: string };

export function normalizeTerritory(input: TerritoryInput): TerritoryInput {
  return { country: cleanText(input.country), region: cleanText(input.region), city: cleanText(input.city) };
}

export function validateTerritory(input: TerritoryInput): string | null {
  const t = normalizeTerritory(input);
  if (t.region.length > TERRITORY_MAX || t.city.length > TERRITORY_MAX) {
    return `La région et la ville doivent faire ${TERRITORY_MAX} caractères au maximum.`;
  }
  return null;
}

export function isTerritoryEmpty(input: Partial<TerritoryInput>): boolean {
  return !cleanText(input.country ?? "") && !cleanText(input.region ?? "") && !cleanText(input.city ?? "");
}

type AuthErrorLike = { message?: string; code?: string; status?: number } | null | undefined;

/** Traduit une erreur Supabase Auth en message français précis. */
export function describeAuthError(error: AuthErrorLike, context: "signin" | "signup" | "reset" = "signin"): string {
  if (!error) return "";
  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  if (/failed to fetch|network|fetch failed|timeout/.test(message)) return "Connexion impossible. Vérifie ton réseau et réessaie.";
  if (code === "user_already_exists" || /already registered|already been registered|already exists/.test(message)) {
    return "Un compte existe déjà avec cet e-mail. Connecte-toi ou utilise « Mot de passe oublié ».";
  }
  if (code === "weak_password" || /password should|weak password|password is too/.test(message)) {
    return `Mot de passe trop faible. Utilise au moins ${PASSWORD_MIN} caractères, avec des lettres et des chiffres.`;
  }
  if (code === "invalid_credentials" || /invalid login credentials/.test(message)) return "E-mail ou mot de passe incorrect.";
  if (code === "email_not_confirmed" || /email not confirmed/.test(message)) {
    return "Ton adresse e-mail n'est pas encore confirmée. Ouvre le lien reçu par e-mail, puis reconnecte-toi.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429 || /rate limit|too many/.test(message)) {
    return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
  }
  if (code === "email_address_invalid" || /invalid email|email address .* is invalid/.test(message)) return "Cette adresse e-mail n'est pas acceptée.";
  if (code === "signup_disabled" || /signups not allowed/.test(message)) return "Les inscriptions sont fermées pour le moment.";
  if (context === "signup") return "Inscription impossible pour le moment. Réessaie dans un instant.";
  if (context === "reset") return "Impossible d'envoyer l'e-mail pour le moment. Réessaie dans un instant.";
  return "Connexion impossible pour le moment. Réessaie dans un instant.";
}

/**
 * Avec la confirmation d'e-mail activée, Supabase ne renvoie pas d'erreur pour un e-mail déjà inscrit :
 * il renvoie un utilisateur sans aucune identité.
 */
export function isSignUpEmailAlreadyUsed(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}
