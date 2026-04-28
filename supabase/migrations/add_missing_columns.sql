-- ============================================================
-- إضافة الأعمدة المفقودة التي يستخدمها الكود
-- شغّل هذا في Supabase SQL Editor
-- ============================================================

-- إضافة description لجدول jobs (لو مش موجود)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- إضافة application_enabled لجدول jobs (لو مش موجود)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS application_enabled boolean NOT NULL DEFAULT true;

-- إضافة applicants_count لجدول jobs (لو مش موجود)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS applicants_count integer NOT NULL DEFAULT 0;

-- إضافة candidate_name و candidate_email لجدول applications (للتوافق مع الكود القديم)
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_name text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_email text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_phone text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_id uuid;

-- إضافة job_title لجدول applications (لو مش موجود - بعض الكود بيستخدمه)
-- ملاحظة: job_title موجود بالفعل في الـ schema الجديد

-- تحديث الـ RLS policy للـ jobs لتشمل application_enabled
DROP POLICY IF EXISTS "jobs_public_read" ON public.jobs;
CREATE POLICY "jobs_public_read" ON public.jobs FOR SELECT TO anon, authenticated USING (
  status = 'approved' 
  AND application_enabled = true
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.companies c 
    WHERE c.id = company_id 
    AND c.status = 'approved' 
    AND c.deleted_at IS NULL
  )
);

-- تحديث policy للـ applications insert لتشمل application_enabled
DROP POLICY IF EXISTS "applications_public_insert" ON public.applications;
CREATE POLICY "applications_public_insert" ON public.applications FOR INSERT TO anon, authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j 
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = job_id 
    AND j.application_enabled = true 
    AND j.status = 'approved'
    AND j.deleted_at IS NULL 
    AND c.status = 'approved' 
    AND c.deleted_at IS NULL
  )
);

-- تحقق من الأعمدة
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'jobs'
ORDER BY ordinal_position;
