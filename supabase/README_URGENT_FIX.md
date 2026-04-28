# 🚨 خطوات إصلاح قاعدة البيانات (مطلوبة قبل التشغيل)

## الخطوة 1: تشغيل migration الأعمدة المفقودة

افتح **Supabase SQL Editor** وشغّل الملف:
```
supabase/migrations/add_missing_columns.sql
```

هذا الملف يضيف:
- `description` لجدول `jobs`
- `application_enabled` لجدول `jobs`  
- `applicants_count` لجدول `jobs`
- `candidate_name`, `candidate_email`, `candidate_phone` لجدول `applications`

## الخطوة 2: التحقق من Site URL في Supabase Auth

1. اذهب لـ **Authentication → URL Configuration**
2. تأكد أن **Site URL** = `https://rahma-al-muhdah.vercel.app`
3. أضف في **Redirect URLs**:
   - `https://rahma-al-muhdah.vercel.app/auth/callback`
   - `https://rahma-al-muhdah.vercel.app/auth/reset-password`
   - `http://localhost:3000/auth/callback` (للتطوير المحلي)

## الخطوة 3: متغيرات البيئة في Vercel

### للموقع العام:
```
NEXT_PUBLIC_SUPABASE_URL=https://ebdqqippzkwksrdngasv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_APP_URL=https://rahma-al-muhdah.vercel.app
```

### للوحة الإدارة:
```
NEXT_PUBLIC_SUPABASE_URL=https://ebdqqippzkwksrdngasv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_APP_URL=https://rahma-al-muhdah-admin.vercel.app
```

## الخطوة 4: إنشاء حساب Admin

شغّل في SQL Editor:
```sql
-- بعد تسجيل حساب عادي، حوّله لـ admin
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'your-admin@email.com';
```

أو استخدم ملف `supabase/SET_ADMIN.sql`.
