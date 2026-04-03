# Firebase Setup

## 1. Public site

- انسخ `firebase-site-config.example.js` إلى `firebase-site-config.js`.
- ضع قيم Firebase Web App الحقيقية داخل:
  - `apiKey`
  - `authDomain`
  - `projectId`
  - `storageBucket`
  - `messagingSenderId`
  - `appId`
  - `measurementId`

## 2. React Auth app

- انسخ `تسجيل-الدخول-وإنشاء-حساب/.env.example` إلى `.env`.
- املأ جميع متغيرات `VITE_FIREBASE_*`.
- أعد البناء:

```powershell
cd "k:\التعديلات الجديدة\Rahma Al Muhdah\تسجيل-الدخول-وإنشاء-حساب"
npm run build
```

## 3. Admin app

- انسخ `al-rahma-recruitment-admin/.env.example` إلى `.env`.
- املأ جميع متغيرات `VITE_FIREBASE_*` بنفس المشروع.
- أعد البناء:

```powershell
cd "k:\التعديلات الجديدة\Rahma Al Muhdah\al-rahma-recruitment-admin"
npm run build
```

## 4. Firebase rules

- انشر القواعد الموجودة في:
  - `firestore.rules`
  - `storage.rules`

## 5. What becomes live after config

- تسجيل ودخول الشركات عبر `Firebase Auth`
- الوظائف والشركات والطلبات عبر `Firestore`
- رفع صور الشركات عبر `Firebase Storage`
- مزامنة تحديثات الأدمن مع الموقع العام
