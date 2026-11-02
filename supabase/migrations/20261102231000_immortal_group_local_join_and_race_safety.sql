-- Allow users to join opt-in local groups and serialize challenge roster operations.
begin;

create or replace function public.join_discovered_group(p_group uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_city text;
  v_region text;
  v_group public.groups%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select pr.city, pr.region into v_city, v_region from public.profiles pr where pr.user_id = v_uid;
  select g.* into v_group from public.groups g where g.id = p_group for update;
  if v_group.id is null or v_group.recruiting_scope = 'private' then raise exception 'group_recruitment_not_available'; end if;
  if v_group.recruiting_scope = 'city' and (v_city is null or lower(v_city) <> lower(v_group.recruiting_city)) then raise exception 'group_territory_mismatch'; end if;
  if v_group.recruiting_scope in ('city', 'region') and (v_region is null or lower(v_region) <> lower(v_group.recruiting_region)) then raise exception 'group_territory_mismatch'; end if;
  if (select count(*) from public.group_members gm where gm.group_id = p_group) >= 100 then raise exception 'group_full'; end if;
  insert into public.group_members (group_id, user_id) values (p_group, v_uid) on conflict do nothing;
  return p_group;
end
$function$;

create or replace function public.respond_group_challenge(p_challenge uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_participant_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select gc.challenged_group_id, gc.participant_count into v_group_id, v_participant_count
  from public.group_challenges gc where gc.id = p_challenge and gc.status = 'proposed' for update;
  if v_group_id is null then raise exception 'not_found'; end if;
  if not exists (select 1 from public.groups g where g.id = v_group_id and g.owner_id = v_uid) then raise exception 'forbidden'; end if;
  if p_accept and (select count(*) from public.group_members gm where gm.group_id = v_group_id) < v_participant_count then raise exception 'opponent_roster_too_small'; end if;
  update public.group_challenges set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = p_challenge;
end
$function$;

create or replace function public.join_group_challenge(p_challenge uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_required integer;
  v_status text;
  v_existing uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select gc.status, gc.participant_count into v_status, v_required
  from public.group_challenges gc where gc.id = p_challenge for update;
  if v_status is null then raise exception 'not_found'; end if;
  if v_status <> 'accepted' then raise exception 'group_challenge_not_open'; end if;
  select gm.group_id into v_group_id
  from public.group_members gm
  join public.group_challenges gc on gm.group_id in (gc.challenger_group_id, gc.challenged_group_id)
  where gc.id = p_challenge and gm.user_id = v_uid
  order by case when gm.group_id = gc.challenger_group_id then 0 else 1 end
  limit 1;
  if v_group_id is null then raise exception 'forbidden'; end if;
  select p.group_id into v_existing from public.group_challenge_participants p where p.challenge_id = p_challenge and p.user_id = v_uid;
  if v_existing is not null then return v_existing; end if;
  if (select count(*) from public.group_challenge_participants p where p.challenge_id = p_challenge and p.group_id = v_group_id) >= v_required then raise exception 'group_challenge_full'; end if;
  insert into public.group_challenge_participants (challenge_id, group_id, user_id) values (p_challenge, v_group_id, v_uid);
  return v_group_id;
end
$function$;

revoke all on function public.join_discovered_group(uuid) from public, anon;
grant execute on function public.join_discovered_group(uuid) to authenticated;
revoke all on function public.respond_group_challenge(uuid, boolean) from public, anon;
grant execute on function public.respond_group_challenge(uuid, boolean) to authenticated;
revoke all on function public.join_group_challenge(uuid) from public, anon;
grant execute on function public.join_group_challenge(uuid) to authenticated;

commit;