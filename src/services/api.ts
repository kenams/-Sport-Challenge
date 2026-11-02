// Accès aux données IMMORTAL. Toute décision (validation, points, droits) est prise par le serveur : le client lit et demande.
import { billingErrorMessage, type CheckoutPlan } from "../screens/helpers/billing";
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
  MyPrivateProfile,
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
  level_gap_too_large: "Écart de niveau trop important : les défis directs sont limités à 10 niveaux d’écart.",
  invalid_opponent: "Adversaire invalide.",
  opponent_not_found: "Adversaire introuvable.",
  date_in_past: "La date doit être dans le futur.",
  event_not_open: "Cet événement n'accepte plus de réponse.",
  event_closed: "Cet événement est terminé ou annulé.",
  event_not_open_for_support: "Le soutien n'est possible que pour un événement confirmé.",
  event_not_open_for_reminder: "Le rappel n'est possible que pour un événement confirmé.",
  invalid_supported_player: "Choisis l'un des deux joueurs.",
  participant_cannot_support: "Tu joues ce duel : tu ne peux pas te compter dans les soutiens.",
  pro_required: "Cette fonction fait partie d'IMMORTAL Pro.",
  invalid_code: "Code d'invitation invalide.",
  group_full: "Ce groupe est complet.",
  group_limit: "Tu as atteint la limite de groupes.",
  invalid_theme: "Thème inconnu.",
  deletion_failed: "La suppression n'a pas pu aboutir. Réessaie dans un instant ; rien n'est perdu à moitié.",
  comment_empty: "Écris un commentaire avant d'envoyer.",
  comment_too_long: "Ton commentaire dépasse 280 caractères.",
  comment_not_allowed: "Les commentaires sont possibles uniquement sur une performance validée.",
  comment_rate_limited: "Tu commentes trop vite. Réessaie dans quelques minutes.",
  cannot_cheer_own_attempt: "Tu ne peux pas t'encourager toi-même.",
  cannot_report_own_comment: "Tu ne peux pas signaler ton propre commentaire.",
  comment_duplicate: "Tu as déjà envoyé ce commentaire.",
  not_found: "Élément introuvable ou déjà supprimé.",
  profile_required: "Choisis un pseudo dans ton profil avant de commenter.",
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

export async function getMyPrivateProfile(): Promise<ApiResult<MyPrivateProfile>> {
  const uid = await currentUserId();
  if (!uid) return { data: null, error: ERROR_MESSAGES.not_authenticated };
  return wrap<MyPrivateProfile>(() =>
    supabase
      .from("player_private_profiles")
      .select("birth_date,gender,height_cm,weight_kg")
      .eq("user_id", uid)
      .maybeSingle()
  );
}

export async function updateMyPrivateProfile(input: MyPrivateProfile): Promise<ApiResult<{ user_id: string }>> {
  const uid = await currentUserId();
  if (!uid) return { data: null, error: ERROR_MESSAGES.not_authenticated };
  return wrap<{ user_id: string }>(() =>
    supabase
      .from("player_private_profiles")
      .upsert({ user_id: uid, ...input }, { onConflict: "user_id" })
      .select("user_id")
      .single()
  );
}

export async function getPlayerLevel(userId: string): Promise<number | null> {
  const result = await wrap<Array<{ level: number }>>(() =>
    supabase.from("players_stats").select("level").eq("user_id", userId).limit(1)
  );
  return result.data?.[0]?.level ?? null;
}

export async function searchPlayers(query: string): Promise<ApiResult<Array<{ user_id: string; pseudo: string | null; city: string | null; level: number | null }>>> {
  const profiles = await wrap<Array<{ user_id: string; pseudo: string | null; city: string | null }>>(() =>
    supabase
      .from("profiles")
      .select("user_id,pseudo,city")
      .ilike("pseudo", `%${query.replace(/[%_]/g, " ").trim()}%`)
      .limit(8)
  );
  if (profiles.error || !profiles.data?.length) return { data: profiles.data?.map((p) => ({ ...p, level: null })) ?? [], error: profiles.error };
  const stats = await wrap<Array<{ user_id: string; level: number }>>(() =>
    supabase.from("players_stats").select("user_id,level").in("user_id", profiles.data!.map((p) => p.user_id))
  );
  if (stats.error) return { data: null, error: stats.error };
  const levels = new Map((stats.data ?? []).map((item) => [item.user_id, item.level]));
  return { data: profiles.data.map((p) => ({ ...p, level: levels.get(p.user_id) ?? null })), error: null };
}

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
  // "Signalées" = tentatives avec au moins un signalement encore ouvert (report_count est cumulatif).
  let openCounts = new Map<string, number>();
  if (mode === "reported") {
    const open = await wrap<Array<{ attempt_id: string }>>(() => supabase.from("attempt_reports").select("attempt_id").eq("status", "open"));
    if (open.error || !open.data) return { data: null, error: open.error };
    for (const row of open.data) openCounts.set(row.attempt_id, (openCounts.get(row.attempt_id) ?? 0) + 1);
    if (openCounts.size === 0) return { data: [], error: null };
  }
  const result = await wrap<Attempt[]>(() => {
    let query = supabase.from("attempt_feed").select(FEED_COLUMNS).order("created_at", { ascending: true }).limit(50);
    query = mode === "pending" ? query.eq("status", "pending") : query.in("id", [...openCounts.keys()]).neq("status", "withdrawn");
    return query;
  });
  if (result.error || !result.data) return { data: null, error: result.error };
  return { data: result.data.map((a) => ({ ...a, open_reports: mode === "reported" ? openCounts.get(a.id) ?? 0 : a.report_count })), error: null };
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
  const { data, error } = await supabase.from("event_supporters").select("event_id,supported_user_id");
  if (error) throw new Error(describeError(error));
  return Object.fromEntries((data ?? []).map((row) => [row.event_id as string, row.supported_user_id as string]));
};

