// Saisie d'une date/heure locale dans un fuseau IANA, convertie en instant UTC (ISO).

export const DEFAULT_TIMEZONE = "Europe/Paris";

export function isValidTimezone(tz: string): boolean {
  if (!tz || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: tz.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Décalage (ms) du fuseau par rapport à UTC à l'instant donné. */
export function tzOffsetMs(ts: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

export type ParseResult = { ok: true; iso: string } | { ok: false; error: string };

export function partsToIso(parts: LocalParts, tz: string, now: number = Date.now()): ParseResult {
  const { year, month, day, hour, minute } = parts;
  const all = [year, month, day, hour, minute];
  if (all.some((n) => !Number.isInteger(n))) return { ok: false, error: "Renseigne tous les champs de date et d'heure avec des nombres." };
  if (year < 2020 || year > 2100) return { ok: false, error: "Année invalide." };
  if (month < 1 || month > 12) return { ok: false, error: "Mois invalide (1 à 12)." };
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return { ok: false, error: "Heure invalide (0 à 23 h, 0 à 59 min)." };
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return { ok: false, error: "Ce jour n'existe pas dans ce mois." };
  if (!isValidTimezone(tz)) return { ok: false, error: "Fuseau horaire inconnu (exemple : Europe/Paris)." };
  const zone = tz.trim();
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ts = guess - tzOffsetMs(guess, zone);
  ts = guess - tzOffsetMs(ts, zone);
  // Vérification aller-retour : au passage à l'heure d'été, certaines heures n'existent pas.
  if (ts + tzOffsetMs(ts, zone) !== guess) {
    return { ok: false, error: "Cette heure n'existe pas dans ce fuseau à cause du changement d'heure. Choisis une autre heure." };
  }
  // Une heure répétée en automne désigne deux instants : demander une heure non ambiguë.
  const offsets = new Set([-86400000, 0, 86400000].map((delta) => tzOffsetMs(ts + delta, zone)));
  const matches = [...offsets].filter((offset) => {
    const candidate = guess - offset;
    return candidate + tzOffsetMs(candidate, zone) === guess;
  });
  if (matches.length > 1) return { ok: false, error: "Cette heure se produit deux fois lors du changement d'heure. Choisis une autre heure pour éviter toute confusion." };
  if (ts < now + 30 * 60 * 1000) return { ok: false, error: "Choisis un créneau au moins 30 minutes à l'avance." };
  if (ts > now + 14 * 24 * 60 * 60 * 1000) return { ok: false, error: "Un duel direct doit être programmé dans les 14 prochains jours." };
  return { ok: true, iso: new Date(ts).toISOString() };
}

/** Valeur d'un champ datetime-local : "AAAA-MM-JJTHH:mm". */
export function parseDatetimeLocal(value: string): LocalParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] };
}

export function toInt(text: string): number {
  return /^\d{1,4}$/.test(text.trim()) ? parseInt(text.trim(), 10) : NaN;
}
