-- IMMORTAL — suppression de compte (exigence Apple / Google Play et RGPD, droit à l'effacement).
-- Annulation : 20261102140000_account_deletion.rollback.sql
-- Principe : le joueur supprime SON compte ; ses données personnelles disparaissent, les performances des autres joueurs restent intactes.
-- Le compte d'authentification et les fichiers vidéo sont supprimés par l'Edge Function `delete-account` (clé de service),
-- qui appelle d'abord cette fonction avec le jeton du joueur.

-- 1. Deux contraintes du schéma d'origine bloquaient la suppression d'un joueur :
--    a) une réponse dont le défi disparaît passait à challenge_id = null et violait la contrainte « une réponse a un défi » ;
--    b) un modérateur qui supprime son compte ne pouvait pas être retiré du journal (colonne obligatoire + ON DELETE SET NULL).
alter table public.attempts drop constraint if exists attempts_response_has_challenge;
alter table public.attempts add constraint attempts_response_has_challenge
  check (kind <> 'response' or challenge_id is not null or status <> 'pending');
alter table public.moderation_log alter column moderator_id drop not null;

-- 2. Efface les données du joueur connecté et renvoie les chemins de ses vidéos (à supprimer du stockage).
create or replace function public.delete_my_account_data()
returns text[]
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  paths text[];
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select coalesce(array_agg(video_path), '{}') into paths from public.attempts where user_id = uid;

  -- Les réponses des autres joueurs à mes défis restent (leurs scores et leurs classements ne bougent pas),
  -- mais celles qui attendent encore une décision sont retirées : elles n'auraient plus de défi auquel se rattacher.
  update public.attempts set status = 'withdrawn'
   where kind = 'response' and status = 'pending'
     and challenge_id in (select id from public.attempts where user_id = uid and kind = 'challenge');

  -- Historique de paiement : conservé (obligation comptable) mais détaché de la personne.
  update public.payment_events set user_id = null, payload = null where user_id = uid;

  delete from public.attempts where user_id = uid;
  delete from public.duel_events where player_a = uid or player_b = uid;
  delete from public.profiles where user_id = uid;
  delete from public.players_stats where user_id = uid;
  delete from public.push_tokens where user_id = uid;

  return paths;
end;
$$;

revoke execute on function public.delete_my_account_data() from public, anon;
grant execute on function public.delete_my_account_data() to authenticated;