export const myReminders = async (): Promise<Set<string>> => {
  const { data, error } = await supabase.from("event_reminders").select("event_id");
  if (error) throw new Error(describeError(error));
  return new Set((data ?? []).map((row) => row.event_id as string));
};

// ---------- Droits Pro ----------

export async function getMyEntitlement(): Promise<Entitlement> {
  const uid = await currentUserId();
  const fallback: Entitlement = { plan: "free", status: "none", current_period_end: null, source: null };
  if (!uid) return fallback;
  const { data, error } = await supabase.from("entitlements").select("plan,status,current_period_end,source").eq("user_id", uid).maybeSingle();
  if (error) throw new Error(describeError(error));
  return (data as Entitlement | null) ?? fallback;
}

export async function isPro(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_pro");
  if (error) throw new Error(describeError(error));
  return data === true;
}

// ---------- Paiement web (Stripe) ----------

async function callBilling(name: "create-checkout-session" | "customer-portal", body: Record<string, unknown>): Promise<ApiResult<string>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error && typeof data?.url === "string") return { data: data.url, error: null };
    let code: unknown = data?.error;
    const context = (error as { context?: Response } | null)?.context;
    if (!code && context && typeof context.json === "function") code = (await context.json().catch(() => null))?.error;
    return { data: null, error: billingErrorMessage(code) };
  } catch {
    return { data: null, error: billingErrorMessage(null) };
  }
}

/** Demande au serveur une session de paiement Stripe (web). Renvoie l'URL de la page de paiement ; rien n'est débité ici. */
export const startCheckout = (plan: CheckoutPlan) => callBilling("create-checkout-session", { plan });

/** Demande au serveur l'URL du portail client Stripe (gérer le moyen de paiement, résilier). */
export const openBillingPortal = () => callBilling("customer-portal", {});

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

// ---------- Suppression de compte ----------

/** Supprime le compte du joueur connecté (vidéos, données, compte). Irréversible. Passe par l'Edge Function delete-account. */
export async function deleteMyAccount(): Promise<ApiResult<true>> {
  try {
    const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm: true } });
    if (error || !data?.ok) return { data: null, error: ERROR_MESSAGES.deletion_failed };
    // Le compte n'existe plus : on efface la session localement sans appeler le serveur (il répondrait 403).
    const auth = supabase.auth as unknown as { _removeSession?: () => Promise<void> };
    if (typeof auth._removeSession === "function") await auth._removeSession().catch(() => undefined);
    else await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return { data: true, error: null };
  } catch {
    return { data: null, error: ERROR_MESSAGES.deletion_failed };
  }
}

// ---------- Encouragements et commentaires (sans effet sur points ni classements) ----------

export type AttemptSocial = { cheer_count: number; comment_count: number; cheered_by_me: boolean; can_interact: boolean };
export type CommentRow = {
  id: number;
  user_id: string;
  pseudo: string | null;
  body: string;
  created_at: string;
  mine: boolean;
  status: "visible" | "hidden";
  report_count: number;
};
export type ReportedComment = {
  id: number;
  attempt_id: string;
  user_id: string;
  pseudo: string | null;
  body: string;
  status: "visible" | "hidden";
  open_reports: number;
  created_at: string;
};
export type CommentReportReason = "spam" | "harassment" | "inappropriate" | "other";

export async function getAttemptSocial(attemptId: string): Promise<ApiResult<AttemptSocial | null>> {
  const result = await wrap<AttemptSocial[]>(() => supabase.rpc("attempt_social", { p_attempt: attemptId }));
  if (result.error) return { data: null, error: result.error };
  return { data: result.data?.[0] ?? null, error: null };
}
export const setCheer = (attemptId: string, on: boolean) => wrap<number>(() => supabase.rpc("set_cheer", { p_attempt: attemptId, p_on: on }));
export const listComments = (attemptId: string, limit = 50, before: number | null = null) =>
  wrap<CommentRow[]>(() => supabase.rpc("list_comments", { p_attempt: attemptId, p_limit: limit, p_before: before }));
export const postComment = (attemptId: string, body: string) => wrap<number>(() => supabase.rpc("post_comment", { p_attempt: attemptId, p_body: body }));
export const deleteComment = (id: number) => wrap(() => supabase.rpc("delete_comment", { p_id: id }));
export const reportComment = (id: number, reason: CommentReportReason) => wrap(() => supabase.rpc("report_comment", { p_id: id, p_reason: reason }));
export const listReportedComments = () => wrap<ReportedComment[]>(() => supabase.rpc("list_reported_comments"));
export const moderateComment = (id: number, action: "hide" | "restore" | "dismiss_reports", reason?: string | null) =>
  wrap(() => supabase.rpc("moderate_comment", { p_id: id, p_action: action, p_reason: reason ?? null }));
