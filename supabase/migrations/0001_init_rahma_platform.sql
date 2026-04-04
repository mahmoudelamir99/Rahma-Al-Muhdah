create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null default '',
  landline text not null default '',
  address text not null default '',
  sector text not null default '',
  location text not null default '',
  website text not null default '',
  social_links jsonb not null default '{"facebook":"","instagram":"","linkedin":"","x":""}'::jsonb,
  site_mode text not null default 'full' check (site_mode in ('full', 'landing')),
  restriction_message text not null default '',
  restriction_attachment_url text,
  restriction_attachment_name text not null default '',
  summary text not null default '',
  description text not null default '',
  logo_url text,
  cover_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'restricted', 'archived')),
  verified boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  role text not null check (role in ('admin', 'company', 'applicant')),
  email text not null,
  display_name text not null,
  phone text not null default '',
  city text not null default '',
  status text not null default 'active' check (status in ('active', 'suspended', 'banned', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_uid uuid not null references auth.users(id) on delete cascade,
  title text not null,
  company_name text not null,
  location text not null default '',
  type text not null default '',
  salary text not null default '',
  summary text not null default '',
  sector text not null default '',
  application_enabled boolean not null default true,
  featured boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden', 'rejected')),
  deleted_at timestamptz,
  deleted_by text check (deleted_by in ('admin', 'company')),
  deleted_status_snapshot text,
  restored_by_admin_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create sequence if not exists public.application_request_id_seq start 100000001 increment 1;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  request_id bigint not null unique default nextval('public.application_request_id_seq'),
  job_id uuid not null references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  applicant_uid uuid references auth.users(id) on delete set null,
  applicant_name text not null,
  applicant_email text not null,
  applicant_phone text not null,
  address text not null default '',
  governorate text not null default '',
  city text not null default '',
  experience text not null default '',
  experience_years text not null default '',
  expected_salary text not null default '',
  education_level text not null default '',
  specialization text not null default '',
  military_status text not null default '',
  public_service_completed text not null default '',
  marital_status text not null default '',
  cover_letter text not null default '',
  cv_file_name text not null default '',
  cv_file_path text,
  cv_public_url text,
  job_title text not null,
  company_name text not null,
  status text not null default 'pending' check (status in ('pending', 'review', 'interview', 'accepted', 'rejected', 'hired')),
  rejection_reason text not null default '',
  internal_notes jsonb not null default '[]'::jsonb,
  status_timeline jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_config (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_uid uuid references auth.users(id) on delete set null,
  actor_name text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details text not null default '',
  severity text not null default 'info' check (severity in ('info', 'warning', 'success', 'danger')),
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.users where auth_user_id = auth.uid() limit 1),
    'anon'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.owns_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies
    where id = target_company_id
      and owner_uid = auth.uid()
      and deleted_at is null
  );
$$;

create or replace function public.track_application_by_request(p_request_id bigint)
returns table (
  request_id bigint,
  applicant_name text,
  job_title text,
  company_name text,
  status text,
  rejection_reason text,
  submitted_at timestamptz,
  responded_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    a.request_id,
    a.applicant_name,
    a.job_title,
    a.company_name,
    a.status,
    a.rejection_reason,
    a.submitted_at,
    a.responded_at
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.companies c on c.id = a.company_id
  where a.request_id = p_request_id
    and a.deleted_at is null
    and j.deleted_at is null
    and c.deleted_at is null
    and j.status = 'approved'
    and c.status = 'approved'
  limit 1;
$$;

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_applications_updated_at on public.applications;
create trigger trg_applications_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

drop trigger if exists trg_site_config_updated_at on public.site_config;
create trigger trg_site_config_updated_at
before update on public.site_config
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.site_config enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "users_admin_all" on public.users;
create policy "users_admin_all" on public.users
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users_self_read" on public.users;
create policy "users_self_read" on public.users
for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists "users_self_insert" on public.users;
create policy "users_self_insert" on public.users
for insert
to authenticated
with check (auth_user_id = auth.uid());

drop policy if exists "users_self_update" on public.users;
create policy "users_self_update" on public.users
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists "companies_public_read" on public.companies;
create policy "companies_public_read" on public.companies
for select
to anon, authenticated
using (status = 'approved' and deleted_at is null);

drop policy if exists "companies_admin_all" on public.companies;
create policy "companies_admin_all" on public.companies
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "companies_owner_insert" on public.companies;
create policy "companies_owner_insert" on public.companies
for insert
to authenticated
with check (owner_uid = auth.uid());

drop policy if exists "companies_owner_update" on public.companies;
create policy "companies_owner_update" on public.companies
for update
to authenticated
using (owner_uid = auth.uid())
with check (owner_uid = auth.uid());

drop policy if exists "companies_owner_read" on public.companies;
create policy "companies_owner_read" on public.companies
for select
to authenticated
using (owner_uid = auth.uid());

drop policy if exists "jobs_public_read" on public.jobs;
create policy "jobs_public_read" on public.jobs
for select
to anon, authenticated
using (
  status = 'approved'
  and deleted_at is null
  and exists (
    select 1
    from public.companies c
    where c.id = company_id
      and c.status = 'approved'
      and c.deleted_at is null
  )
);

drop policy if exists "jobs_admin_all" on public.jobs;
create policy "jobs_admin_all" on public.jobs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "jobs_owner_crud" on public.jobs;
create policy "jobs_owner_crud" on public.jobs
for all
to authenticated
using (owner_uid = auth.uid())
with check (owner_uid = auth.uid());

drop policy if exists "applications_admin_all" on public.applications;
create policy "applications_admin_all" on public.applications
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "applications_company_read" on public.applications;
create policy "applications_company_read" on public.applications
for select
to authenticated
using (exists (
  select 1
  from public.companies c
  where c.id = company_id
    and c.owner_uid = auth.uid()
));

drop policy if exists "applications_company_update" on public.applications;
create policy "applications_company_update" on public.applications
for update
to authenticated
using (exists (
  select 1
  from public.companies c
  where c.id = company_id
    and c.owner_uid = auth.uid()
))
with check (exists (
  select 1
  from public.companies c
  where c.id = company_id
    and c.owner_uid = auth.uid()
));

drop policy if exists "applications_public_insert" on public.applications;
create policy "applications_public_insert" on public.applications
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = job_id
      and j.application_enabled = true
      and j.status = 'approved'
      and j.deleted_at is null
      and c.status = 'approved'
      and c.deleted_at is null
  )
);

drop policy if exists "site_config_admin_all" on public.site_config;
create policy "site_config_admin_all" on public.site_config
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "site_config_public_read" on public.site_config;
create policy "site_config_public_read" on public.site_config
for select
to anon, authenticated
using (id = 'public');

drop policy if exists "audit_logs_admin_all" on public.audit_logs;
create policy "audit_logs_admin_all" on public.audit_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
