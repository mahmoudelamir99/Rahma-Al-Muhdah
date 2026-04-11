-- Public bucket for site-wide images (hero background, etc.).
-- Admin writes go through RLS using public.is_admin() (requires matching Supabase Auth user in public.users).

insert into storage.buckets (id, name, public)
values ('site_assets', 'site_assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "site_assets_public_read" on storage.objects;
drop policy if exists "site_assets_admin_insert" on storage.objects;
drop policy if exists "site_assets_admin_update" on storage.objects;
drop policy if exists "site_assets_admin_delete" on storage.objects;

create policy "site_assets_public_read"
on storage.objects
for select
to public
using (bucket_id = 'site_assets');

create policy "site_assets_admin_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'site_assets' and public.is_admin());

create policy "site_assets_admin_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'site_assets' and public.is_admin())
with check (bucket_id = 'site_assets' and public.is_admin());

create policy "site_assets_admin_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'site_assets' and public.is_admin());
