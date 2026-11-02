// Suppression du compte du joueur connecté (RGPD, exigence Apple / Google).
// Déployer : supabase functions deploy delete-account   (JWT vérifié par la plateforme ; on revérifie ici)
// Variables : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (fournies par Supabase).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deleteAccount } from "../_shared/deleteAccount.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "not_authenticated" }, 401);

  let body: { confirm?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (body.confirm !== true) return json({ error: "confirmation_required" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asUser.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_authenticated" }, 401);

  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const bucket = service.storage.from("attempt-videos");

  const result = await deleteAccount(who.user.id, {
    async listFolder(userId) {
      const { data, error } = await bucket.list(userId, { limit: 1000 });
      if (error) throw new Error(error.message);
      return (data ?? []).filter((f) => f.id).map((f) => `${userId}/${f.name}`);
    },
    async removeFiles(paths) {
      const { error } = await bucket.remove(paths);
      if (error) throw new Error(error.message);
    },
    async deleteData() {
      const { data, error } = await asUser.rpc("delete_my_account_data");
      if (error) throw new Error(error.message);
      return (data as string[] | null) ?? [];
    },
    async deleteAuthUser(userId) {
      const { error } = await service.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },
  });

  if (!result.ok) {
    console.error(JSON.stringify({ source: "delete-account", step: result.step, message: result.message }));
    return json({ error: "deletion_failed", step: result.step }, 500);
  }
  return json({ ok: true, filesRemoved: result.filesRemoved });
});
