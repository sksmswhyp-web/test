-- lofi.room — listening room backend
-- Every object is prefixed `lr_` so it can share a Supabase project (and its
-- auth users) with other apps, while staying in the API-exposed `public` schema.

-- ---------------------------------------------------------------------------
-- Profiles: one per auth user. `avatar` holds the character the user dressed
-- (style, colors, accessories) in the same shape the 3D client uses.
-- ---------------------------------------------------------------------------
create table public.lr_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- Friends: a one-way follow; two follows in both directions = friends.
create table public.lr_follows (
  follower_id uuid not null references public.lr_profiles (id) on delete cascade,
  followee_id uuid not null references public.lr_profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create type public.lr_visibility as enum ('public', 'friends', 'private');

-- ---------------------------------------------------------------------------
-- Rooms: one per user for now. `layout` is the serialized room
-- ({v, floor[], wall[], surf{wall,floor}}) exactly as the client saves it;
-- wall items reference photos by public.lr_photos.id.
-- ---------------------------------------------------------------------------
create table public.lr_rooms (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null unique references public.lr_profiles (id) on delete cascade,
  title                text not null default '내 리스닝 룸' check (char_length(title) <= 40),
  layout               jsonb not null default '{"v":1,"floor":[],"wall":[]}'::jsonb
                         check (pg_column_size(layout) < 256 * 1024),
  visibility           public.lr_visibility not null default 'public',
  featured_playlist_id uuid,
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Playlists of YouTube links. A track is either one video or a whole
-- YouTube playlist (`kind = 'list'`), stored by id, never by full URL.
-- ---------------------------------------------------------------------------
create table public.lr_playlists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.lr_profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.lr_playlists (owner_id, position);

alter table public.lr_rooms
  add constraint rooms_featured_playlist_fk
  foreign key (featured_playlist_id) references public.lr_playlists (id) on delete set null;

create table public.lr_playlist_tracks (
  id          uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.lr_playlists (id) on delete cascade,
  position    int  not null,
  kind        text not null check (kind in ('video', 'list')),
  youtube_id  text not null check (
                (kind = 'video' and youtube_id ~ '^[A-Za-z0-9_-]{11}$') or
                (kind = 'list'  and youtube_id ~ '^[A-Za-z0-9_-]{10,64}$')),
  title       text not null check (char_length(title) between 1 and 120),
  added_at    timestamptz not null default now(),
  unique (playlist_id, position) deferrable initially deferred
);

-- ---------------------------------------------------------------------------
-- Photos for picture frames. The file lives in Storage bucket `room-photos`
-- at `<owner_id>/<photo id>.jpg`; this row is the durable pointer.
-- ---------------------------------------------------------------------------
create table public.lr_photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.lr_profiles (id) on delete cascade,
  storage_path text not null unique,
  width        int  check (width  between 1 and 4096),
  height       int  check (height between 1 and 4096),
  created_at   timestamptz not null default now(),
  check (storage_path like owner_id::text || '/%')
);

-- Visitors' social bits.
create table public.lr_room_likes (
  room_id    uuid not null references public.lr_rooms (id) on delete cascade,
  user_id    uuid not null references public.lr_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.lr_guestbook (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.lr_rooms (id) on delete cascade,
  author_id  uuid not null references public.lr_profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index on public.lr_guestbook (room_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Who may see whose things
-- ---------------------------------------------------------------------------
create or replace function public.lr_are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lr_follows where follower_id = a and followee_id = b)
     and exists (select 1 from public.lr_follows where follower_id = b and followee_id = a);
$$;

-- True when the current viewer may look at `owner`'s room, playlists and photos.
create or replace function public.lr_can_view_owner(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner = auth.uid()
      or coalesce((
           select case r.visibility
                    when 'public'  then true
                    when 'friends' then auth.uid() is not null and public.lr_are_friends(owner, auth.uid())
                    else false
                  end
           from public.lr_rooms r where r.owner_id = owner), false);
$$;

grant execute on function public.lr_are_friends(uuid, uuid), public.lr_can_view_owner(uuid) to anon, authenticated;

-- updated_at bookkeeping
create or replace function public.lr_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger rooms_touch     before update on public.lr_rooms     for each row execute function public.lr_touch();
create trigger playlists_touch before update on public.lr_playlists for each row execute function public.lr_touch();

-- A new user gets a room automatically once their profile exists.
create or replace function public.lr_create_room() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.lr_rooms (owner_id) values (new.id) on conflict (owner_id) do nothing; return new; end $$;
create trigger profiles_room after insert on public.lr_profiles for each row execute function public.lr_create_room();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.lr_profiles        enable row level security;
alter table public.lr_follows         enable row level security;
alter table public.lr_rooms           enable row level security;
alter table public.lr_playlists       enable row level security;
alter table public.lr_playlist_tracks enable row level security;
alter table public.lr_photos          enable row level security;
alter table public.lr_room_likes      enable row level security;
alter table public.lr_guestbook       enable row level security;

create policy "profiles readable by everyone" on public.lr_profiles for select using (true);
create policy "own profile insert" on public.lr_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "own profile update" on public.lr_profiles for update to authenticated using (id = (select auth.uid()));

create policy "follows readable by everyone" on public.lr_follows for select using (true);
create policy "follow as yourself"   on public.lr_follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "unfollow as yourself" on public.lr_follows for delete to authenticated using (follower_id = (select auth.uid()));

create policy "rooms visible per setting" on public.lr_rooms for select using (public.lr_can_view_owner(owner_id));
create policy "own room update" on public.lr_rooms for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "playlists visible with room" on public.lr_playlists for select using (public.lr_can_view_owner(owner_id));
create policy "own playlists write" on public.lr_playlists for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "tracks visible with playlist" on public.lr_playlist_tracks for select using (
  exists (select 1 from public.lr_playlists p where p.id = playlist_id and public.lr_can_view_owner(p.owner_id)));
create policy "own tracks write" on public.lr_playlist_tracks for all to authenticated
  using      (exists (select 1 from public.lr_playlists p where p.id = playlist_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.lr_playlists p where p.id = playlist_id and p.owner_id = (select auth.uid())));

create policy "photos visible with room" on public.lr_photos for select using (public.lr_can_view_owner(owner_id));
create policy "own photos write" on public.lr_photos for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "likes readable with room" on public.lr_room_likes for select using (
  exists (select 1 from public.lr_rooms r where r.id = room_id and public.lr_can_view_owner(r.owner_id)));
create policy "like as yourself"   on public.lr_room_likes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.lr_rooms r where r.id = room_id and public.lr_can_view_owner(r.owner_id)));
create policy "unlike as yourself" on public.lr_room_likes for delete to authenticated using (user_id = (select auth.uid()));

create policy "guestbook readable with room" on public.lr_guestbook for select using (
  exists (select 1 from public.lr_rooms r where r.id = room_id and public.lr_can_view_owner(r.owner_id)));
create policy "sign guestbook as yourself" on public.lr_guestbook for insert to authenticated with check (
  author_id = (select auth.uid()) and exists (select 1 from public.lr_rooms r where r.id = room_id and public.lr_can_view_owner(r.owner_id)));
create policy "author or room owner deletes" on public.lr_guestbook for delete to authenticated using (
  author_id = (select auth.uid()) or exists (select 1 from public.lr_rooms r where r.id = room_id and r.owner_id = (select auth.uid())));

grant select on public.lr_profiles, public.lr_follows, public.lr_rooms, public.lr_playlists, public.lr_playlist_tracks,
  public.lr_photos, public.lr_room_likes, public.lr_guestbook to anon, authenticated;
grant insert, update, delete on public.lr_profiles, public.lr_follows, public.lr_rooms, public.lr_playlists,
  public.lr_playlist_tracks, public.lr_photos, public.lr_room_likes, public.lr_guestbook to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: frame photos. Private bucket; reads follow the room's visibility,
-- writes only into the uploader's own folder. 5 MB, images only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-photos', 'room-photos', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "room photos readable with room" on storage.objects for select using (
  bucket_id = 'room-photos' and exists (
    select 1 from public.lr_rooms r   -- lr_rooms RLS already limits this to rooms the viewer may see
    where r.owner_id::text = (storage.foldername(name))[1]));
create policy "upload into own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'room-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own photos" on storage.objects for delete to authenticated using (
  bucket_id = 'room-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
