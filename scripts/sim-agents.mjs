// Agents autonomes de simulation (base LOCALE uniquement) : des joueurs fictifs avec une personnalité jouent plusieurs « semaines »
// via les vraies fonctions serveur, un agent modérateur valide/ajuste/rejette, des duels sont proposés et soutenus.
// Ce sont des comportements scriptés (pas de LLM) : gratuits, rejouables, et ils testent les règles de confiance.
// Usage : SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... AGENT_PASSWORD=... [SIM_ROUNDS=6] [SIM_VIDEO=chemin.mp4] node scripts/sim-agents.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.AGENT_PASSWORD;
const ROUNDS = Number(process.env.SIM_ROUNDS ?? 6);
if (!URL_ || !ANON || !SERVICE || !PASSWORD || !/127\.0\.0\.1|localhost/.test(URL_)) {
  console.error("Refus : base locale uniquement, variables d'environnement requises.");
  process.exit(2);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SERVICE, opts);
const DOMAIN = "immortal-demo.test";
const videoBytes = process.env.SIM_VIDEO && existsSync(process.env.SIM_VIDEO) ? readFileSync(process.env.SIM_VIDEO) : null;

let seed = 20261102;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const chance = (p) => rnd() < p;

// skill = niveau de départ ; style = comportement ; honesty < 1 = triche (gonfle son score)
const AGENTS = [
  { label: "lea", pseudo: "Léa", style: "challenger", skill: { pushups_60s: 48, pullups_max: 12 }, honesty: 1 },
  { label: "moussa", pseudo: "Moussa", style: "responder", skill: { pushups_60s: 55, pullups_max: 15 }, honesty: 1 },
  { label: "yanis", pseudo: "Yanis", style: "steady", skill: { pushups_60s: 41, pullups_max: 8 }, honesty: 1 },
  { label: "sarah", pseudo: "Sarah", style: "challenger", skill: { pushups_60s: 37, pullups_max: 9 }, honesty: 1 },
  { label: "tom", pseudo: "Tom", style: "responder", skill: { pushups_60s: 62, pullups_max: 18 }, honesty: 1 },
  { label: "ines", pseudo: "Inès", style: "steady", skill: { pushups_60s: 44, pullups_max: 10 }, honesty: 1 },
  { label: "diego", pseudo: "Diego", style: "challenger", skill: { pushups_60s: 51, pullups_max: 11 }, honesty: 1 },
  { label: "noa", pseudo: "Noa", style: "responder", skill: { pushups_60s: 30, pullups_max: 14 }, honesty: 1 },
  { label: "rex", pseudo: "Rex", style: "challenger", skill: { pushups_60s: 40, pullups_max: 7 }, honesty: 0.6, city: ["Marseille", "Provence-Alpes-Côte d'Azur", "France"] },
  { label: "amel", pseudo: "Amel", style: "steady", skill: { pushups_60s: 33, pullups_max: 6 }, honesty: 1, city: ["Lille", "Hauts-de-France", "France"] },
  { label: "juan", pseudo: "Juan", style: "responder", skill: { pushups_60s: 47, pullups_max: 13 }, honesty: 1, city: ["Barcelone", "Catalogne", "Espagne"] },
  { label: "kofi", pseudo: "Kofi", style: "challenger", skill: { pushups_60s: 58, pullups_max: 16 }, honesty: 1, city: ["Genève", "Genève", "Suisse"] },
  { label: "lina", pseudo: "Lina", style: "steady", skill: { pushups_60s: 36, pullups_max: 12 }, honesty: 1, city: ["Nantes", "Pays de la Loire", "France"] },
  { label: "marc", pseudo: "Marc", style: "responder", skill: { pushups_60s: 45, pullups_max: 9 }, honesty: 1, city: ["Rennes", "Bretagne", "France"] },
];
const MAX = { pushups_60s: 200, pullups_max: 100 };
const stats = { challenges: 0, responses: 0, validated: 0, adjusted: 0, rejected: 0, reports: 0, events: 0, accepted: 0, declined: 0, supports: 0, blocked: {} };
const blocked = (label, error) => {
  const key = `${label}:${(error?.message ?? "?").split("\n")[0]}`;
  stats.blocked[key] = (stats.blocked[key] ?? 0) + 1;
};

