// Tests des règles serveur IMMORTAL : plusieurs comptes, un modérateur, un visiteur anonyme.
// Usage : SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-server-rules.mjs
// À lancer UNIQUEMENT contre une base locale de test (jamais la production).
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE || !/127\.0\.0\.1|localhost/.test(URL)) {
  console.error("Refus : ce script ne tourne que contre une base locale (127.0.0.1).");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);
const anon = createClient(URL, ANON, opts);
const PASSWORD = "Immortal!Test12345";
const stamp = Date.now();

let passed = 0;
const failures = [];
function ok(name, condition, detail = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? " — " + detail : ""}`);
  console.log(`${condition ? "OK " : "KO "} ${name}${!condition && detail ? "  → " + detail : ""}`);
}
const errText = (error) => (error ? `${error.code ?? ""} ${error.message ?? ""}`.trim() : "");

async function makeUser(label) {
  const email = `${label}.${stamp}@immortal-test.example`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const client = createClient(URL, ANON, opts);
  const { error: signError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signError) throw new Error(`signIn ${label}: ${signError.message}`);
  return { id: data.user.id, email, client };
}

async function profile(user, pseudo, city, region, country) {
  const { error } = await user.client.rpc("update_my_profile", { p_pseudo: pseudo, p_city: city, p_region: region, p_country: country, p_locale: "fr" });
  if (error) throw new Error(`profile ${pseudo}: ${error.message}`);
}

let videoCounter = 0;
async function submit(user, format, score, extra = {}) {
  videoCounter += 1;
  return user.client.rpc("submit_attempt", {
    p_format: format,
    p_declared: score,
    p_video_path: extra.path ?? `${user.id}/v${stamp}-${videoCounter}.mp4`,
    p_duration: extra.duration ?? 60,
    p_title: extra.title ?? null,
    p_challenge_id: extra.challengeId ?? null,
    p_recipient: extra.recipient ?? null,
  });
}
const moderate = (mod, id, action, score = null, reason = null) =>
  mod.client.rpc("moderate_attempt", { p_id: id, p_action: action, p_score: score, p_reason: reason });
const pointsOf = async (user) => (await user.client.rpc("my_stats")).data?.[0]?.points ?? -1;

// Base locale de test : on repart d'un état propre (le script refuse déjà toute base non locale).
async function resetTestData() {
  for (const table of ["moderation_log", "attempt_reports", "event_reminders", "event_supporters", "duel_events", "group_members", "group_join_failures", "groups", "payment_events", "entitlements", "attempts"]) {
    await admin.from(table).delete().not("created_at", "is", null).then(() => {}, () => {});
  }
  await admin.from("payment_events").delete().neq("event_id", "");
  await admin.from("entitlements").delete().neq("plan", "x");
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of data?.users ?? []) {
    if (u.email?.endsWith("@immortal-test.example")) await admin.auth.admin.deleteUser(u.id);
  }
}
await resetTestData();

const alice = await makeUser("alice");
const bob = await makeUser("bob");
const carol = await makeUser("carol");
const dave = await makeUser("dave");
const mod = await makeUser("mod");
await admin.from("admin_users").insert({ user_id: mod.id });

await profile(alice, "Alice", "Toulouse", "Occitanie", "France");
await profile(bob, "Bob", "Montauban", "Occitanie", "France");
await profile(carol, "Carol", "Lyon", "Auvergne-Rhône-Alpes", "France");
await profile(dave, "Dave", "Madrid", "Madrid", "Espagne");
await profile(mod, "Modo", "Paris", "Île-de-France", "France");

console.log("\n=== 1. Failles du schéma d'origine fermées ===");
{
  const upd = await alice.client.from("players_stats").update({ points: 99999, level: 99 }).eq("user_id", alice.id).select();
  const stats = await admin.from("players_stats").select("points").eq("user_id", alice.id).maybeSingle();
  ok("un joueur ne peut pas modifier ses propres points", (stats.data?.points ?? 0) === 0 && (upd.data ?? []).length === 0, errText(upd.error));
  const ins = await alice.client.from("players_stats").upsert({ user_id: alice.id, points: 5000 });
  ok("un joueur ne peut pas réécrire sa ligne de statistiques", !!ins.error);
  const wal = await alice.client.from("wallets").upsert({ user_id: alice.id, coins: 10000 });
  ok("un joueur ne peut pas s'attribuer des pièces", !!wal.error);
  const ap = await alice.client.rpc("add_points", { p_user_id: alice.id, p_points: 1000 });
  ok("add_points n'est plus appelable par un joueur", !!ap.error);
  const apAnon = await anon.rpc("add_points", { p_user_id: alice.id, p_points: 1000 });
  ok("add_points n'est pas appelable en anonyme", !!apAnon.error);
  const bat = await alice.client.from("battles").insert({ challenge_id: 1, player1_id: alice.id, player2_id: bob.id });
  ok("un joueur ne peut pas créer de duel/mise", !!bat.error);
  const pun = await alice.client.from("punishments").insert({ user_id: bob.id });
  ok("un joueur ne peut pas infliger de punition", !!pun.error);
  await admin.from("push_tokens").insert({ user_id: bob.id, token: "ExponentPushToken[secret]" });
  const tok = await alice.client.from("push_tokens").select("token").eq("user_id", bob.id);
  ok("les jetons de notification des autres sont invisibles", (tok.data ?? []).length === 0);
  const usr = await alice.client.from("users").select("id").neq("id", alice.id);
  ok("la table users n'expose pas les autres comptes", (usr.data ?? []).length === 0);
  const evt = await alice.client.from("events").insert({ type: "fake", payload: {} });
  ok("la télémétrie ne peut pas être falsifiée par un joueur", !!evt.error);
  const resp = await alice.client.from("challenge_responses").insert({ challenge_id: 1, user_id: alice.id, video_url: "x", votes: 9999, is_winner: true });
  ok("l'ancienne table de réponses n'est plus inscriptible par le client", !!resp.error);
}

console.log("\n=== 2. Profil et territoire déclaré ===");
{
  const { data } = await alice.client.from("profiles").select("pseudo,city,region,country").eq("user_id", alice.id).single();
  ok("le profil enregistre pseudo, ville, région, pays", data?.pseudo === "Alice" && data?.city === "Toulouse" && data?.country === "France");
  const bad = await alice.client.rpc("update_my_profile", { p_pseudo: "A", p_city: "", p_region: "", p_country: "", p_locale: "fr" });
  ok("un pseudo trop court est refusé", !!bad.error);
}

console.log("\n=== 3. Soumission d'une tentative ===");
let aliceChallenge;
{
  const direct = await alice.client.from("attempts").insert({ user_id: alice.id, kind: "challenge", format_key: "pushups_60s", discipline: "pushups", rules_version: 1, declared_score: 40, video_path: `${alice.id}/direct.mp4`, status: "validated", decided_score: 40, decided_at: new Date().toISOString() });
  ok("insertion directe dans attempts refusée (validation forcée impossible)", !!direct.error);

  const r = await submit(alice, "pushups_60s", 40, { title: "Mon premier défi" });
  aliceChallenge = r.data;
  ok("un joueur soumet une tentative", !r.error && !!aliceChallenge, errText(r.error));
  const row = (await admin.from("attempts").select("status,kind,declared_score,city_declared,decided_score").eq("id", aliceChallenge).single()).data;
  ok("la tentative est en attente, avec le territoire déclaré au moment de l'envoi", row?.status === "pending" && row?.kind === "challenge" && row?.city_declared === "Toulouse" && row?.decided_score === null);

  ok("score à 0 refusé", !!(await submit(alice, "pushups_60s", 0)).error);
  ok("score au-dessus du plafond du format refusé", !!(await submit(alice, "pushups_60s", 201)).error);
  ok("format inconnu refusé (ex. basket)", !!(await submit(alice, "basket_shots", 10)).error);
  ok("chemin vidéo dans le dossier d'un autre refusé", !!(await submit(alice, "pushups_60s", 10, { path: `${bob.id}/vol.mp4` })).error);
  ok("durée vidéo excessive refusée", !!(await submit(alice, "pushups_60s", 10, { duration: 9999 })).error);
  const same = await submit(alice, "pushups_60s", 10, { path: `${alice.id}/reuse.mp4` });
  const again = await submit(alice, "pushups_60s", 10, { path: `${alice.id}/reuse.mp4` });
  ok("la même vidéo ne peut pas être réutilisée", !same.error && !!again.error);
  const w = await alice.client.rpc("withdraw_attempt", { p_id: same.data });
  ok("l'auteur peut retirer une tentative en attente", !w.error, errText(w.error));
  const wOther = await bob.client.rpc("withdraw_attempt", { p_id: aliceChallenge });
  ok("un autre joueur ne peut pas retirer ma tentative", !!wOther.error);
}

console.log("\n=== 4. Réponse à un défi ===");
let bobResponse;
{
  const own = await submit(alice, "pushups_60s", 30, { challengeId: aliceChallenge });
  ok("on ne peut pas répondre à son propre défi", !!own.error);
  const mismatch = await submit(bob, "pullups_max", 8, { challengeId: aliceChallenge });
  ok("la réponse doit être du même format", !!mismatch.error);
  const r = await submit(bob, "pushups_60s", 35, { challengeId: aliceChallenge });
  bobResponse = r.data;
  ok("un ami répond au défi", !r.error && !!bobResponse, errText(r.error));
  const twice = await submit(bob, "pushups_60s", 36, { challengeId: aliceChallenge });
  ok("une seule réponse par joueur et par défi", !!twice.error);
  const reserved = await submit(alice, "pushups_60s", 20, { recipient: carol.id });
  const reservedAnswer = await submit(dave, "pushups_60s", 25, { challengeId: reserved.data });
  const reservedOk = await submit(carol, "pushups_60s", 25, { challengeId: reserved.data });
  ok("un défi nominatif n'accepte que son destinataire", !reserved.error && !!reservedAnswer.error && !reservedOk.error);
}

console.log("\n=== 5. Modération, validation et points ===");
{
  const nonMod = await moderate(alice, aliceChallenge, "validate", 40);
  ok("un joueur ne peut pas valider (même sa propre tentative)", !!nonMod.error);
  const selfMod = await admin.from("admin_users").insert({ user_id: alice.id });
  const selfValidate = await moderate(alice, aliceChallenge, "validate", 40);
  ok("un modérateur ne peut pas valider sa propre tentative", !!selfValidate.error, errText(selfValidate.error));
  await admin.from("admin_users").delete().eq("user_id", alice.id);

  ok("validation sans score refusée", !!(await moderate(mod, aliceChallenge, "validate")).error);
  ok("score validé au-dessus du plafond refusé", !!(await moderate(mod, aliceChallenge, "validate", 999)).error);
  ok("rejet sans motif refusé", !!(await moderate(mod, aliceChallenge, "reject")).error);

  const before = await pointsOf(alice);
  const v = await moderate(mod, aliceChallenge, "validate", 38, "Compté 38 sur 40 déclarées");
  ok("le modérateur valide avec le score retenu et un motif", !v.error, errText(v.error));
  const row = (await admin.from("attempts").select("status,decided_score,declared_score,decided_by,decision_reason").eq("id", aliceChallenge).single()).data;
  ok("score retenu distinct du score déclaré, décision tracée", row?.status === "validated" && row?.decided_score === 38 && row?.declared_score === 40 && row?.decided_by === mod.id);
  ok("première validation : 10 + 5 (record) + 25 (première) = 40 points", before === 0 && (await pointsOf(alice)) === 40, `points=${await pointsOf(alice)}`);
  await moderate(mod, aliceChallenge, "validate", 38, "re-validation");
  await moderate(mod, aliceChallenge, "validate", 38, "re-validation");
  ok("valider plusieurs fois la même tentative ne double pas les points", (await pointsOf(alice)) === 40);
  const log = await admin.from("moderation_log").select("action").eq("attempt_id", aliceChallenge);
  ok("chaque décision est journalisée", (log.data ?? []).length === 3);

  const rej = await moderate(mod, bobResponse, "reject", null, "Répétitions incomplètes");
  ok("rejet avec motif", !rej.error);
  ok("un rejet ne donne aucun point", (await pointsOf(bob)) === 0);
  const rejectedRow = (await admin.from("attempts").select("status,decision_reason").eq("id", bobResponse).single()).data;
  ok("le motif de rejet est conservé", rejectedRow?.status === "rejected" && rejectedRow?.decision_reason === "Répétitions incomplètes");
  const restore = await moderate(mod, bobResponse, "restore");
  ok("une décision peut être rouverte", !restore.error);
  await moderate(mod, bobResponse, "validate", 35, "Compté 35");
  ok("la réponse de Bob validée : 10 + 5 + 25 = 40 points", (await pointsOf(bob)) === 40, `points=${await pointsOf(bob)}`);
  const duel = (await admin.from("duel_results").select("winner_id,is_draw,challenger_score,responder_score").eq("challenge_id", aliceChallenge)).data?.[0];
  ok("résultat du duel : Alice (38) bat Bob (35)", duel?.winner_id === alice.id && duel?.is_draw === false);
  ok("la victoire au duel rapporte 20 points", (await pointsOf(alice)) === 60 && (await pointsOf(bob)) === 40, `alice=${await pointsOf(alice)} bob=${await pointsOf(bob)}`);

  // plafond de 3 tentatives rémunérées par jour
  let ids = [];
  for (let i = 0; i < 4; i += 1) ids.push((await submit(alice, "pullups_max", 5 + i)).data);
  for (const id of ids) await moderate(mod, id, "validate", 5);
  const after = await pointsOf(alice);
  ok("au plus 3 tentatives validées par jour rapportent des points (4e et 5e : 0)", after === 85, `points=${after}`);
}

console.log("\n=== 6. Signalements, contestation et retrait ===");
{
  const own = await alice.client.rpc("report_attempt", { p_id: aliceChallenge, p_reason: "wrong_count", p_details: "x" });
  ok("on ne peut pas signaler sa propre tentative", !!own.error);
  const r1 = await carol.client.rpc("report_attempt", { p_id: aliceChallenge, p_reason: "wrong_count", p_details: "Je compte 30" });
  const r2 = await carol.client.rpc("report_attempt", { p_id: aliceChallenge, p_reason: "wrong_count", p_details: "Je compte 30" });
  const cnt = (await admin.from("attempts").select("report_count").eq("id", aliceChallenge).single()).data?.report_count;
  ok("un signalement par joueur et par tentative, compteur exact", !r1.error && !r2.error && cnt === 1, `report_count=${cnt}`);
  const dues = (await admin.from("duel_results").select("challenge_id").eq("challenge_id", aliceChallenge)).data ?? [];
  ok("un duel contesté (signalement ouvert) n'a plus de résultat officiel", dues.length === 0);
  const seeReports = await carol.client.from("attempt_reports").select("id");
  const modReports = await mod.client.from("attempt_reports").select("id");
  ok("seul le modérateur voit tous les signalements", (modReports.data ?? []).length >= 1 && (seeReports.data ?? []).every(Boolean));
  await moderate(mod, aliceChallenge, "dismiss_reports");
  ok("après décision du modérateur le résultat du duel revient", ((await admin.from("duel_results").select("challenge_id").eq("challenge_id", aliceChallenge)).data ?? []).length === 1);
  const rm = await moderate(mod, aliceChallenge, "remove_video", null, "Contenu inapproprié");
  ok("le modérateur peut retirer une vidéo sans perdre la tentative", !rm.error && (await admin.from("attempts").select("video_removed").eq("id", aliceChallenge).single()).data?.video_removed === true);
  await moderate(mod, aliceChallenge, "restore_video");
}

console.log("\n=== 7. Classements et territoires ===");
{
  await moderate(mod, bobResponse, "validate", 35, "ok");
  const dv = (await submit(dave, "pushups_60s", 50)).data;
  await moderate(mod, dv, "validate", 50);
  const cv = (await submit(carol, "pushups_60s", 38)).data;
  await moderate(mod, cv, "validate", 38);

  const world = (await anon.rpc("leaderboard", { p_format: "pushups_60s", p_scope: "world", p_limit: 50 })).data ?? [];
  ok("classement mondial accessible sans compte", world.length >= 4);
  ok("tri par meilleur score validé décroissant", world[0]?.pseudo === "Dave" && world[0]?.best_score === 50);
  const tie = world.filter((r) => r.best_score === 38);
  ok("à score égal, le premier à l'avoir réalisé est classé devant (Alice avant Carol)", tie.length === 2 && tie[0].pseudo === "Alice" && tie[1].pseudo === "Carol", JSON.stringify(tie.map((t) => t.pseudo)));
  const fr = (await anon.rpc("leaderboard", { p_format: "pushups_60s", p_scope: "country", p_value: "France", p_limit: 50 })).data ?? [];
  ok("classement pays : seulement les joueurs déclarés en France", fr.length === 3 && !fr.some((r) => r.pseudo === "Dave"));
  const oc = (await anon.rpc("leaderboard", { p_format: "pushups_60s", p_scope: "region", p_value: "Occitanie", p_limit: 50 })).data ?? [];
  ok("classement région", oc.length === 2 && oc[0].pseudo === "Alice");
  const city = (await anon.rpc("leaderboard", { p_format: "pushups_60s", p_scope: "city", p_value: "Montauban", p_limit: 50 })).data ?? [];
  ok("classement ville", city.length === 1 && city[0].pseudo === "Bob");
  const empty = (await anon.rpc("leaderboard", { p_format: "pushups_60s", p_scope: "city", p_value: "Nulle-Part", p_limit: 50 })).data ?? [];
  ok("territoire sans joueur : liste vide (pas de faux participants)", empty.length === 0);
  const pull = (await anon.rpc("leaderboard", { p_format: "pullups_max", p_scope: "world", p_limit: 50 })).data ?? [];
  ok("pompes et tractions ne sont jamais mélangées", pull.every((r) => r.best_score <= 100) && !pull.some((r) => r.pseudo === "Dave"));
  const unscoped = await anon.rpc("leaderboard", { p_format: "pushups_60s", p_scope: "galaxie", p_limit: 5 });
  ok("périmètre inconnu : aucune donnée", (unscoped.data ?? []).length === 0);
  const pendingRank = (await submit(bob, "pushups_60s", 190)).data;
  const worldAfter = (await anon.rpc("leaderboard", { p_format: "pushups_60s", p_scope: "world", p_limit: 50 })).data ?? [];
  ok("un score déclaré non validé n'entre jamais dans les records", !worldAfter.some((r) => r.best_score === 190) && !!pendingRank);
}

console.log("\n=== 8. Événements, soutiens, rappels ===");
let eventId, eventSlug;
{
  const future = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
  const past = new Date(Date.now() - 3600 * 1000).toISOString();
  ok("date passée refusée", !!(await alice.client.rpc("propose_event", { p_opponent: bob.id, p_format: "pushups_60s", p_scheduled_at: past })).error);
  ok("on ne peut pas se défier soi-même", !!(await alice.client.rpc("propose_event", { p_opponent: alice.id, p_format: "pushups_60s", p_scheduled_at: future })).error);
  const p = await alice.client.rpc("propose_event", { p_opponent: bob.id, p_format: "pushups_60s", p_scheduled_at: future, p_timezone: "Europe/Paris" });
  eventId = p.data;
  ok("Alice propose un affrontement à Bob", !p.error && !!eventId, errText(p.error));
  eventSlug = (await admin.from("duel_events").select("slug,status").eq("id", eventId).single()).data;
  ok("l'événement est seulement « proposé » tant que Bob n'a pas accepté", eventSlug?.status === "proposed");
  const pub1 = (await anon.rpc("get_public_event", { p_slug: eventSlug.slug })).data;
  ok("page publique consultable sans compte (joueurs, territoires, statut)", pub1?.player_a?.pseudo === "Alice" && pub1?.player_b?.city === "Montauban" && pub1?.status === "proposed");
  ok("aucune vidéo ni donnée privée dans la page publique", !JSON.stringify(pub1).includes("video") && !JSON.stringify(pub1).includes("@"));
  ok("on ne peut pas soutenir un événement non confirmé", !!(await carol.client.rpc("support_event", { p_id: eventId, p_supported: alice.id })).error);
  ok("seul l'adversaire peut accepter", !!(await carol.client.rpc("respond_event", { p_id: eventId, p_accept: true })).error);
  ok("l'organisateur ne peut pas accepter à la place de l'adversaire", !!(await alice.client.rpc("respond_event", { p_id: eventId, p_accept: true })).error);
  ok("Bob accepte", !(await bob.client.rpc("respond_event", { p_id: eventId, p_accept: true })).error);
  ok("l'événement devient programmé avec l'accord des deux", (await admin.from("duel_events").select("status").eq("id", eventId).single()).data?.status === "scheduled");
  ok("Carol soutient Alice", !(await carol.client.rpc("support_event", { p_id: eventId, p_supported: alice.id })).error);
  await carol.client.rpc("support_event", { p_id: eventId, p_supported: alice.id });
  await dave.client.rpc("support_event", { p_id: eventId, p_supported: bob.id });
  ok("un soutien par personne : changer de camp ne double pas", !(await carol.client.rpc("support_event", { p_id: eventId, p_supported: bob.id })).error);
  const pub2 = (await anon.rpc("get_public_event", { p_slug: eventSlug.slug })).data;
  ok("compteurs de soutiens réels (0 pour Alice, 2 pour Bob)", pub2?.supporters_a === 0 && pub2?.supporters_b === 2, `${pub2?.supporters_a}/${pub2?.supporters_b}`);
  ok("on ne peut soutenir qu'un des deux joueurs", !!(await carol.client.rpc("support_event", { p_id: eventId, p_supported: dave.id })).error);
  const t1 = await dave.client.rpc("toggle_reminder", { p_id: eventId });
  const t2 = await dave.client.rpc("toggle_reminder", { p_id: eventId });
  ok("rappel activé puis désactivé sans doublon", t1.data === true && t2.data === false);
  const sc = (await admin.from("attempts").select("id").eq("user_id", alice.id).limit(1)).data;
  ok("le soutien n'a aucun effet sur le score sportif", (await anon.rpc("leaderboard", { p_format: "pushups_60s", p_scope: "world", p_limit: 50 })).data?.find((r) => r.pseudo === "Bob")?.best_score === 35 && !!sc);
  ok("un tiers ne peut pas annuler l'événement", !!(await carol.client.rpc("cancel_event", { p_id: eventId })).error);
  ok("un participant peut annuler", !(await bob.client.rpc("cancel_event", { p_id: eventId })).error);
  ok("un événement annulé n'est plus public", (await anon.rpc("get_public_event", { p_slug: eventSlug.slug })).data === null);
  const directEvt = await alice.client.from("duel_events").insert({ format_key: "pushups_60s", discipline: "pushups", player_a: alice.id, player_b: bob.id, status: "scheduled" });
  ok("insertion directe d'événement refusée", !!directEvt.error);
}

console.log("\n=== 9. Droits Pro (serveur de paiement uniquement) ===");
{
  const selfPro = await alice.client.from("entitlements").insert({ user_id: alice.id, plan: "pro", status: "active" });
  ok("un joueur ne peut pas s'accorder le Pro", !!selfPro.error);
  const selfPro2 = await alice.client.from("entitlements").upsert({ user_id: alice.id, plan: "pro", status: "active" });
  ok("ni par upsert", !!selfPro2.error);
  const fake = await alice.client.rpc("apply_entitlement_event", { p_event_id: "evt_fake", p_source: "stripe", p_user_id: alice.id, p_type: "INITIAL_PURCHASE", p_event_time: new Date().toISOString(), p_plan: "pro", p_status: "active", p_product_id: "x", p_period_end: null });
  ok("la fonction de paiement n'est pas appelable par un joueur", !!fake.error);
  ok("créer un groupe exige le Pro", !!(await alice.client.rpc("create_group", { p_name: "Mon crew" })).error);
  ok("les statistiques avancées exigent le Pro", !!(await alice.client.rpc("my_progress", { p_format: "pushups_60s" })).error);
  ok("la personnalisation de carte exige le Pro", !!(await alice.client.rpc("set_card_theme", { p_theme: "gold" })).error);

  const t0 = new Date(Date.now() - 60000).toISOString();
  const t1 = new Date(Date.now() - 30000).toISOString();
  const end = new Date(Date.now() + 30 * 86400000).toISOString();
  const apply = (id, time, plan, status, periodEnd) => admin.rpc("apply_entitlement_event", { p_event_id: id, p_source: "stripe", p_user_id: alice.id, p_type: "TEST", p_event_time: time, p_plan: plan, p_status: status, p_product_id: "immortal_pro_monthly", p_period_end: periodEnd, p_payload: { test: true } });
  ok("achat reçu : droits Pro appliqués", (await apply("evt_1", t1, "pro", "active", end)).data === "applied" && (await alice.client.rpc("is_pro")).data === true);
  ok("événement en double ignoré", (await apply("evt_1", t1, "pro", "active", end)).data === "duplicate");
  ok("événement plus ancien reçu en retard ignoré (désordre)", (await apply("evt_0", t0, "free", "expired", null)).data === "stale" && (await alice.client.rpc("is_pro")).data === true);
  const g = await alice.client.rpc("create_group", { p_name: "Crew Occitanie" });
  ok("un abonné Pro crée un groupe privé", !g.error && !!g.data, errText(g.error));
  const code = (await admin.from("groups").select("invite_code").eq("id", g.data).single()).data?.invite_code;
  ok("un membre gratuit rejoint avec le code d'invitation", !(await bob.client.rpc("join_group", { p_code: code })).error);
  const badJoin = await carol.client.rpc("join_group", { p_code: "zzzzzzzz" });
  ok("un code invalide ne donne accès à aucun groupe", !badJoin.error && badJoin.data === null);
  const codeLen = code?.length ?? 0;
  ok("le code d'invitation a au moins 24 caractères (96 bits)", codeLen >= 24, `longueur=${codeLen}`);
  let limited = false;
  for (let i = 0; i < 12; i += 1) {
    const r = await carol.client.rpc("join_group", { p_code: `faux${i}` });
    if (r.error && /rate_limited/.test(r.error.message)) limited = true;
  }
  ok("les essais de codes ratés sont limités (anti-force brute)", limited);
  const gl = (await bob.client.rpc("group_leaderboard", { p_group: g.data, p_format: "pushups_60s" })).data ?? [];
  ok("le classement du groupe est visible des membres (gratuits inclus)", gl.length === 2 && gl[0].pseudo === "Alice");
  const glOut = (await carol.client.rpc("group_leaderboard", { p_group: g.data, p_format: "pushups_60s" })).data ?? [];
  ok("le classement du groupe est invisible aux non-membres", glOut.length === 0);
  ok("un non-membre ne voit pas le groupe", ((await carol.client.from("groups").select("id")).data ?? []).length === 0);
  ok("statistiques de progression pour un abonné", !(await alice.client.rpc("my_progress", { p_format: "pushups_60s" })).error);
  ok("personnalisation de carte pour un abonné", !(await alice.client.rpc("set_card_theme", { p_theme: "gold" })).error);
  ok("thème inconnu refusé", !!(await alice.client.rpc("set_card_theme", { p_theme: "arc-en-ciel" })).error);
  const t2 = new Date(Date.now() - 1000).toISOString();
  await apply("evt_refund", t2, "free", "refunded", null);
  ok("après remboursement, plus de droits Pro", (await alice.client.rpc("is_pro")).data === false);
  ok("le groupe et les données restent, seuls les avantages Pro sont retirés", !!(await admin.from("groups").select("id").eq("id", g.data).single()).data && ((await admin.from("attempts").select("id").eq("user_id", alice.id)).data ?? []).length > 0);
  ok("sans Pro, les statistiques avancées sont de nouveau fermées", !!(await alice.client.rpc("my_progress", { p_format: "pushups_60s" })).error);
  const t3 = new Date().toISOString();
  await apply("evt_exp", t3, "pro", "active", new Date(Date.now() - 1000).toISOString());
  ok("un abonnement dont la période est échue n'est plus Pro", (await alice.client.rpc("is_pro")).data === false);
  const pe = await alice.client.from("payment_events").select("*");
  ok("le journal des paiements est invisible des joueurs", !!pe.error || (pe.data ?? []).length === 0);
  const own = await alice.client.from("entitlements").select("plan,status").eq("user_id", alice.id).single();
  ok("un joueur lit son propre droit", own.data?.plan === "pro" && own.data?.status === "active");
  const other = await bob.client.from("entitlements").select("plan").eq("user_id", alice.id);
  ok("mais pas celui des autres", (other.data ?? []).length === 0);
}

console.log("\n=== 10. Vidéos (stockage privé) ===");
{
  const buf = Buffer.from("fake-video-bytes");
  const up = await alice.client.storage.from("attempt-videos").upload(`${alice.id}/test-${stamp}.mp4`, buf, { contentType: "video/mp4" });
  ok("envoi dans son propre dossier", !up.error, errText(up.error));
  const stolen = await alice.client.storage.from("attempt-videos").upload(`${bob.id}/usurpation-${stamp}.mp4`, buf, { contentType: "video/mp4" });
  ok("écriture dans le dossier d'un autre refusée", !!stolen.error);
  const wrongType = await alice.client.storage.from("attempt-videos").upload(`${alice.id}/script-${stamp}.html`, Buffer.from("<script>"), { contentType: "text/html" });
  ok("type de fichier non vidéo refusé", !!wrongType.error);
  const anonRead = await anon.storage.from("attempt-videos").createSignedUrl(`${alice.id}/test-${stamp}.mp4`, 60);
  ok("aucun accès anonyme aux vidéos", !!anonRead.error || !anonRead.data?.signedUrl);

  const a = (await submit(alice, "pushups_60s", 12, { path: `${alice.id}/test-${stamp}.mp4` })).data;
  const bobRead = await bob.client.storage.from("attempt-videos").createSignedUrl(`${alice.id}/test-${stamp}.mp4`, 60);
  ok("un joueur connecté voit une vidéo publiée en attente ou validée", !!bobRead.data?.signedUrl, errText(bobRead.error));
  await moderate(mod, a, "remove_video", null, "Signalée et retirée");
  const bobAfter = await bob.client.storage.from("attempt-videos").createSignedUrl(`${alice.id}/test-${stamp}.mp4`, 60);
  ok("après retrait par la modération, la vidéo n'est plus accessible aux autres", !bobAfter.data?.signedUrl);
  const modRead = await mod.client.storage.from("attempt-videos").createSignedUrl(`${alice.id}/test-${stamp}.mp4`, 60);
  ok("mais la modération peut toujours la consulter", !!modRead.data?.signedUrl);
  const ownerRead = await alice.client.storage.from("attempt-videos").createSignedUrl(`${alice.id}/test-${stamp}.mp4`, 60);
  ok("et l'auteur aussi", !!ownerRead.data?.signedUrl);
  const del = await alice.client.storage.from("attempt-videos").remove([`${alice.id}/test-${stamp}.mp4`]);
  const still = await admin.storage.from("attempt-videos").list(alice.id);
  ok("une preuve rattachée à une tentative ne peut pas être supprimée par son auteur", (still.data ?? []).some((f) => f.name === `test-${stamp}.mp4`) && !!del);
}

console.log("\n=== 11. Limites de débit ===");
{
  const spam = await makeUser("spam");
  await profile(spam, "Spammeur", "Lille", "Hauts-de-France", "France");
  let refused = 0;
  for (let i = 0; i < 12; i += 1) {
    const r = await submit(spam, "pushups_60s", 10 + i);
    if (r.error) refused += 1;
  }
  ok("au plus 10 tentatives par 24 h (les suivantes sont refusées)", refused === 2, `refusées=${refused}`);
}

console.log(`\nRÉSULTAT : ${passed} réussis, ${failures.length} échec(s)`);
if (failures.length) {
  console.log("Échecs :\n- " + failures.join("\n- "));
  process.exit(1);
}
