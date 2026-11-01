// Accès aux données IMMORTAL. Toute décision (validation, points, droits) est prise par le serveur : le client lit et demande.
import { supabase } from "../supabase";
import type {
  Attempt,
  ChallengeFormat,
  DuelEvent,
  Entitlement,
  FormatKey,
  LeaderboardRow,
  ModerationQueueItem,
  MyProfile,
  MyStats,
  PublicEvent,
  TerritoryScope,
} from "../domain/types";
import { FALLBACK_FORMATS } from "../domain/formats";

export type ApiResult<T> = { data: T | null; error: string | null };

/** Messages d'erreur serveur (codes stables) traduits pour le joueur. */
const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "Connecte-toi pour continuer.",
  rate_limited: "Trop d'actions en peu de temps. Réessaie plus tard.",
  invalid_score: "Score invalide pour ce format.",
  invalid_video_path: "Vidéo invalide. Réessaie l'envoi.",
  invalid_duration: "La vidéo est trop longue pour ce format.",
  invalid_title: "Le titre est trop long (80 caractères maximum).",
  unknown_format: "Format d'épreuve inconnu.",
  discipline_disabled: "Cette discipline n'est pas disponible pour le moment.",
  challenge_unavailable: "Ce défi n'est plus disponible.",
  cannot_answer_own_challenge: "Tu ne peux pas répondre à ton propre défi.",
  format_mismatch: "Ta réponse doit utiliser le même format que le défi.",
  challenge_reserved: "Ce défi est réservé à un autre joueur.",
  invalid_recipient: "Adversaire invalide.",
  only_pending_can_be_withdrawn: "Seule une performance en attente peut être retirée.",
  cannot_report_own_attempt: "Tu ne peux pas signaler ta propre performance.",
  forbidden: "Action non autorisée.",
  moderator_cannot_decide_own_attempt: "Tu ne peux pas décider de ta propre performance.",
  reason_required: "Un motif est obligatoire.",
  invalid_pseudo: "Le pseudo doit faire entre 2 et 24 caractères.",
  invalid_opponent: "Adversaire invalide.",
  opponent_not_found: "Adversaire introuvable.",
  date_in_past: "La date doit être dans le futur.",
  event_not_open: "Cet événement n'accepte plus de réponse.",
  event_closed: "Cet événement est terminé ou annulé.",
  event_not_open_for_support: "Le soutien n'est possible que pour un événement confirmé.",
  event_not_open_for_reminder: "Le rappel n'est possible que pour un événement confirmé.",
  invalid_supported_player: "Choisis l'un des deux joueurs.",
  pro_required: "Cette fonction fait partie d'IMMORTAL Pro.",
  invalid_code: "Code d'invitation invalide.",
  group_full: "Ce groupe est complet.",
  group_limit: "Tu as atteint la limite de groupes.",
  invalid_theme: "Thème inconnu.",
};

export function describeError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "";
  const raw = (error.message ?? "").trim();
  if (ERROR_MESSAGES[raw]) return ERROR_MESSAGES[raw];
  if (/Failed to fetch|Network request failed|network/i.test(raw)) return "Connexion impossible. Vérifie ton réseau et réessaie.";
  if (/duplicate key|unique/i.test(raw)) return "Cette action a déjà été enregistrée.";
  return "Une erreur est survenue. Réessaie dans un instant.";
}

