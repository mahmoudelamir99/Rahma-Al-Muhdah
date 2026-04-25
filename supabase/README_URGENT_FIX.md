# 🚨 خطوات الإصلاح العاجل

## المشكلة
خطأ `Could not find the table 'public.companies'` يعني إن قاعدة البيانات فارغة - الجداول لم تُنشأ بعد.

## الحل (3 خطوات فقط)

### الخطوة 1: تطبيق Schema قاعدة البيانات

1. افتح [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك: `ebdqqippzkwksrdngasv`
3. اذهب إلى **SQL Editor**
4. انسخ كامل محتوى ملف `supabase/FULL_SETUP.sql`
5. الصقه في SQL Editor واضغط **Run**
6. انتظر حتى تظهر رسالة "Success"

### الخطوة 2: إنشاء حساب الأدمن

1. في نفس SQL Editor
2. افتح ملف `supabase/SET_ADMIN.sql`
3. استبدل `YOUR_ADMIN_EMAIL@example.com` بإيميل الأدمن الفعلي
4. شغّل الـ SQL

### الخطوة 3: إعادة النشر على Vercel

بعد تطبيق الـ schema، أعد نشر المشروعين:

```bash
# في مجلد next-public-site
cd next-public-site
npx vercel --prod

# في مجلد next-admin-panel  
cd next-admin-panel
npx vercel --prod
```

## ملاحظات مهمة

- **مشكلة "User already registered"**: تم إصلاحها في الكود - الآن بيظهر رسالة عربية واضحة
- **بطء التسجيل**: تم إصلاحه - الملفات بترفع بالتوازي بدل الواحدة ورا التانية
- **Storage Bucket**: الـ SQL بيُنشئ bucket اسمه `company-assets` تلقائياً

## التحقق من نجاح الإصلاح

بعد تشغيل FULL_SETUP.sql، شغّل هذا للتحقق:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

المفروض تشوف: `admin_activity_logs`, `applications`, `audit_logs`, `companies`, `jobs`, `site_config`, `site_settings`, `users`
