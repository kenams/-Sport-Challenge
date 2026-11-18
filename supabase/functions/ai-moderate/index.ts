// Modération automatique : Gemini regarde la vidéo, compte les répétitions valides
// selon le règlement du format, puis la base décide (ai_decide_attempt).
// Politique : l'IA valide seule les cas nets, rejette seule les cas évidents,
// et laisse tout le reste à un modérateur humain.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3-flash-preview";
const AI_SECRET = Deno.env.get("AI_MODERATION_SECRET") ?? "";

// Seuils de décision automatique.
const VALIDATE_MIN_CONFIDENCE = 0.75;
const REJECT_MIN_CONFIDENCE = 0.9;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Verdict = {
  exercise_matches: boolean;
  person_visible: boolean;
  continuous_video: boolean;
  framing_ok: boolean;
  valid_reps: number;
  invalid_reps: number;
  confidence: number;
  obvious_cheat: boolean;
  unusable_video: boolean;
  refilm_advice_fr: string;
  issues: string[];
  summary_fr: string;
};

const VERDICT_SCHEMA = {
  type: "OBJECT",
  properties: {
    exercise_matches: { type: "BOOLEAN", description: "La vidéo montre bien l'exercice demandé." },
    person_visible: { type: "BOOLEAN", description: "Une seule personne réalise l'exercice et son corps est visible." },
    continuous_video: { type: "BOOLEAN", description: "Aucune coupure ni montage visible." },
    framing_ok: { type: "BOOLEAN", description: "Le cadrage permet de juger chaque répétition." },
    valid_reps: { type: "INTEGER", description: "Nombre de répétitions complètes conformes au règlement." },
    invalid_reps: { type: "INTEGER", description: "Répétitions incomplètes ou non conformes." },
    confidence: { type: "NUMBER", description: "Certitude globale entre 0 et 1 sur le comptage." },
    obvious_cheat: { type: "BOOLEAN", description: "Triche manifeste : vidéo sans rapport, écran filmé, image fixe, autre personne." },
    unusable_video: { type: "BOOLEAN", description: "Vidéo impossible à juger : cadrage, angle, corps hors champ, trop sombre ou trop courte." },
    refilm_advice_fr: { type: "STRING", description: "Si la vidéo est inexploitable : consigne courte et concrète pour refilmer (angle, distance, durée). Sinon chaîne vide." },
    issues: { type: "ARRAY", items: { type: "STRING" } },
    summary_fr: { type: "STRING", description: "Une à deux phrases en français pour le joueur." },
  },
  required: ["exercise_matches", "person_visible", "continuous_video", "framing_ok", "valid_reps", "invalid_reps", "confidence", "obvious_cheat", "unusable_video", "refilm_advice_fr", "issues", "summary_fr"],
};

async function uploadToGemini(bytes: Uint8Array, mime: string): Promise<{ uri: string; name: string }> {
  const start = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "immortal-attempt" } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error(`gemini_upload_start_${start.status}`);
  const done = await fetch(uploadUrl, {
    method: "POST",
    headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: bytes,
  });
  const info = await done.json();
  if (!info?.file?.uri) throw new Error(`gemini_upload_${done.status}`);

  // La vidéo doit être traitée par Google avant analyse.
  let state = info.file.state;
  for (let i = 0; i < 40 && state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${info.file.name}`, { headers: { "x-goog-api-key": GEMINI_API_KEY } });
    state = (await res.json())?.state;
  }
  if (state !== "ACTIVE") throw new Error(`gemini_file_state_${state}`);
  return { uri: info.file.uri, name: info.file.name };
}

async function analyse(fileUri: string, mime: string, format: Record<string, unknown>, declared: number): Promise<Verdict> {
  const prompt = [
    "Tu es l'arbitre officiel de l'application de défis sportifs IMMORTAL. Regarde toute la vidéo.",
    `Exercice : ${format.label_fr}.`,
    `Règlement : ${format.rules_fr}`,
    `Cadrage attendu : ${format.framing_fr}`,
    format.duration_seconds ? `Seules les répétitions faites dans les ${format.duration_seconds} premières secondes comptent.` : "",
    `Le joueur déclare ${declared} répétitions. Ne te laisse pas influencer : compte toi-même, strictement.`,
    "Une répétition douteuse ne compte pas. Si tu ne peux pas juger (vidéo trop sombre, coupée, corps hors champ), baisse fortement la confiance.",
    "Réponds uniquement avec le JSON demandé.",
  ].filter(Boolean).join("\n");

  // Google sature parfois un modèle (503/429) : on réessaie puis on passe au modèle de secours.
  const models = [...new Set([GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-flash-lite-latest"])];
  let lastError = "aucun_modele";
  // La fonction est coupée à ~150 s : on garde de la marge pour enregistrer la décision.
  const deadline = Date.now() + 90_000;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() > deadline) throw new Error(`${lastError}_delai_depasse`);
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          signal: AbortSignal.timeout(Math.max(5_000, Math.min(40_000, deadline - Date.now()))),
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ file_data: { mime_type: mime, file_uri: fileUri } }, { text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: VERDICT_SCHEMA },
          }),
        });
      } catch (err) {
        // Modèle bloqué : on passe directement au suivant.
        lastError = `gemini_generate_${model}_timeout_${err instanceof Error ? err.message : String(err)}`;
        break;
      }
      const body = await res.json().catch(() => ({}));
      const text = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      if (res.ok && text) return { ...(JSON.parse(text) as Verdict), model } as Verdict;
      lastError = `gemini_generate_${model}_${res.status}_${body?.error?.message ?? "vide"}`;
      if (res.status !== 503 && res.status !== 429 && res.status !== 500) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error(lastError);
}

export function decide(v: Verdict, declared: number, maxScore: number): { action: "validate" | "reject" | "needs_human"; score: number | null; reason: string } {
  const counted = Math.max(0, Math.min(Math.round(v.valid_reps), maxScore));
  // 1. Triche manifeste : refus si l'IA est très sûre, sinon un humain tranche.
  if (v.obvious_cheat) {
    return v.confidence >= REJECT_MIN_CONFIDENCE
      ? { action: "reject", score: null, reason: `Refusé par l'IA : ${v.summary_fr}` }
      : { action: "needs_human", score: null, reason: "Doute sur la vidéo : vérification humaine." };
  }
  // 2. Vidéo inexploitable (cadrage, corps hors champ, trop courte) : refus immédiat avec la
  //    consigne pour refilmer. Le joueur peut relancer un défi tout de suite.
  if (v.unusable_video || !v.framing_ok || !v.person_visible) {
    const advice = (v.refilm_advice_fr || v.summary_fr || "Refilme de profil, corps entier visible.").trim();
    return { action: "reject", score: null, reason: `À refilmer : ${advice}` };
  }
  // 3. Mauvais exercice : refus si certain, sinon humain.
  if (!v.exercise_matches) {
    return v.confidence >= REJECT_MIN_CONFIDENCE
      ? { action: "reject", score: null, reason: `Refusé par l'IA : ${v.summary_fr}` }
      : { action: "needs_human", score: null, reason: "Doute sur l'exercice : vérification humaine." };
  }
  if (!v.continuous_video || v.confidence < VALIDATE_MIN_CONFIDENCE) {
    return { action: "needs_human", score: null, reason: "Comptage incertain : vérification humaine." };
  }
  // Jamais plus que le score déclaré par le joueur.
  const score = Math.min(counted, declared);
  const detail = score < declared ? ` L'IA a compté ${counted} répétitions valides sur ${declared} déclarées.` : "";
  return { action: "validate", score, reason: `Validé par l'IA : ${score} répétitions.${detail} ${v.summary_fr}`.trim() };
}

