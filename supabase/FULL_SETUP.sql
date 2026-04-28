-- ============================================================
-- FULL DATABASE SETUP (Final Version) - منصة الرحمة المهداة
-- هذا الكود آمن للتشغيل عدة مرات (يستخدم IF NOT EXISTS و DROP IF EXISTS)
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Helper: set_updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ─── 1. جدول companies ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  landline TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  social_links JSONB NOT NULL DEFAULT '{"facebook":"","instagram":"","linkedin":"","x":""}'::jsonb,
  site_mode TEXT NOT NULL DEFAULT 'full' CHECK (site_mode IN ('full', 'landing')),
  restriction_message TEXT NOT NULL DEFAULT '',
  restriction_attachment_url TEXT,
  restriction_attachment_name TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'restricted', 'archived')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 2. جدول users ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'company', 'applicant')),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 3. جدول jobs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  salary TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  application_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden', 'rejected')),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT CHECK (deleted_by IN ('admin', 'company')),
  deleted_status_snapshot TEXT,
  restored_by_admin_at TIMESTAMPTZ,
  seats INTEGER NOT NULL DEFAULT 1,
  deadline TIMESTAMPTZ,
  education TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT 'all',
  requirements TEXT NOT NULL DEFAULT '',
  benefits TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 4. Sequence للطلبات ───────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.application_request_id_seq START 100000001 INCREMENT 1;

-- ─── 5. جدول applications ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id BIGINT NOT NULL UNIQUE DEFAULT nextval('public.application_request_id_seq'),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  applicant_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  governorate TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL DEFAULT '',
  experience_years TEXT NOT NULL DEFAULT '',
  expected_salary TEXT NOT NULL DEFAULT '',
  education_level TEXT NOT NULL DEFAULT '',
  specialization TEXT NOT NULL DEFAULT '',
  military_status TEXT NOT NULL DEFAULT '',
  public_service_completed TEXT NOT NULL DEFAULT '',
  marital_status TEXT NOT NULL DEFAULT '',
  cover_letter TEXT NOT NULL DEFAULT '',
  cv_file_name TEXT NOT NULL DEFAULT '',
  cv_file_path TEXT,
  cv_public_url TEXT,
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'review', 'interview', 'accepted', 'rejected', 'hired')),
  rejection_reason TEXT NOT NULL DEFAULT '',
  internal_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  tracking_id TEXT,
  national_id TEXT NOT NULL DEFAULT '',
  national_id_image_url TEXT,
  education_certificate_image_url TEXT,
  military_status_image_url TEXT,
  public_service_image_url TEXT,
  cv_file_type TEXT NOT NULL DEFAULT '',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  responded_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 6. جدول site_config ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_config (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 7. جدول audit_logs ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'success', 'danger')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 8. جدول admin_activity_logs ──────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  target TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error', 'success')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 9. جدول site_settings ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_applications_tracking_id ON public.applications (tracking_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_national_id ON public.applications (job_id, national_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_phone ON public.applications (applicant_phone);
CREATE INDEX IF NOT EXISTS idx_companies_owner_uid ON public.companies (owner_uid);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs (company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users (auth_user_id);

-- ─── Triggers ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_applications_updated_at ON public.applications;
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_site_config_updated_at ON public.site_config;
CREATE TRIGGER trg_site_config_updated_at BEFORE UPDATE ON public.site_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Helper Functions ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1),
    'anon'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_app_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.owns_company(target_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = target_company_id AND owner_uid = auth.uid() AND deleted_at IS NULL
  );
$$;

