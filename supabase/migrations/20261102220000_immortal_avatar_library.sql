create or replace function public.set_my_avatar(p_avatar_slug text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  avatar_url text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_avatar_slug not in (
    'locks','black-curls','blonde','brown-curls','south-asian-woman',
    'south-asian-man','east-asian-man','east-asian-woman','north-african-man'
  ) then raise exception 'invalid_avatar' using errcode = 'P0001'; end if;
  avatar_url := 'https://immortal-arena.vercel.app/avatars/library/' || p_avatar_slug || '.jpg';
  update public.profiles set avatar_url = set_my_avatar.avatar_url where user_id = uid;
  if not found then raise exception 'profile_not_found' using errcode = 'P0001'; end if;
  return avatar_url;
end;
$function$;
revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
