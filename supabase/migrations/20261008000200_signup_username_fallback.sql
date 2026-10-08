-- The shared sign-up trigger (owned by the other app in this project) needs a
-- `username`. Email sign-ups send one; OAuth sign-ups (Google, from lofi.room)
-- do not, so they failed with "Database error saving new user".
-- Only when the username is missing, derive one from the email instead.
-- Sign-ups that do send a username behave exactly as before.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uname text := lower(new.raw_user_meta_data ->> 'username');
  base  text;
  tries int := 0;
begin
  if uname is null or uname = '' then
    base := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 14);
    if char_length(base) < 3 then base := 'user'; end if;
    uname := base;
    while exists (select 1 from public.profiles where username = uname) and tries < 50 loop
      tries := tries + 1;
      uname := base || '_' || substr(md5(random()::text), 1, 5);
    end loop;
    insert into public.profiles (id, username, display_name)
    values (new.id, uname,
            left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), uname), 40));
    return new;
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    uname,
    coalesce(new.raw_user_meta_data ->> 'username', '')
  );
  return new;
end;
$function$;
