import { getFirebaseServices, hasFirebaseConfig } from './firebase';

/**
 * Calls a Firebase Cloud Function that hard deletes a company from Auth.
 * Configure the function URL after deploying.
 */
export async function requestRemoteCompanyAuthPurge(companyId: string): Promise<{ ok: boolean; message: string }> {
  const trimmed = String(companyId || '').trim();
  if (!trimmed) {
    return { ok: true, message: 'لا يوجد معرف شركة — تم تخطي حذف Firebase Auth.' };
  }

  const url = import.meta.env.VITE_FIREBASE_DELETE_COMPANY_URL?.trim();
  if (!url) {
    return {
      ok: true,
      message:
        'تم حذف الشركة من قاعدة البيانات. لحذف حساب Firebase Auth نهائيًا، انشر دالة Cloud Function واضبط VITE_FIREBASE_DELETE_COMPANY_URL.',
    };
  }

  if (!hasFirebaseConfig()) {
    return { ok: false, message: 'Firebase غير مهيأ ولا يمكن استدعاء حذف الحساب عن بُعد.' };
  }

  const services = await getFirebaseServices();
  if (!services) {
    return { ok: false, message: 'تعذر تهيئة خدمات Firebase.' };
  }

  const { auth } = services;
  const token = await auth.currentUser?.getIdToken();

  const response = await fetch(`${url}?companyId=${encodeURIComponent(trimmed)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) {
      return {
        ok: false,
        message:
          'انتهت الجلسة أو غير مصرّح. سجّل الدخول مرة أخرى في لوحة الإدارة ثم أعد محاولة الحذف النهائي للشركة.',
      };
    }

    if (response.status === 403) {
      return {
        ok: false,
        message: 'ليس لديك صلاحية حذف الشركات نهائيًا.',
      };
    }

    return {
      ok: false,
      message: `فشل حذف الشركة من Auth: ${text || 'خطأ غير معروف'}`,
    };
  }

  const result = await response.json().catch(() => ({}));
  return {
    ok: true,
    message: result.message || 'تم حذف الشركة نهائيًا من النظام.',
  };
}