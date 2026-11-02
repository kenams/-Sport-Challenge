// Jeu de démo LOCAL : un compte admin/modérateur + des participants fictifs avec performances validées.
// Usage : SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-local-demo.mjs
// Refuse toute base non locale. Les identifiants générés sont écrits dans .local-demo-credentials.txt (ignoré par git).
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE || !/127\.0\.0\.1|localhost/.test(URL)) {
  console.error("Refus : base locale uniquement.");
  process.exit(2);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);
const password = randomBytes(9).toString("base64url") + "!9a";
const DOMAIN = "immortal-demo.test";

async function user(label) {
  const email = `${label}@${DOMAIN}`;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const old = list?.users.find((u) => u.email === email);
  if (old) await admin.auth.admin.deleteUser(old.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(error.message);
  const client = createClient(URL, ANON, opts);
  const { error: signError } = await client.auth.signInWithPassword({ email, password });
  if (signError) throw new Error(signError.message);
  return { id: data.user.id, email, client };
}

const players = [
  ["lea", "Léa", "Toulouse", "Occitanie", "France", [["pushups_60s", 48], ["pullups_max", 12]]],
  ["moussa", "Moussa", "Toulouse", "Occitanie", "France", [["pushups_60s", 55], ["pullups_max", 15]]],
  ["yanis", "Yanis", "Montpellier", "Occitanie", "France", [["pushups_60s", 41]]],
  ["sarah", "Sarah", "Lyon", "Auvergne-Rhône-Alpes", "France", [["pushups_60s", 37], ["pullups_max", 9]]],
  ["tom", "Tom", "Paris", "Île-de-France", "France", [["pushups_60s", 62], ["pullups_max", 18]]],
  ["ines", "Inès", "Bordeaux", "Nouvelle-Aquitaine", "France", [["pushups_60s", 44]]],
  ["diego", "Diego", "Madrid", "Madrid", "Espagne", [["pushups_60s", 51], ["pullups_max", 11]]],
  ["noa", "Noa", "Lausanne", "Vaud", "Suisse", [["pullups_max", 14]]],
];

const { data: old } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const modUser = await user("admin");
await admin.from("admin_users").upsert({ user_id: modUser.id });
await modUser.client.rpc("update_my_profile", { p_pseudo: "Admin", p_city: "Toulouse", p_region: "Occitanie", p_country: "France", p_locale: "fr" });

let n = 0;
let rejected = 0;
const pending = [];
for (const [label, pseudo, city, region, country, scores] of players) {
  const u = await user(label);
  const { error } = await u.client.rpc("update_my_profile", { p_pseudo: pseudo, p_city: city, p_region: region, p_country: country, p_locale: "fr" });
  if (error) throw new Error(`${pseudo}: ${error.message}`);
  for (const [format, score] of scores) {
    n += 1;
    const { data: id, error: subError } = await u.client.rpc("submit_attempt", {
      p_format: format, p_declared: score, p_video_path: `${u.id}/demo-${n}.mp4`, p_duration: format === "pushups_60s" ? 60 : 45,
      p_title: null, p_challenge_id: null, p_recipient: null,
    });
    if (subError) throw new Error(`${pseudo} ${format}: ${subError.message}`);
    if (label === "ines") { pending.push(id); continue; }
    if (label === "yanis") {
      await modUser.client.rpc("moderate_attempt", { p_id: id, p_action: "reject", p_score: null, p_reason: "Amplitude insuffisante sur la plupart des répétitions" });
      rejected += 1;
      continue;
    }
    const { error: modError } = await modUser.client.rpc("moderate_attempt", { p_id: id, p_action: "validate", p_score: score, p_reason: null });
    if (modError) throw new Error(`modération ${pseudo}: ${modError.message}`);
  }
}

writeFileSync(
  new URL_("../.local-demo-credentials.txt", import.meta.url),
  `Base locale uniquement (${URL}).\nAdmin / modérateur : admin@${DOMAIN}\nMot de passe (tous les comptes démo) : ${password}\nParticipants : ${players.map((p) => `${p[0]}@${DOMAIN}`).join(", ")}\n`,
);
console.log(`OK : 1 admin + ${players.length} joueurs, ${n} performances (${rejected} rejetée, ${pending.length} en attente de validation).`);

function URL_(path, base) {
  return new globalThis.URL(path, base);
}