async function wrap<T>(run: () => PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>): Promise<ApiResult<T>> {
  try {
    const { data, error } = await run();
    if (error) return { data: null, error: describeError(error) };
    return { data, error: null };
  } catch (caught) {
    return { data: null, error: describeError(caught as { message?: string }) };
  }
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ---------- Profil ----------

export const ensurePlayer = () => wrap(() => supabase.rpc("ensure_player"));

export const updateMyProfile = (input: { pseudo: string; city: string; region: string; country: string; locale?: "fr" | "en" }) =>
  wrap(() =>
    supabase.rpc("update_my_profile", {
      p_pseudo: input.pseudo,
      p_city: input.city,
      p_region: input.region,
      p_country: input.country,
      p_locale: input.locale ?? "fr",
    })
  );

export async function getMyProfile(): Promise<ApiResult<MyProfile>> {
  const uid = await currentUserId();
  if (!uid) return { data: null, error: ERROR_MESSAGES.not_authenticated };
  return wrap<MyProfile>(() =>
    supabase.from("profiles").select("user_id,pseudo,avatar_url,city,region,country,locale,card_theme").eq("user_id", uid).maybeSingle()
  );
}

export async function getMyStats(): Promise<ApiResult<MyStats>> {
  const result = await wrap<MyStats[]>(() => supabase.rpc("my_stats"));
  if (result.error) return { data: null, error: result.error };
  return { data: result.data?.[0] ?? { points: 0, level: 1, validated_count: 0 }, error: null };
}

export const searchPlayers = (query: string) =>
  wrap<Array<{ user_id: string; pseudo: string | null; city: string | null }>>(() =>
    supabase
      .from("profiles")
      .select("user_id,pseudo,city")
      .ilike("pseudo", `%${query.replace(/[%_]/g, " ").trim()}%`)
      .limit(8)
  );

// ---------- Formats ----------

export async function listFormats(): Promise<ChallengeFormat[]> {
  const result = await wrap<ChallengeFormat[]>(() => supabase.from("challenge_formats").select("*").eq("active", true).order("key"));
  return result.data && result.data.length > 0 ? result.data : FALLBACK_FORMATS;
}

// ---------- Défis et tentatives ----------

const FEED_COLUMNS = "*";

export const listChallengeFeed = (opts: { format?: FormatKey | null; limit?: number; offset?: number } = {}) => {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  return wrap<Attempt[]>(() => {
    let query = supabase
      .from("attempt_feed")
      .select(FEED_COLUMNS)
      .eq("kind", "challenge")
      .in("status", ["pending", "validated"])
      .eq("video_removed", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts.format) query = query.eq("format_key", opts.format);
    return query;
  });
};

export const getAttempt = (id: string) => wrap<Attempt>(() => supabase.from("attempt_feed").select(FEED_COLUMNS).eq("id", id).maybeSingle());

export const listResponses = (challengeId: string) =>
  wrap<Attempt[]>(() =>
    supabase
      .from("attempt_feed")
      .select(FEED_COLUMNS)
      .eq("challenge_id", challengeId)
      .eq("kind", "response")
      .neq("status", "withdrawn")
      .order("created_at", { ascending: true })
  );

export async function listMyAttempts(limit = 30): Promise<ApiResult<Attempt[]>> {
  const uid = await currentUserId();
  if (!uid) return { data: null, error: ERROR_MESSAGES.not_authenticated };
  return wrap<Attempt[]>(() =>
    supabase.from("attempt_feed").select(FEED_COLUMNS).eq("user_id", uid).neq("status", "withdrawn").order("created_at", { ascending: false }).limit(limit)
  );
}

export async function submitAttempt(input: {
  format: FormatKey;
  declaredScore: number;
  videoPath: string;
  durationSeconds?: number | null;
  title?: string | null;
  challengeId?: string | null;
  recipientId?: string | null;
}): Promise<ApiResult<string>> {
  return wrap<string>(() =>
    supabase.rpc("submit_attempt", {
      p_format: input.format,
      p_declared: input.declaredScore,
      p_video_path: input.videoPath,
      p_duration: input.durationSeconds ?? null,
      p_title: input.title ?? null,
      p_challenge_id: input.challengeId ?? null,
      p_recipient: input.recipientId ?? null,
    })
  );
}

export const withdrawAttempt = (id: string) => wrap(() => supabase.rpc("withdraw_attempt", { p_id: id }));

export const reportAttempt = (id: string, reason: "wrong_count" | "not_the_exercise" | "fake_or_edited" | "inappropriate" | "other", details?: string) =>
  wrap(() => supabase.rpc("report_attempt", { p_id: id, p_reason: reason, p_details: details ?? null }));

/** Lien temporaire de lecture d'une vidéo (le stockage est privé). */
export async function getVideoUrl(path: string, seconds = 3600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from("attempt-videos").createSignedUrl(path, seconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

// ---------- Classements et progression ----------

export const getLeaderboard = (format: FormatKey, scope: TerritoryScope, value: string | null, limit = 50) =>
  wrap<LeaderboardRow[]>(() => supabase.rpc("leaderboard", { p_format: format, p_scope: scope, p_value: value, p_limit: limit }));

export const getCurrentWeeklyChallenge = () =>
  wrap<Array<{ week_start: string; format_key: FormatKey; note_fr: string | null }>>(() => supabase.rpc("current_weekly_challenge"));

export async function getMyBest(format: FormatKey): Promise<number | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data } = await supabase
    .from("attempts")
    .select("decided_score")
    .eq("user_id", uid)
    .eq("format_key", format)
    .eq("status", "validated")
    .order("decided_score", { ascending: false })
    .limit(1);
  return data?.[0]?.decided_score ?? null;
}

// ---------- Modération ----------

export async function isModerator(): Promise<boolean> {
  const { data } = await supabase.rpc("is_moderator");
  return data === true;
}

export async function listModerationQueue(mode: "pending" | "reported"): Promise<ApiResult<ModerationQueueItem[]>> {
  const result = await wrap<Attempt[]>(() => {
    let query = supabase.from("attempt_feed").select(FEED_COLUMNS).order("created_at", { ascending: true }).limit(50);
    query = mode === "pending" ? query.eq("status", "pending") : query.gt("report_count", 0).neq("status", "withdrawn");
    return query;
  });
  if (result.error || !result.data) return { data: null, error: result.error };
  return { data: result.data.map((a) => ({ ...a, open_reports: a.report_count })), error: null };
}

export const moderateAttempt = (id: string, action: "validate" | "reject" | "restore" | "remove_video" | "restore_video" | "dismiss_reports", score?: number | null, reason?: string | null) =>
  wrap(() => supabase.rpc("moderate_attempt", { p_id: id, p_action: action, p_score: score ?? null, p_reason: reason ?? null }));

export const listAttemptReports = (attemptId: string) =>
  wrap<Array<{ id: number; reason: string; details: string | null; status: string; created_at: string }>>(() =>
    supabase.from("attempt_reports").select("id,reason,details,status,created_at").eq("attempt_id", attemptId).order("created_at", { ascending: true })
  );

// ---------- Événements ----------

export const proposeEvent = (opponentId: string, format: FormatKey, scheduledAt: string, timezone = "Europe/Paris") =>
  wrap<string>(() => supabase.rpc("propose_event", { p_opponent: opponentId, p_format: format, p_scheduled_at: scheduledAt, p_timezone: timezone }));

export const respondEvent = (id: string, accept: boolean) => wrap(() => supabase.rpc("respond_event", { p_id: id, p_accept: accept }));
export const cancelEvent = (id: string) => wrap(() => supabase.rpc("cancel_event", { p_id: id }));
export const supportEvent = (id: string, playerId: string) => wrap(() => supabase.rpc("support_event", { p_id: id, p_supported: playerId }));
export const toggleReminder = (id: string) => wrap<boolean>(() => supabase.rpc("toggle_reminder", { p_id: id }));

export const getPublicEvent = (slug: string) => wrap<PublicEvent | null>(() => supabase.rpc("get_public_event", { p_slug: slug }));

export const listUpcomingEvents = () =>
  wrap<DuelEvent[]>(() =>
    supabase
      .from("duel_events")
      .select("*")
      .in("status", ["proposed", "accepted", "scheduled", "live"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(30)
  );

export const myEventSupport = async (): Promise<Record<string, string>> => {
  const { data } = await supabase.from("event_supporters").select("event_id,supported_user_id");
  return Object.fromEntries((data ?? []).map((row) => [row.event_id as string, row.supported_user_id as string]));
};

export const myReminders = async (): Promise<Set<string>> => {
  const { data } = await supabase.from("event_reminders").select("event_id");
  return new Set((data ?? []).map((row) => row.event_id as string));
};

// ---------- Droits Pro ----------

export async function getMyEntitlement(): Promise<Entitlement> {
  const uid = await currentUserId();
  const fallback: Entitlement = { plan: "free", status: "none", current_period_end: null, source: null };
  if (!uid) return fallback;
  const { data } = await supabase.from("entitlements").select("plan,status,current_period_end,source").eq("user_id", uid).maybeSingle();
  return (data as Entitlement | null) ?? fallback;
}

export async function isPro(): Promise<boolean> {
  const { data } = await supabase.rpc("is_pro");
  return data === true;
}

export const myProgress = (format: FormatKey) =>
  wrap<Array<{ week_start: string; best_score: number; validated_count: number }>>(() => supabase.rpc("my_progress", { p_format: format }));

export const setCardTheme = (theme: "gold" | "steel" | "crimson" | "emerald") => wrap(() => supabase.rpc("set_card_theme", { p_theme: theme }));
export const createGroup = (name: string) => wrap<string>(() => supabase.rpc("create_group", { p_name: name }));
export async function joinGroup(code: string): Promise<ApiResult<string>> {
  const result = await wrap<string | null>(() => supabase.rpc("join_group", { p_code: code }));
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: ERROR_MESSAGES.invalid_code };
  return { data: result.data, error: null };
}
export const myGroups = () => wrap<Array<{ id: string; name: string; invite_code: string; owner_id: string }>>(() => supabase.from("groups").select("id,name,invite_code,owner_id"));
export const groupLeaderboard = (groupId: string, format: FormatKey) =>
  wrap<Array<{ rank: number; user_id: string; pseudo: string | null; best_score: number; achieved_at: string }>>(() =>
    supabase.rpc("group_leaderboard", { p_group: groupId, p_format: format })
  );