async function login(label, pseudo, city) {
  const email = `${label}@${DOMAIN}`;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let existing = list?.users.find((u) => u.email === email);
  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw new Error(`${label}: ${error.message}`);
    existing = data.user;
  }
  const client = createClient(URL_, ANON, opts);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${label}: ${error.message}`);
  if (city) await client.rpc("update_my_profile", { p_pseudo: pseudo, p_city: city[0], p_region: city[1], p_country: city[2], p_locale: "fr" });
  return { id: existing.id, client };
}

const players = [];
for (const a of AGENTS) players.push({ ...a, ...(await login(a.label, a.pseudo, a.city)), progress: 1, history: [] });
const byId = new Map(players.map((p) => [p.id, p]));
const mod = await login("admin", "Admin", null);

let counter = 0;
async function upload(player, path) {
  if (!videoBytes) return;
  await admin.storage.from("attempt-videos").upload(path, videoBytes, { contentType: "video/mp4", upsert: true });
}

async function perform(player, format, challengeId = null, recipient = null) {
  const base = player.skill[format] * player.progress * (0.9 + rnd() * 0.2);
  let real = Math.max(1, Math.round(base));
  const declared = Math.min(MAX[format], !chance(player.honesty) ? Math.round(real * (1.4 + rnd() * 0.3)) : real);
  counter += 1;
  const path = `${player.id}/sim-${Date.now()}-${counter}.mp4`;
  await upload(player, path);
  const { data, error } = await player.client.rpc("submit_attempt", {
    p_format: format, p_declared: declared, p_video_path: path, p_duration: format === "pushups_60s" ? 60 : 40,
    p_title: challengeId ? null : pick([null, "Qui me bat ?", "Lundi motivé", "Je défie la ville", "Série propre"]),
    p_challenge_id: challengeId, p_recipient: recipient,
  });
  if (error) { blocked(player.label, error); return null; }
  player.history.push(real);
  challengeId ? (stats.responses += 1) : (stats.challenges += 1);
  return { id: data, real, declared };
}

async function openChallenges(format, forUser) {
  const { data } = await admin.from("attempts").select("id,user_id,recipient_user_id").eq("kind", "challenge").eq("format_key", format).in("status", ["pending", "validated"]).order("created_at", { ascending: false }).limit(30);
  const { data: mine } = await admin.from("attempts").select("challenge_id").eq("user_id", forUser).eq("kind", "response");
  const answered = new Set((mine ?? []).map((m) => m.challenge_id));
  return (data ?? []).filter((c) => c.user_id !== forUser && !answered.has(c.id) && (!c.recipient_user_id || c.recipient_user_id === forUser));
}

async function moderationRound() {
  const { data: pending } = await admin.from("attempts").select("id,user_id,format_key,declared_score,report_count").eq("status", "pending").order("created_at");
  for (const a of pending ?? []) {
    const p = byId.get(a.user_id);
    const median = p?.history?.length ? [...p.history].sort((x, y) => x - y)[Math.floor(p.history.length / 2)] : a.declared_score;
    let action = "validate";
    let score = a.declared_score;
    let reason = null;
    if (a.declared_score > median * 1.3 + 3 || a.report_count > 0) {
      action = "validate"; score = Math.max(1, Math.round(median * 1.05)); reason = "Répétitions partielles non comptées : score ajusté après revue de la vidéo.";
      if (chance(0.5)) { action = "reject"; score = null; reason = "Amplitude insuffisante sur une grande partie des répétitions."; }
    } else if (chance(0.06)) {
      action = "reject"; score = null; reason = pick(["Vidéo coupée avant la fin du temps imparti.", "Corps non visible en entier."]);
    }
    const { error } = await mod.client.rpc("moderate_attempt", { p_id: a.id, p_action: action, p_score: score, p_reason: reason });
    if (error) { blocked("moderateur", error); continue; }
    if (action === "reject") stats.rejected += 1;
    else if (score !== a.declared_score) stats.adjusted += 1;
    else stats.validated += 1;
  }
}

async function eventRound(round) {
  const [a, b] = [pick(players), pick(players)];
  if (a.id === b.id) return;
  const format = pick(["pushups_60s", "pullups_max"]);
  const when = new Date(Date.now() + (2 + round) * 86400000).toISOString();
  const { data: id, error } = await a.client.rpc("propose_event", { p_opponent: b.id, p_format: format, p_scheduled_at: when, p_timezone: "Europe/Paris" });
  if (error) return blocked(a.label, error);
  stats.events += 1;
  const accept = chance(0.8);
  const { error: respError } = await b.client.rpc("respond_event", { p_id: id, p_accept: accept });
  if (respError) return blocked(b.label, respError);
  accept ? (stats.accepted += 1) : (stats.declined += 1);
  if (!accept) return;
  for (const fan of players.filter((p) => p.id !== a.id && p.id !== b.id).sort(() => rnd() - 0.5).slice(0, 4)) {
    const { error: supError } = await fan.client.rpc("support_event", { p_id: id, p_supported: chance(0.5) ? a.id : b.id });
    supError ? blocked(fan.label, supError) : (stats.supports += 1);
  }
}

for (let round = 1; round <= ROUNDS; round += 1) {
  for (const p of players) p.progress *= 1 + (rnd() * 0.04 - 0.005);
  for (const p of [...players].sort(() => rnd() - 0.5)) {
    const format = pick(Object.keys(p.skill));
    if (p.style === "responder" || (p.style === "steady" && chance(0.4))) {
      const options = await openChallenges(format, p.id);
      if (options.length) { await perform(p, format, pick(options).id); continue; }
    }
    if (p.style !== "steady" || chance(0.7)) {
      const rival = chance(0.3) ? pick(players.filter((x) => x.id !== p.id)) : null;
      await perform(p, format, null, rival?.id ?? null);
    }
  }
  // un joueur honnête signale une performance suspecte de Rex
  const rex = players.find((p) => p.label === "rex");
  const { data: sus } = await admin.from("attempts").select("id,declared_score").eq("user_id", rex.id).eq("status", "pending").order("created_at", { ascending: false }).limit(1);
  if (sus?.[0] && chance(0.6)) {
    const { error } = await pick(players.filter((p) => p.label !== "rex")).client.rpc("report_attempt", { p_id: sus[0].id, p_reason: "wrong_count", p_details: "Le compte ne correspond pas à la vidéo." });
    error ? blocked("signalement", error) : (stats.reports += 1);
  }
  await moderationRound();
  await eventRound(round);
  console.log(`semaine ${round}/${ROUNDS} terminée`);
}

// Vérifications d'invariants côté serveur
const checks = [];
const { data: all } = await admin.from("attempts").select("user_id,status,decided_by,decided_score,declared_score,kind,challenge_id,id");
checks.push(["aucune performance validée par son propre auteur", !(all ?? []).some((a) => a.status === "validated" && a.decided_by === a.user_id)]);
checks.push(["toute validée a un score retenu", !(all ?? []).some((a) => a.status === "validated" && a.decided_score == null)]);
checks.push(["aucune réponse sur son propre défi", !(all ?? []).some((a) => a.kind === "response" && all.find((c) => c.id === a.challenge_id)?.user_id === a.user_id)]);
const { data: lb } = await mod.client.rpc("leaderboard", { p_format: "pushups_60s", p_scope: "world", p_value: null, p_limit: 5 });
console.log("\nTop pompes (monde) :", JSON.stringify(lb?.slice?.(0, 5) ?? lb));
console.log("\nBilan :", JSON.stringify({ ...stats, blocked: undefined }));
console.log("Refus serveur observés (attendus : limites, règles) :", JSON.stringify(stats.blocked));
for (const [name, ok] of checks) console.log(`${ok ? "OK" : "KO"}  ${name}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
