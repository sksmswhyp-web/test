-- Keep the SECURITY DEFINER helpers out of the API-exposed `public` schema,
-- so they work inside RLS policies but cannot be called as /rest/v1/rpc/*.
-- Policies reference functions by oid, so moving them keeps every policy intact.

create schema if not exists lr_private;
grant usage on schema lr_private to anon, authenticated;

alter function public.lr_are_friends(uuid, uuid) set schema lr_private;
alter function public.lr_can_view_owner(uuid)    set schema lr_private;
alter function public.lr_create_room()           set schema lr_private;

create or replace function lr_private.lr_can_view_owner(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner = auth.uid()
      or coalesce((
           select case r.visibility
                    when 'public'  then true
                    when 'friends' then auth.uid() is not null and lr_private.lr_are_friends(owner, auth.uid())
                    else false
                  end
           from public.lr_rooms r where r.owner_id = owner), false);
$$;

-- Trigger-only: nobody calls it directly.
revoke execute on function lr_private.lr_create_room() from public, anon, authenticated;
