import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasRahmaSupabaseConfig, resolveRahmaSupabaseConfig, type RahmaSupabaseRuntimeConfig } from './supabase-config';

export type AdminSupabaseConfig = RahmaSupabaseRuntimeConfig;

const envSupabaseConfig: Partial<AdminSupabaseConfig> = {
  url: import.meta.env.VITE_SUPABASE_URL?.trim() || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '',
  siteBaseUrl: import.meta.env.VITE_SITE_BASE_URL?.trim() || '',
  adminBaseUrl: import.meta.env.VITE_ADMIN_BASE_URL?.trim() || '',
};

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseConfig() {
  return resolveRahmaSupabaseConfig(envSupabaseConfig);
}

export function hasSupabaseConfig() {
  return hasRahmaSupabaseConfig(getSupabaseConfig());
}

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!supabaseClient) {
    const config = getSupabaseConfig();
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}

export type SupabaseAuthSyncResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped?: false }
  | { ok: false; message: string };

/**
 * After admin login (local or Firebase-bridge), mirror credentials into Supabase Auth when configured.
 * Needed so Storage RLS (e.g. public.is_admin()) sees auth.uid() for uploads.
 */
export async function trySyncSupabaseAuthFromAdminCredentials(email: string, password: string): Promise<SupabaseAuthSyncResult> {
  if (!hasSupabaseConfig()) {
    return { ok: true, skipped: true };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: 'تعذر تهيئة عميل Supabase.' };
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, message: 'بريد أو كلمة مرور غير صالحة لمزامنة Supabase.' };
  }

  const { error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    return {
      ok: false,
      message:
        'لم تُنجح مزامنة جلسة Supabase (مطلوبة لرفع الملفات). تأكد أن نفس بريد/كلمة مرور الأدمن موجودة في Supabase Auth وأن المستخدم مربوط بـ public.users بدور admin.',
    };
  }

  return { ok: true };
}

export async function signOutSupabaseAuxAuth() {
  if (!hasSupabaseConfig()) return;
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch {
    /* ignore */
  }
}

