-- IMMORTAL — production : players_stats et push_tokens référencent public.users(id), rempli par le déclencheur handle_new_user.
-- Deux comptes créés avant ce déclencheur n'ont pas de ligne public.users : ensure_player / update_my_profile échouaient (clé étrangère).
-- On crée la ligne manquante (id seulement) avant d'écrire players_stats. Aucune donnée existante n'est modifiée.
-- Annulation : revenir aux définitions de 20261101120000_immortal_server_authority.sql.
create or replace function public.ensure_player()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into public.users (id) values (uid) on conflict (id) do nothing;
  insert into public.profiles (user_id) values (uid) on conflict (user_id) do nothing;
  insert into public.players_stats (user_id) values (uid) on conflict (user_id) do nothing;
end;
$$;

create or replace function public.update_my_profile(p_pseudo text, p_city text, p_region text, p_country text, p_locale text default 'fr')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_pseudo is null or char_length(trim(p_pseudo)) < 2 or char_length(trim(p_pseudo)) > 24 then
    raise exception 'invalid_pseudo' using errcode = 'P0001';
  end if;
  if p_locale not in ('fr', 'en') then raise exception 'invalid_locale' using errcode = 'P0001'; end if;
  insert into public.users (id) values (uid) on conflict (id) do nothing;
  insert into public.profiles (user_id, pseudo, city, region, country, locale)
  values (uid, trim(p_pseudo), nullif(trim(p_city), ''), nullif(trim(p_region), ''), nullif(trim(p_country), ''), p_locale)
  on conflict (user_id) do update set
    pseudo = excluded.pseudo, city = excluded.city, region = excluded.region, country = excluded.country, locale = excluded.locale;
  insert into public.players_stats (user_id) values (uid) on conflict (user_id) do nothing;
end;
$$;
