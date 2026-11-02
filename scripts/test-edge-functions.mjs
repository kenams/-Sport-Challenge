// Teste de bout en bout les Edge Functions delete-account et stripe-webhook, servies en LOCAL (runtime Deno réel).
// Usage : SUPABASE_URL=http://127.0.0.1:56321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... EDGE_URL=http://127.0.0.1:18181 STRIPE_WEBHOOK_SECRET=whsec_localtest node scripts/test-edge-functions.mjs
// Le runtime est lancé comme décrit dans docs/PRO_SETUP.md (section « Tester les fonctions en local »). Base locale uniquement.
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDGE = process.env.EDGE_URL;
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_localtest";
if (!URL || !ANON || !SERVICE || !EDGE || !/127\.0\.0\.1|localhost/.test(URL) || !/127\.0\.0\.1|localhost/.test(EDGE)) {
  console.error("Refus : base et runtime locaux uniquement (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, EDGE_URL).");
  process.exit(2);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);
const stamp = Date.now();
const PASSWORD = "Immortal!Test12345";

let passed = 0;
const failures = [];
const ok = (name, condition, detail = "") => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? " — " + detail : ""}`);
  console.log(`${condition ? "OK " : "KO "} ${name}${!condition && detail ? "  → " + detail : ""}`);
};

async function makeUser(label) {
  const email = `${label}.${stamp}@immortal-test.example`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(error.message);
  const client = createClient(URL, ANON, opts);
  const signed = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signed.error) throw new Error(signed.error.message);
  await client.rpc("update_my_profile", { p_pseudo: label, p_city: "Lyon", p_region: "ARA", p_country: "France", p_locale: "fr" });
  return { id: data.user.id, email, client, token: signed.data.session.access_token };
}

const call = async (name, { token, body, headers = {}, raw } = {}) => {
  const response = await fetch(`${EDGE}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    /* corps vide */
  }
  return { status: response.status, json };
};

console.log("\n=== delete-account (Edge Function réelle) ===");
{
  const user = await makeUser("edgevictim");
  const other = await makeUser("edgeother");
  const bytes = Buffer.from("fake-video-bytes");
  const up = (u, name) => u.client.storage.from("attempt-videos").upload(`${u.id}/${name}`, bytes, { contentType: "video/mp4" });
  await up(user, `a-${stamp}.mp4`);
  await up(user, `orphan-${stamp}.mp4`);
  await up(other, `b-${stamp}.mp4`);
  const attempt = await user.client.rpc("submit_attempt", { p_format: "pushups_60s", p_declared: 22, p_video_path: `${user.id}/a-${stamp}.mp4`, p_duration: 60, p_title: null, p_challenge_id: null, p_recipient: null });

  ok("sans jeton : refusé", (await call("delete-account", { body: { confirm: true } })).status === 401);
  ok("avec la clé publique seule (pas un joueur) : refusé", (await call("delete-account", { token: ANON, body: { confirm: true } })).status === 401);
  ok("sans confirmation explicite : refusé", (await call("delete-account", { token: user.token, body: {} })).status === 400);
  ok("corps invalide : refusé", (await call("delete-account", { token: user.token, raw: "pas du json" })).status === 400);
  ok("tant que rien n'est confirmé, le compte existe toujours", !!(await admin.auth.admin.getUserById(user.id)).data?.user && !attempt.error);

  const result = await call("delete-account", { token: user.token, body: { confirm: true } });
  ok("suppression confirmée : 200", result.status === 200 && result.json?.ok === true, JSON.stringify(result));
  ok("le compte d'authentification est supprimé", !!(await admin.auth.admin.getUserById(user.id)).error);
  ok("la performance et le profil sont supprimés", ((await admin.from("attempts").select("id").eq("user_id", user.id)).data ?? []).length === 0 && ((await admin.from("profiles").select("user_id").eq("user_id", user.id)).data ?? []).length === 0);
  ok("les deux fichiers vidéo sont effacés du stockage", ((await admin.storage.from("attempt-videos").list(user.id)).data ?? []).filter((f) => f.id).length === 0);
  ok("le jeton de l'ancien compte ne marche plus", (await call("delete-account", { token: user.token, body: { confirm: true } })).status === 401);
  ok("la vidéo d'un autre joueur est intacte", ((await admin.storage.from("attempt-videos").list(other.id)).data ?? []).some((f) => f.name === `b-${stamp}.mp4`));
  await admin.auth.admin.deleteUser(other.id);
}

