-- Un joueur du duel ne peut pas s'ajouter lui-même aux soutiens de son propre duel.
create or replace function public.support_event(p_id uuid, p_supported uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.duel_events%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into e from public.duel_events where id = p_id;
  if not found or e.status not in ('scheduled', 'live') then raise exception 'event_not_open_for_support' using errcode = 'P0001'; end if;
  if uid in (e.player_a, e.player_b) then raise exception 'participant_cannot_support' using errcode = 'P0001'; end if;
  if p_supported not in (e.player_a, e.player_b) then raise exception 'invalid_supported_player' using errcode = 'P0001'; end if;
  insert into public.event_supporters (event_id, user_id, supported_user_id) values (p_id, uid, p_supported)
  on conflict (event_id, user_id) do update set supported_user_id = excluded.supported_user_id;
end;
$$;
