-- ============================================================
-- SET_ADMIN.sql - تحويل مستخدم إلى أدمن
-- شغّل هذا بعد FULL_SETUP.sql
-- استبدل 'YOUR_ADMIN_EMAIL@example.com' بإيميل الأدمن الفعلي
-- ============================================================

-- الخطوة 1: ابحث عن الـ auth user id للأدمن
-- SELECT id FROM auth.users WHERE email = 'YOUR_ADMIN_EMAIL@example.com';

-- الخطوة 2: أضف أو حدّث سجل الأدمن في جدول users
-- استبدل 'PASTE_AUTH_USER_ID_HERE' بالـ UUID من الخطوة 1

INSERT INTO public.users (auth_user_id, role, email, display_name, status)
SELECT 
  id as auth_user_id,
  'admin' as role,
  email,
  'مدير النظام الأول' as display_name,
  'active' as status
FROM auth.users
WHERE email = 'YOUR_ADMIN_EMAIL@example.com'
ON CONFLICT (auth_user_id) 
DO UPDATE SET 
  role = 'admin',
  status = 'active',
  updated_at = timezone('utc', now());

-- تحقق من النتيجة
SELECT u.id, u.auth_user_id, u.role, u.email, u.display_name, u.status
FROM public.users u
WHERE u.role = 'admin';
