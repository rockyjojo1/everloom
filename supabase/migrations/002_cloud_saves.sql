-- Local-first cloud snapshots for the current Everloom GameSave format.
-- Apply only to a dedicated Everloom Supabase project.
create table if not exists public.el_cloud_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null default 0 check (slot between 0 and 2),
  payload jsonb not null,
  save_version integer not null check (save_version > 0),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table public.el_cloud_saves enable row level security;

revoke all on table public.el_cloud_saves from anon;
grant select, insert, update, delete on table public.el_cloud_saves to authenticated;

create policy "cloud_saves_select_own"
on public.el_cloud_saves for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "cloud_saves_insert_own"
on public.el_cloud_saves for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "cloud_saves_update_own"
on public.el_cloud_saves for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "cloud_saves_delete_own"
on public.el_cloud_saves for delete
to authenticated
using ((select auth.uid()) = user_id);

