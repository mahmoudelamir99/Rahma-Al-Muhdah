import { getFirebaseServices, hasFirebaseConfig } from './firebase';
import { getSupabaseClient, getSupabaseConfig, hasSupabaseConfig } from './supabase';

async function requestRemoteFirebaseCompanyPurge(
  companyId: string,
  companyEmail = '',
  companyName = '',
): Promise<{ ok: boolean; message: string }> {
  const trimmed = String(companyId || '').trim();
  const normalizedEmail = String(companyEmail || '').trim().toLowerCase();
  const normalizedName = String(companyName || '').trim();

  if (!trimmed) {
    return { ok: true, message: 'لا يوجد معرّف شركة، لذلك تم تخطي الحذف النهائي من Firebase.' };
  }

  if (!hasFirebaseConfig()) {
    return { ok: true, message: 'Firebase غير مهيأ حاليًا، لذلك تم تخطي الحذف النهائي من Firebase.' };
  }

  const services = await getFirebaseServices();
  if (!services) {
    return { ok: false, message: 'تعذر تجهيز خدمات Firebase الآن.' };
  }

  const { auth } = services;
  const authStateReady = (auth as typeof auth & { authStateReady?: () => Promise<void> }).authStateReady;
  if (typeof authStateReady === 'function') {
    try {
      await authStateReady.call(auth);
    } catch {
      // Ignore readiness failures and continue with the current auth snapshot.
    }
  }

  const token = await auth.currentUser?.getIdToken();
  const targetUrl = new URL(
    import.meta.env.VITE_FIREBASE_DELETE_COMPANY_URL?.trim() || '/api/admin/hard-delete-company',
    window.location.origin,
  );

  targetUrl.searchParams.set('companyId', trimmed);
  if (normalizedEmail) {
    targetUrl.searchParams.set('email', normalizedEmail);
  }
  if (normalizedName) {
    targetUrl.searchParams.set('companyName', normalizedName);
  }

  const response = await fetch(targetUrl.toString(), {
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
        message: 'جلسة الأدمن انتهت أو غير صالحة. سجّل الدخول مرة أخرى ثم أعد المحاولة.',
      };
    }

    if (response.status === 403) {
      return {
        ok: false,
        message: 'الحساب الحالي لا يملك صلاحية الحذف النهائي للشركات.',
      };
    }

    return {
      ok: false,
      message: `تعذر حذف الشركة نهائيًا من Firebase: ${text || 'خطأ غير معروف'}`,
    };
  }

  const result = await response.json().catch(() => ({}));
  return {
    ok: true,
    message: result.message || 'تم حذف الشركة نهائيًا من Firebase.',
  };
}

async function requestRemoteSupabaseCompanyPurge(
  companyId: string,
  companyEmail = '',
  companyName = '',
): Promise<{ ok: boolean; message: string }> {
  const trimmed = String(companyId || '').trim();
  const normalizedEmail = String(companyEmail || '').trim().toLowerCase();
  const normalizedName = String(companyName || '').trim();

  if (!trimmed && !normalizedEmail && !normalizedName) {
    return { ok: true, message: 'لا توجد بيانات Supabase للحذف، لذلك تم التخطي.' };
  }

  if (!hasSupabaseConfig()) {
    return { ok: true, message: 'Supabase غير مهيأ حاليًا، لذلك تم تخطي الحذف النهائي من Supabase.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: 'تعذر تجهيز عميل Supabase الآن.' };
  }

  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return { ok: false, message: 'لا توجد جلسة Supabase صالحة لتنفيذ الحذف النهائي.' };
  }

  const functionUrl =
    import.meta.env.VITE_SUPABASE_DELETE_COMPANY_URL?.trim() ||
    new URL('/functions/v1/delete-company-user', getSupabaseConfig().url).toString();

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      companyId: trimmed,
      email: normalizedEmail,
      companyName: normalizedName,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) {
      return {
        ok: false,
        message: 'جلسة Supabase انتهت أو غير صالحة. سجّل الدخول مرة أخرى ثم أعد المحاولة.',
      };
    }

    if (response.status === 403) {
      return {
        ok: false,
        message: 'الحساب الحالي لا يملك صلاحية حذف الشركة من Supabase.',
      };
    }

    return {
      ok: false,
      message: `تعذر حذف الشركة نهائيًا من Supabase: ${text || 'خطأ غير معروف'}`,
    };
  }

  const result = await response.json().catch(() => ({}));
  return {
    ok: true,
    message: result.message || 'تم حذف الشركة نهائيًا من Supabase.',
  };
}

/**
 * Hard deletes a company from every configured auth backend plus the backend-specific identity docs.
 * The local state update only runs after all configured remote purges succeed.
 */
export async function requestRemoteCompanyAuthPurge(
  companyId: string,
  companyEmail = '',
  companyName = '',
): Promise<{ ok: boolean; message: string }> {
  const firebaseTask = hasFirebaseConfig()
    ? requestRemoteFirebaseCompanyPurge(companyId, companyEmail, companyName)
    : Promise.resolve({ ok: true, message: 'Firebase غير مهيأ حاليًا، تم تخطيه.' });
  const supabaseTask = hasSupabaseConfig()
    ? requestRemoteSupabaseCompanyPurge(companyId, companyEmail, companyName)
    : Promise.resolve({ ok: true, message: 'Supabase غير مهيأ حاليًا، تم تخطيه.' });

  const [firebaseResult, supabaseResult] = await Promise.all([firebaseTask, supabaseTask]);
  if (!firebaseResult.ok) {
    return firebaseResult;
  }

  if (!supabaseResult.ok) {
    return supabaseResult;
  }

  return {
    ok: true,
    message: `${firebaseResult.message || 'تم حذف Firebase.'} ${supabaseResult.message || 'تم حذف Supabase.'}`.trim(),
  };
}
