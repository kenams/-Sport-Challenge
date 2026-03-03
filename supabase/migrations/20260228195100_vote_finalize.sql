create or replace function public.finalize_challenge_votes(p_challenge_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline timestamptz;
  v_winner_id bigint;
  v_winner_user uuid;
  v_winner_pseudo text;
begin
  select created_at + interval '24 hours'
  into v_deadline
  from public.challenges
  where id = p_challenge_id;

  if v_deadline is null or v_deadline > now() then
    return;
  end if;

  if exists (
    select 1
    from public.challenge_responses
    where challenge_id = p_challenge_id
      and is_winner is true
  ) then
    return;
  end if;

  select r.id, r.user_id, r.pseudo
  into v_winner_id, v_winner_user, v_winner_pseudo
  from public.challenge_responses r
  left join (
    select response_id, count(*) as votes
    from public.challenge_response_votes
    where response_id in (
      select id from public.challenge_responses where challenge_id = p_challenge_id
    )
    group by response_id
  ) v on v.response_id = r.id
  where r.challenge_id = p_challenge_id
    and (r.ai_status is null or r.ai_status <> 'rejected')
  order by coalesce(v.votes, 0) desc, r.created_at asc
  limit 1;

  if v_winner_id is null then
    return;
  end if;

  update public.challenge_responses
  set is_winner = true
  where id = v_winner_id;

  insert into public.activities (
    user_id,
    pseudo,
    type,
    challenge_id,
    message
  ) values (
    v_winner_user,
    v_winner_pseudo,
    'challenge_winner',
    p_challenge_id,
    'Victoire par votes du public (auto).'
  );
end;
$$;

create or replace function public.maybe_finalize_votes_after_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge_id bigint;
begin
  select challenge_id into v_challenge_id
  from public.challenge_responses
  where id = new.response_id;

  if v_challenge_id is null then
    return new;
  end if;

  perform public.finalize_challenge_votes(v_challenge_id);
  return new;
end;
$$;

drop trigger if exists trg_finalize_votes_on_insert
  on public.challenge_response_votes;

create trigger trg_finalize_votes_on_insert
after insert on public.challenge_response_votes
for each row
execute function public.maybe_finalize_votes_after_vote();