async function moderate(attemptId: string) {
  const { data: attempt, error } = await admin.from("attempts")
    .select("id, status, format_key, declared_score, video_path").eq("id", attemptId).single();
  if (error || !attempt) throw new Error("attempt_not_found");
  if (attempt.status !== "pending") return { skipped: attempt.status };

  const { data: format } = await admin.from("challenge_formats").select("*").eq("key", attempt.format_key).single();
  if (!format) throw new Error("format_not_found");

  const { data: blob, error: dlErr } = await admin.storage.from("attempt-videos").download(attempt.video_path);
  if (dlErr || !blob) throw new Error("video_download_failed");
  const mime = blob.type || (attempt.video_path.endsWith(".webm") ? "video/webm" : attempt.video_path.endsWith(".mov") ? "video/quicktime" : "video/mp4");
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const file = await uploadToGemini(bytes, mime);
  try {
    const verdict = await analyse(file.uri, mime, format, attempt.declared_score);
    const decision = decide(verdict, attempt.declared_score, format.max_score);
    const { data: result, error: rpcErr } = await admin.rpc("ai_decide_attempt", {
      p_id: attempt.id, p_action: decision.action, p_score: decision.action === "validate" ? decision.score : Math.round(verdict.valid_reps),
      p_reason: decision.reason, p_confidence: verdict.confidence, p_summary: verdict.summary_fr, p_verdict: verdict,
    });
    if (rpcErr) throw new Error(`decide_failed_${rpcErr.message}`);
    return { decision: decision.action, score: decision.score, result };
  } finally {
    // La vidéo n'est pas conservée chez Google.
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { method: "DELETE", headers: { "x-goog-api-key": GEMINI_API_KEY } }).catch(() => {});
  }
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorized = (AI_SECRET && req.headers.get("x-ai-secret") === AI_SECRET) ||
    req.headers.get("authorization") === `Bearer ${SERVICE_KEY}`;
  if (!authorized) return json({ error: "unauthorized" }, 401);
  if (!GEMINI_API_KEY) return json({ error: "gemini_key_missing" }, 500);

  const body = await req.json().catch(() => ({}));
  let ids: string[] = body.attempt_id ? [String(body.attempt_id)] : [];
  if (!ids.length) {
    // Rattrapage : tentatives en attente non traitées (ou en erreur) de plus de 2 minutes.
    const { data } = await admin.from("attempts").select("id")
      .eq("status", "pending").or("ai_status.is.null,ai_status.eq.queued,ai_status.eq.error")
      .lt("created_at", new Date(Date.now() - 120_000).toISOString()).order("created_at").limit(5);
    ids = (data ?? []).map((row) => row.id);
  }

  const results: Record<string, unknown> = {};
  for (const id of ids) {
    try {
      results[id] = await moderate(id);
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).replace(/key=[^&\s)]+/g, "key=REDACTED");
      console.error("[ai-moderate]", id, message);
      try {
        await admin.rpc("ai_decide_attempt", { p_id: id, p_action: "error", p_reason: "ai_error", p_summary: "Analyse IA indisponible, vérification humaine." });
      } catch { /* journalisation best effort */ }
      results[id] = { error: "ai_error" };
    }
  }
  return json({ ok: true, results });
});
