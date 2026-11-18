// Contrôle de bout en bout du mode live (duel vidéo) sur la prod, avec deux joueurs temporaires.
// Étapes : comptes jetables -> duel programmé -> start_duel_live -> jeton LiveKit pour chacun ->
// deux navigateurs headless (caméra simulée) se voient mutuellement -> compteur de répétitions.
// Tout est supprimé à la fin, même en cas d'échec.
// Usage : node scripts/check-duel-live.mjs <chemin du module playwright>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(".env.local"), "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const URL_ = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const { chromium } = require(process.argv[2]);
const umd = fs.readFileSync(path.resolve("node_modules/livekit-client/dist/livekit-client.umd.js"), "utf8");

const stamp = Date.now();
const password = `Live-${stamp}-${Math.random().toString(36).slice(2)}`;
const created = { users: [], eventId: null };
const ok = (label, detail = "") => console.log(`OK  ${label}${detail ? " · " + detail : ""}`);

async function player(tag) {
  const email = `live-check-${tag}-${stamp}@immortal-k.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`user_${tag}: ${error.message}`);
  created.users.push(data.user.id);
  const { error: pErr } = await admin.from("profiles").upsert({ user_id: data.user.id, pseudo: `LIVECHECK_${tag}_${String(stamp).slice(-4)}` });
  if (pErr) console.log(`(profil ${tag} : ${pErr.message})`);
  const client = createClient(URL_, anonKey, { auth: { persistSession: false } });
  const { error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw new Error(`signin_${tag}: ${sErr.message}`);
  return { id: data.user.id, client };
}

async function main() {
  const a = await player("A");
  const b = await player("B");
  ok("2 joueurs temporaires connectés");

  const { data: ev, error: evErr } = await admin.from("duel_events").insert({
    slug: `live-check-${stamp}`, format_key: "pushups_60s", discipline: "pushups",
    player_a: a.id, player_b: b.id, scheduled_at: new Date().toISOString(), timezone: "Europe/Paris",
    status: "scheduled", accepted_by_a: true, accepted_by_b: true,
  }).select("id").single();
  if (evErr) throw new Error(`event: ${evErr.message}`);
  created.eventId = ev.id;
  ok("duel programmé");

  const { error: stErr } = await a.client.rpc("start_duel_live", { p_event_id: ev.id });
  if (stErr) throw new Error(`start_duel_live: ${stErr.message}`);
  ok("duel passé en direct (start_duel_live)");

  const creds = [];
  for (const p of [a, b]) {
    const { data, error } = await p.client.functions.invoke("duel-live-token", { body: { event_id: ev.id } });
    if (error || !(data?.token ?? data?.participant_token)) throw new Error(`duel-live-token: ${error?.message ?? JSON.stringify(data).slice(0, 200)}`);
    creds.push({ serverUrl: data.serverUrl ?? data.url ?? data.server_url, token: data.token ?? data.participant_token });
  }
  if (!creds.every((c) => c.serverUrl)) throw new Error(`serverUrl absent: ${Object.keys(creds[0]).join(",")}`);
  ok("jeton vidéo LiveKit délivré aux 2 joueurs");

  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  try {
    const pages = [];
    for (const c of creds) {
      const ctx = await browser.newContext({ permissions: ["camera", "microphone"] });
      const page = await ctx.newPage();
      await page.goto("https://immortal-arena.vercel.app/cgv.html");
      await page.addScriptTag({ content: umd });
      await page.evaluate(async ({ serverUrl, token }) => {
        const { Room, RoomEvent } = window.LivekitClient;
        const room = new Room();
        window.__remote = 0;
        room.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === "video") window.__remote += 1; });
        await room.connect(serverUrl, token);
        await room.localParticipant.setCameraEnabled(true);
        window.__room = room;
      }, c);
      pages.push(page);
    }
    ok("2 navigateurs connectés à la salle vidéo");
    for (const [i, page] of pages.entries()) {
      await page.waitForFunction(() => window.__remote > 0, null, { timeout: 30000 });
      ok(`joueur ${i === 0 ? "A" : "B"} voit la vidéo de l'adversaire`);
    }
    for (const page of pages) await page.evaluate(() => window.__room?.disconnect());
  } finally {
    await browser.close();
  }

  for (let i = 0; i < 3; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1600));
    const { error } = await a.client.rpc("increment_duel_live_rep", { p_event_id: ev.id });
    if (error) throw new Error(`increment_duel_live_rep: ${error.message}`);
  }
  const { data: score } = await b.client.from("duel_live_scores").select("repetitions").eq("event_id", ev.id).eq("user_id", a.id).maybeSingle();
  if (score?.repetitions !== 3) throw new Error(`score visible par l'adversaire = ${score?.repetitions}`);
  ok("compteur live : 3 répétitions de A visibles par B");
}

async function cleanup() {
  if (created.eventId) {
    await admin.from("duel_live_scores").delete().eq("event_id", created.eventId);
    await admin.from("event_supporters").delete().eq("event_id", created.eventId);
    const { error } = await admin.from("duel_events").delete().eq("id", created.eventId);
    if (error) console.log(`nettoyage duel : ${error.message}`);
  }
  for (const id of created.users) {
    await admin.from("profiles").delete().eq("user_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`nettoyage utilisateur : ${error.message}`);
  }
  console.log("Nettoyage terminé.");
}

main().then(() => console.log("MODE LIVE : OK"), (e) => { console.log(`ECHEC : ${e.message}`); process.exitCode = 1; }).finally(cleanup);
