// Supabase Edge Function: hard delete a company by companyId/email/name.
// Deploy: `supabase functions deploy delete-company-user`
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
// Security: requires `Authorization: Bearer <valid access_token>` from an admin session.
// The function deletes the company auth user first, then removes company/profile rows.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CompanyRow = {
  id: string;
  owner_uid: string | null;
  email: string | null;
  name: string | null;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

async function requireAdminSession(
  authClient: ReturnType<typeof createClient>,
  adminClient: ReturnType<typeof createClient>,
  token: string,
) {
  const { data: sessionData, error: sessionError } = await authClient.auth.getUser(token);
  if (sessionError || !sessionData?.user) {
    return { ok: false as const, status: 401, message: 'Invalid or expired session' };
  }

  const sessionUser = sessionData.user;
  const sessionRole = normalize(
    sessionUser.user_metadata?.role ||
      sessionUser.app_metadata?.role ||
      sessionUser.user_metadata?.adminRole ||
      sessionUser.app_metadata?.adminRole,
  );

  if (['admin', 'super-admin', 'super_admin'].includes(sessionRole)) {
    return { ok: true as const, userId: sessionUser.id, email: normalize(sessionUser.email) };
  }

  const { data: adminRow, error: adminRowError } = await adminClient
    .from('users')
    .select('role,status,auth_user_id,email')
    .eq('auth_user_id', sessionUser.id)
    .maybeSingle();

  if (adminRowError) {
    throw adminRowError;
  }

  const rowRole = normalize(adminRow?.role);
  const rowStatus = normalize(adminRow?.status);
  if (['admin', 'super-admin', 'super_admin'].includes(rowRole) && (!rowStatus || rowStatus === 'active')) {
    return { ok: true as const, userId: sessionUser.id, email: normalize(sessionUser.email) };
  }

  return { ok: false as const, status: 403, message: 'Forbidden' };
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  if (!email) return null;

  const perPage = 1000;
  let page = 1;

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find((user) => normalize(user.email) === email);
    if (match) return match;

    if (!data.users.length || data.users.length < perPage) return null;
    page += 1;
  }

  return null;
}

function pushDeleteTask(tasks: Array<Promise<{ error: unknown | null }>>, task: Promise<{ error: unknown | null }>) {
  tasks.push(task);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
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
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const sessionCheck = await requireAdminSession(authClient, adminClient, token);
    if (!sessionCheck.ok) {
      return jsonResponse({ error: sessionCheck.message }, sessionCheck.status);
    }

    const body = (await req.json().catch(() => ({}))) as {
      companyId?: string;
      email?: string;
      companyName?: string;
    };

    const companyId = normalize(body.companyId);
    const normalizedEmail = normalize(body.email);
    const normalizedName = normalize(body.companyName);

    if (!companyId && !normalizedEmail && !normalizedName) {
      return jsonResponse({ error: 'Missing company identifiers' }, 400);
    }

    const companyCandidates = new Map<string, CompanyRow>();
    const addRows = (rows: CompanyRow[] | null | undefined) => {
      (rows || []).forEach((row) => {
        if (!row?.id) return;
        companyCandidates.set(row.id, row);
      });
    };

    if (companyId) {
      const { data, error } = await adminClient
        .from('companies')
        .select('id,owner_uid,email,name')
        .eq('id', companyId)
        .limit(1);
      if (error) throw error;
      addRows(data as CompanyRow[] | null);
    }

    if (normalizedEmail) {
      const { data, error } = await adminClient
        .from('companies')
        .select('id,owner_uid,email,name')
        .eq('email', normalizedEmail)
        .limit(20);
      if (error) throw error;
      addRows(data as CompanyRow[] | null);
    }

    if (normalizedName) {
      const { data, error } = await adminClient
        .from('companies')
        .select('id,owner_uid,email,name')
        .eq('name', normalizedName)
        .limit(20);
      if (error) throw error;
      addRows(data as CompanyRow[] | null);
    }

    const companyRows = Array.from(companyCandidates.values());
    const companyIds = new Set(companyRows.map((row) => row.id).filter(Boolean));
    const ownerUids = new Set(
      companyRows
        .map((row) => normalize(row.owner_uid))
        .filter(Boolean),
    );

    if (normalizedEmail) {
      const authUserByEmail = await findAuthUserByEmail(adminClient, normalizedEmail);
      if (authUserByEmail?.id) {
        ownerUids.add(authUserByEmail.id);
      }
    }

    for (const row of companyRows) {
      if (row.owner_uid) {
        ownerUids.add(normalize(row.owner_uid));
      }
    }

    for (const ownerUid of ownerUids) {
      if (!ownerUid) continue;
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(ownerUid);
      if (authDeleteError && authDeleteError.message !== 'User not found') {
        throw authDeleteError;
      }
    }

    const deleteTasks: Array<Promise<{ error: unknown | null }>> = [];

    for (const id of companyIds) {
      pushDeleteTask(deleteTasks, adminClient.from('companies').delete().eq('id', id));
    }

    if (normalizedEmail) {
      pushDeleteTask(deleteTasks, adminClient.from('companies').delete().eq('email', normalizedEmail));
      pushDeleteTask(deleteTasks, adminClient.from('users').delete().eq('email', normalizedEmail).eq('role', 'company'));
    }

    for (const ownerUid of ownerUids) {
      if (!ownerUid) continue;
      pushDeleteTask(deleteTasks, adminClient.from('users').delete().eq('auth_user_id', ownerUid).eq('role', 'company'));
    }

    for (const id of companyIds) {
      pushDeleteTask(deleteTasks, adminClient.from('users').delete().eq('company_id', id).eq('role', 'company'));
    }

    if (normalizedName) {
      pushDeleteTask(deleteTasks, adminClient.from('companies').delete().eq('name', normalizedName));
    }

    const deleteResults = await Promise.all(deleteTasks);
    const failure = deleteResults.find((result) => result.error);
    if (failure?.error) {
      throw failure.error;
    }

    return jsonResponse(
      {
        ok: true,
        message: 'تم حذف الشركة نهائيًا من Supabase Auth وFirestore-like tables المرتبطة بها.',
        companyIds: Array.from(companyIds),
        authUsersDeleted: ownerUids.size,
      },
      200,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
