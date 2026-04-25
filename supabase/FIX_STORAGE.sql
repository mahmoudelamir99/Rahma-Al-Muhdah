-- ============================================================
-- FIX_STORAGE.sql - إصلاح Storage Bucket
-- شغّل هذا لو ظهر خطأ في رفع الملفات
-- ============================================================

-- إنشاء bucket لو مش موجود
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets', 
  'company-assets', 
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- حذف الـ policies القديمة لو موجودة
DROP POLICY IF EXISTS "company_assets_upload" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_owner_update" ON storage.objects;

-- إنشاء policies جديدة
CREATE POLICY "company_assets_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "company_assets_public_read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'company-assets');

-- تحقق
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'company-assets';
