alter table if exists public.companies
  add column if not exists commercial_register_url text,
  add column if not exists tax_card_url text;

alter table if exists public.applications
  add column if not exists candidate_name text,
  add column if not exists candidate_email text,
  add column if not exists candidate_phone text;
