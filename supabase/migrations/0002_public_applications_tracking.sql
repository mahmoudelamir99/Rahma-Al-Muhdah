alter table if exists public.jobs
  add column if not exists seats integer not null default 1,
  add column if not exists deadline timestamptz,
  add column if not exists education text not null default '',
  add column if not exists gender text not null default 'all',
  add column if not exists requirements text not null default '',
  add column if not exists benefits text not null default '';

alter table if exists public.applications
  add column if not exists tracking_id text,
  add column if not exists national_id text not null default '',
  add column if not exists national_id_image_url text,
  add column if not exists education_certificate_image_url text,
  add column if not exists military_status_image_url text,
  add column if not exists public_service_image_url text,
  add column if not exists cv_file_type text not null default '',
  add column if not exists attempt_number integer not null default 1;

create index if not exists idx_applications_tracking_id on public.applications (tracking_id);
create index if not exists idx_applications_job_national_id on public.applications (job_id, national_id);
create index if not exists idx_applications_applicant_phone on public.applications (applicant_phone);

create or replace function public.track_application_by_tracking_id(p_tracking_id text)
returns table (
  tracking_id text,
  request_id bigint,
  job_title text,
  company_name text,
  location text,
  status text,
  rejection_reason text,
  submitted_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(a.tracking_id, a.request_id::text) as tracking_id,
    a.request_id,
    a.job_title,
    a.company_name,
    coalesce(j.location, '') as location,
    a.status,
    a.rejection_reason,
    a.submitted_at,
    a.responded_at
  from public.applications a
  left join public.jobs j on j.id = a.job_id
  left join public.companies c on c.id = a.company_id
  where coalesce(a.tracking_id, '') = p_tracking_id
    and a.deleted_at is null
    and (j.id is null or j.deleted_at is null)
    and (c.id is null or c.deleted_at is null)
  order by a.submitted_at desc
  limit 1;
$$;

create or replace function public.lookup_applications_by_phone(p_phone text)
returns table (
  tracking_id text,
  request_id bigint,
  job_title text,
  company_name text,
  location text,
  status text,
  rejection_reason text,
  submitted_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(a.tracking_id, a.request_id::text) as tracking_id,
    a.request_id,
    a.job_title,
    a.company_name,
    coalesce(j.location, '') as location,
    a.status,
    a.rejection_reason,
    a.submitted_at,
    a.responded_at
  from public.applications a
  left join public.jobs j on j.id = a.job_id
  left join public.companies c on c.id = a.company_id
  where a.applicant_phone = p_phone
    and a.deleted_at is null
    and (j.id is null or j.deleted_at is null)
    and (c.id is null or c.deleted_at is null)
  order by a.submitted_at desc;
$$;

create or replace function public.check_application_submission_eligibility(p_job_id uuid, p_national_id text)
returns table (
  can_submit boolean,
  attempt_number integer,
  message text
)
language sql
stable
security definer
set search_path = public
as $$
  with matching as (
    select a.status
    from public.applications a
    where a.job_id = p_job_id
      and coalesce(a.national_id, '') = p_national_id
      and a.deleted_at is null
  ),
  stats as (
    select
      count(*)::integer as attempts_count,
      count(*) filter (where lower(status) = 'rejected')::integer as rejected_count,
      count(*) filter (where lower(status) in ('pending', 'review', 'interview', 'approved', 'accepted', 'hired'))::integer as active_count
    from matching
  )
  select
    case
      when active_count > 0 then false
      when attempts_count = 0 then true
      when attempts_count = 1 and rejected_count = 1 then true
      else false
    end as can_submit,
    case
      when attempts_count = 0 then 1
      when attempts_count = 1 and rejected_count = 1 then 2
      else greatest(attempts_count, 1)
    end as attempt_number,
    case
      when active_count > 0 then 'يوجد طلب سابق على هذه الوظيفة وما زال تحت المراجعة أو تم قبوله.'
      when attempts_count = 0 then 'يمكنك التقديم الآن.'
      when attempts_count = 1 and rejected_count = 1 then 'هذه هي المحاولة الأخيرة المتاحة بعد الرفض السابق.'
      else 'تم استهلاك كل المحاولات المتاحة على هذه الوظيفة.'
    end as message
  from stats;
$$;

grant execute on function public.track_application_by_tracking_id(text) to anon, authenticated;
grant execute on function public.lookup_applications_by_phone(text) to anon, authenticated;
grant execute on function public.check_application_submission_eligibility(uuid, text) to anon, authenticated;