console.log("\n=== stripe-webhook (Edge Function réelle) ===");
{
  const user = await makeUser("edgepro");
  const now = Math.floor(Date.now() / 1000);
  const sign = (body, t = now, secret = SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  const send = (event, { t = now, secret = SECRET, tamper = false } = {}) => {
    const body = JSON.stringify(event);
    return call("stripe-webhook", { raw: tamper ? body.replace("active", "actiVe") : body, headers: { "stripe-signature": sign(body, t, secret) } });
  };
  const sub = (id, over = {}, created = now) => ({
    id,
    type: "customer.subscription.created",
    created,
    livemode: false,
    data: { object: { id: "sub_x", customer: `cus_${stamp}`, status: "active", cancel_at_period_end: false, current_period_end: now + 30 * 86400, metadata: { user_id: user.id }, items: { data: [{ price: { id: "price_m", product: "prod_pro" } }] }, ...over } },
  });
  const isPro = async () => (await user.client.rpc("is_pro")).data === true;
  const idp = (n) => `evt_edge_${stamp}_${n}`;

  ok("gratuit au départ", !(await isPro()));
  ok("événement sans signature : 400", (await call("stripe-webhook", { body: sub(idp(0)) })).status === 400);
  ok("mauvais secret : 400", (await send(sub(idp(0)), { secret: "whsec_autre" })).status === 400);
  ok("corps modifié après signature : 400", (await send(sub(idp(0)), { tamper: true })).status === 400);
  ok("horodatage de signature trop ancien : 400", (await send(sub(idp(0)), { t: now - 3600 })).status === 400);
  ok("rien n'a été appliqué par les requêtes refusées", !(await isPro()));
  const first = await send(sub(idp(1)));
  ok("abonnement valide signé : appliqué", first.status === 200 && first.json?.outcome === "applied", JSON.stringify(first.json));
  ok("le joueur est Pro côté serveur", await isPro());
  ok("même événement renvoyé : doublon, sans effet", (await send(sub(idp(1)))).json?.outcome === "duplicate");
  const late = await send({ ...sub(idp(2), { status: "canceled" }, now - 5000) });
  ok("événement ancien arrivé en retard : ignoré, Pro conservé", late.json?.outcome === "stale" && (await isPro()), JSON.stringify(late.json));
  const refund = await send({ id: idp(3), type: "charge.refunded", created: now + 60, livemode: false, data: { object: { id: "ch_x", customer: `cus_${stamp}`, refunded: true } } }, { t: now });
  ok("remboursement total (joueur retrouvé par l'identifiant client) : appliqué", refund.json?.outcome === "applied", JSON.stringify(refund.json));
  ok("le Pro est retiré après remboursement", !(await isPro()));
  const unknown = await send({ id: idp(4), type: "charge.refunded", created: now + 120, livemode: false, data: { object: { id: "ch_y", customer: "cus_inconnu", refunded: true } } });
  ok("client inconnu : ignoré avec 200 (Stripe ne réessaie pas)", unknown.status === 200 && !!unknown.json?.ignored);
  ok("événement hors périmètre : ignoré avec 200", (await send({ id: idp(5), type: "customer.created", created: now, livemode: false, data: { object: {} } })).json?.ignored !== undefined);
  const row = (await admin.from("payment_events").select("event_id").like("event_id", `evt_edge_${stamp}_%`)).data ?? [];
  ok("seuls les événements signés et acceptés sont journalisés", row.length === 3, `lignes=${row.length}`);
  await admin.from("payment_events").delete().like("event_id", `evt_edge_${stamp}_%`);
  await admin.from("entitlements").delete().eq("user_id", user.id);
  await admin.auth.admin.deleteUser(user.id);
}

console.log(`\nRÉSULTAT : ${passed} réussis, ${failures.length} échec(s)`);
if (failures.length) {
  console.log("Échecs :\n- " + failures.join("\n- "));
  process.exit(1);
}
