// Supabase Edge Function: delete Auth user by email (+ optional public.profiles row).
// Deploy: `supabase functions deploy delete-candidate-user`
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (first two are injected by Supabase for functions).
//
// Security: requires `Authorization: Bearer <valid user access_token>`. Only callers with a real Supabase session
// (e.g. لوحة الإدارة بعد تسجيل الدخول) can trigger deletes. لا تعتمد على الرابط العلني وحده.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return jsonResponse({ error: 'Missing Authorization bearer token' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: 'Server misconfiguration' }, 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionUser, error: sessionError } = await authClient.auth.getUser(token);
    if (sessionError || !sessionUser?.user) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    const { email } = (await req.json()) as { email?: string };
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return jsonResponse({ error: 'Invalid email' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: page, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      throw listError;
    }

    const user = page.users.find((u) => String(u.email || '').toLowerCase() === normalized);
    if (!user) {
      return jsonResponse({ ok: true, message: 'No auth user for this email.' }, 200);
    }

    const { error: profileDeleteError } = await admin.from('profiles').delete().eq('id', user.id);
    if (profileDeleteError) {
      /* جدول profiles اختياري أو سياسات RLS — نكمل حذف Auth */
      console.warn('profiles delete skipped:', profileDeleteError.message);
    }

    const { error: delError } = await admin.auth.admin.deleteUser(user.id);
    if (delError) {
      throw delError;
    }

    return jsonResponse({ ok: true, message: 'User deleted.' }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
