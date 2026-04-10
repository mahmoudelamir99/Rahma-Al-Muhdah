import { getSupabaseClient, hasSupabaseConfig } from './supabase';

/**
 * Calls a Supabase Edge Function (or any HTTPS endpoint) that deletes the auth user + profile rows.
 * Configure `VITE_SUPABASE_DELETE_CANDIDATE_URL` in `.env` after deploying `supabase/functions/delete-candidate-user`.
 */
export async function requestRemoteCandidateAuthPurge(email: string): Promise<{ ok: boolean; message: string }> {
  const trimmed = String(email || '').trim().toLowerCase();
  if (!trimmed) {
    return { ok: true, message: 'لا يوجد بريد إلكتروني — تم تخطي حذف Supabase Auth.' };
  }

  const url = import.meta.env.VITE_SUPABASE_DELETE_CANDIDATE_URL?.trim();
  if (!url) {
    return {
      ok: true,
      message:
        'تم حذف طلبات التقديم من Firebase. لحذف حساب Supabase Auth نهائيًا، انشر دالة Edge واضبط VITE_SUPABASE_DELETE_CANDIDATE_URL.',
    };
  }

  if (!hasSupabaseConfig()) {
    return { ok: false, message: 'Supabase غير مهيأ ولا يمكن استدعاء حذف الحساب عن بُعد.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: 'تعذر تهيئة عميل Supabase.' };
  }

  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ email: trimmed }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) {
      return {
        ok: false,
        message:
          'انتهت الجلسة أو غير مصرّح. سجّل الدخول مرة أخرى في اللوحة ثم أعد محاولة الحذف النهائي للمرشح.',
      };
    }
    return { ok: false, message: text || `فشل طلب الحذف عن بُعد (${response.status}).` };
  }

  return { ok: true, message: 'تم تنفيذ حذف المستخدم عبر الخادم (Auth + قاعدة البيانات حسب الدالة).' };
}
