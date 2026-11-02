-- Group challenges can target only teams that opted into local recruiting.
begin;
create or replace function public.create_group_challenge(p_challenger_group uuid, p_challenged_group uuid, p_format_key text, p_participant_count integer default 1)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_uid uuid := auth.uid(); v_id uuid; v_scope text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_challenger_group = p_challenged_group then raise exception 'same_group'; end if;
  if p_participant_count < 1 or p_participant_count > 5 then raise exception 'invalid_participant_count'; end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = p_challenger_group and gm.user_id = v_uid) then raise exception 'forbidden'; end if;
  select g.recruiting_scope into v_scope from public.groups g where g.id = p_challenged_group;
  if v_scope is null then raise exception 'not_found'; end if;
  if v_scope = 'private' then raise exception 'group_recruitment_not_available'; end if;
  if not exists (select 1 from public.challenge_formats cf where cf.key = p_format_key and cf.active) then raise exception 'unknown_format'; end if;
  if (select count(*) from public.group_members gm where gm.group_id = p_challenger_group) < p_participant_count then raise exception 'group_roster_too_small'; end if;
  if (select count(*) from public.group_members gm where gm.group_id = p_challenged_group) < p_participant_count then raise exception 'opponent_roster_too_small'; end if;
  insert into public.group_challenges (challenger_group_id, challenged_group_id, format_key, participant_count, created_by)
  values (p_challenger_group, p_challenged_group, p_format_key, p_participant_count, v_uid)
  returning id into v_id;
  return v_id;
end
$function$;
revoke all on function public.create_group_challenge(uuid, uuid, text, integer) from public, anon;
grant execute on function public.create_group_challenge(uuid, uuid, text, integer) to authenticated;
commit;