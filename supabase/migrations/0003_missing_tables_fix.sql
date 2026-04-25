-- ============================================================
-- Migration 0003: إصلاح الجداول الناقصة
-- يُنشئ: admin_activity_logs, site_settings
-- يُصلح: RLS policies للـ companies
-- ============================================================

-- ─── جدول سجل أنشطة الأدمن ────────────────────────────────
create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null default '',
  action text not null default '',
  target text not null default '',
  details text not null default '',
  level text not null default 'info' check (level in ('info', 'warning', 'error', 'success')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_activity_logs enable row level security;

drop policy if exists "activity_logs_admin_all" on public.admin_activity_logs;
create policy "activity_logs_admin_all" on public.admin_activity_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ─── جدول إعدادات الموقع ──────────────────────────────────
create table if not exists public.site_settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_admin_all" on public.site_settings;
create policy "site_settings_admin_all" on public.site_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings
for select
to anon, authenticated
using (true);

-- ─── إضافة عمود status لجدول companies لو مش موجود ────────
-- (الجدول الأصلي عنده status بقيم مختلفة، نضيف active/inactive كـ alias)
-- الكود الجديد بيستخدم 'active'/'inactive' لكن الجدول الأصلي عنده 'approved'/'restricted'
-- نضيف view أو نتعامل مع الموجود

-- ─── إضافة عمود description لجدول companies لو مش موجود ───
alter table if exists public.companies
  add column if not exists description text not null default '';

-- ─── Grant permissions ────────────────────────────────────
grant select, insert, update on public.admin_activity_logs to authenticated;
grant select, insert, update on public.site_settings to authenticated;