-- ─── RLS ───────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Policies (Using DROP IF EXISTS for safety)
DROP POLICY IF EXISTS "users_admin_all" ON public.users;
CREATE POLICY "users_admin_all" ON public.users FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "users_self_read" ON public.users;
CREATE POLICY "users_self_read" ON public.users FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
DROP POLICY IF EXISTS "users_self_insert" ON public.users;
CREATE POLICY "users_self_insert" ON public.users FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
DROP POLICY IF EXISTS "users_self_update" ON public.users;
CREATE POLICY "users_self_update" ON public.users FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "companies_public_read" ON public.companies;
CREATE POLICY "companies_public_read" ON public.companies FOR SELECT TO anon, authenticated USING (status = 'approved' AND deleted_at IS NULL);
DROP POLICY IF EXISTS "companies_admin_all" ON public.companies;
CREATE POLICY "companies_admin_all" ON public.companies FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "companies_owner_insert" ON public.companies;
CREATE POLICY "companies_owner_insert" ON public.companies FOR INSERT TO authenticated WITH CHECK (owner_uid = auth.uid());
DROP POLICY IF EXISTS "companies_owner_update" ON public.companies;
CREATE POLICY "companies_owner_update" ON public.companies FOR UPDATE TO authenticated USING (owner_uid = auth.uid()) WITH CHECK (owner_uid = auth.uid());
DROP POLICY IF EXISTS "companies_owner_read" ON public.companies;
CREATE POLICY "companies_owner_read" ON public.companies FOR SELECT TO authenticated USING (owner_uid = auth.uid());

DROP POLICY IF EXISTS "jobs_public_read" ON public.jobs;
CREATE POLICY "jobs_public_read" ON public.jobs FOR SELECT TO anon, authenticated USING (
  status = 'approved' AND deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.status = 'approved' AND c.deleted_at IS NULL)
);
DROP POLICY IF EXISTS "jobs_admin_all" ON public.jobs;
CREATE POLICY "jobs_admin_all" ON public.jobs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "jobs_owner_crud" ON public.jobs;
CREATE POLICY "jobs_owner_crud" ON public.jobs FOR ALL TO authenticated USING (owner_uid = auth.uid()) WITH CHECK (owner_uid = auth.uid());

DROP POLICY IF EXISTS "applications_admin_all" ON public.applications;
CREATE POLICY "applications_admin_all" ON public.applications FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "applications_company_read" ON public.applications;
CREATE POLICY "applications_company_read" ON public.applications FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_uid = auth.uid())
);
DROP POLICY IF EXISTS "applications_company_update" ON public.applications;
CREATE POLICY "applications_company_update" ON public.applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_uid = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_uid = auth.uid()));
DROP POLICY IF EXISTS "applications_public_insert" ON public.applications;
CREATE POLICY "applications_public_insert" ON public.applications FOR INSERT TO anon, authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = job_id AND j.application_enabled = TRUE AND j.status = 'approved'
      AND j.deleted_at IS NULL AND c.status = 'approved' AND c.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "site_config_admin_all" ON public.site_config;
CREATE POLICY "site_config_admin_all" ON public.site_config FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "site_config_public_read" ON public.site_config;
CREATE POLICY "site_config_public_read" ON public.site_config FOR SELECT TO anon, authenticated USING (id = 'public');

DROP POLICY IF EXISTS "audit_logs_admin_all" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_all" ON public.audit_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "activity_logs_admin_all" ON public.admin_activity_logs;
CREATE POLICY "activity_logs_admin_all" ON public.admin_activity_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "site_settings_admin_all" ON public.site_settings;
CREATE POLICY "site_settings_admin_all" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "site_settings_public_read" ON public.site_settings;
CREATE POLICY "site_settings_public_read" ON public.site_settings FOR SELECT TO anon, authenticated USING (TRUE);

-- ─── إعداد Storage Buckets ─────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Policies for Storage
DROP POLICY IF EXISTS "company_assets_upload" ON storage.objects;
CREATE POLICY "company_assets_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-assets');

DROP POLICY IF EXISTS "company_assets_public_read" ON storage.objects;
CREATE POLICY "company_assets_public_read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'company-assets');

DROP POLICY IF EXISTS "company_assets_owner_delete" ON storage.objects;
CREATE POLICY "company_assets_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'company-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── انتهى الإعداد ─────────────────────────────────────────
