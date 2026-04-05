import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getFirebaseServices, hasFirebaseConfig } from './firebase';
import { getSupabaseClient, hasSupabaseConfig } from './supabase';

export type CompanyRegistrationInput = {
  companyName: string;
  companySector: string;
  companyCity: string;
  teamSize: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword?: string;
  remember: boolean;
};

export type CompanyLoginInput = {
  email: string;
  password: string;
  remember: boolean;
};

export type CompanySocialLinks = {
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
};

export type CompanySession = {
  loggedIn: true;
  role: 'company';
  provider: 'supabase' | 'firebase' | 'local';
  uid: string;
  companyId: string;
  email: string;
  name: string;
  loggedInAt: string;
  expiresAt: string;
  remember: boolean;
};

export type CompanyAuthResult =
  | {
      ok: true;
      message: string;
      session?: CompanySession;
      requiresEmailVerification?: boolean;
    }
  | {
      ok: false;
      message: string;
    };

type CompanyProfileRecord = Record<string, unknown>;

type SupabaseCompanyRow = {
  id: string;
  owner_uid: string;
  name: string;
  email: string;
  phone: string;
  landline: string;
  address: string;
  sector: string;
  location: string;
  website: string;
  social_links: Record<string, unknown> | null;
  site_mode: string;
  restriction_message: string;
  restriction_attachment_url: string | null;
  restriction_attachment_name: string;
  summary: string;
  description: string;
  logo_url: string | null;
  cover_url: string | null;
  status: string;
  verified: boolean;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const AUTH_SESSION_KEY = 'rahmaAuthSession';
const APPLICATION_PROFILE_KEY = 'rahmaApplicationProfile';
const ADMIN_RUNTIME_KEY = 'rahmaAdminPublicRuntime.v1';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCompanySocialLinks(value: unknown): CompanySocialLinks {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    facebook: String(source.facebook || '').trim(),
    instagram: String(source.instagram || '').trim(),
    linkedin: String(source.linkedin || '').trim(),
    x: String(source.x || source.twitter || '').trim(),
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeReadJSON<T>(key: string, fallback: T) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to save ${key}`, error);
  }
}

function safeWriteSession(session: CompanySession, remember: boolean) {
  const storage = remember ? window.localStorage : window.sessionStorage;
  const alternate = remember ? window.sessionStorage : window.localStorage;
  const payload = JSON.stringify(session);

  try {
    storage.setItem(AUTH_SESSION_KEY, payload);
  } catch (error) {
    console.warn('Unable to persist auth session', error);
  }

  try {
    alternate.removeItem(AUTH_SESSION_KEY);
  } catch {
    // Ignore cleanup failures.
  }
}

function clearStoredSession() {
  try {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // Ignore cleanup failures.
  }
}

function safeReadSession(): CompanySession | null {
  const sources = [window.sessionStorage, window.localStorage];

  for (const storage of sources) {
    try {
      const raw = storage.getItem(AUTH_SESSION_KEY);
      if (!raw) continue;
      return JSON.parse(raw) as CompanySession;
    } catch {
      // Ignore malformed sessions and continue to the next storage.
    }
  }

  return null;
}

export function getStoredCompanySession(): CompanySession | null {
  const session = safeReadSession();
  if (!session) return null;

  if (!session.expiresAt || Number.isNaN(Date.parse(session.expiresAt)) || Date.now() > Date.parse(session.expiresAt)) {
    try {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
      window.localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // Ignore cleanup failures.
    }
    return null;
  }

  return session;
}

function buildProfileFromRegistration(input: CompanyRegistrationInput, extras: Record<string, unknown> = {}) {
  const companyName = input.companyName.trim();
  const companySector = input.companySector.trim();
  const companyCity = input.companyCity.trim();
  const teamSize = input.teamSize.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const landline = String(extras.companyLandline || '').trim();
  const socialLinks = normalizeCompanySocialLinks(extras.socialLinks);
  const siteMode = String(extras.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full';

  return {
    role: 'company',
    accountStatus: 'pending',
    fullName: companyName,
    email,
    phone,
    companyLandline: landline,
    city: companyCity,
    headline: companySector,
    companyName,
    companySector,
    companyCity,
    teamSize,
    companyWebsite: '',
    website: '',
    socialLinks,
    siteMode,
    restrictionMessage: String(extras.restrictionMessage || '').trim(),
    restrictionAttachmentUrl: String(extras.restrictionAttachmentUrl || '').trim(),
    restrictionAttachmentName: String(extras.restrictionAttachmentName || '').trim(),
    companyDescription: '',
    description: '',
    companyLogoUrl: '',
    companyCoverUrl: '',
    companyLogoMeta: null,
    companyCoverMeta: null,
    companyJobDraft: {},
    companyJobs: [],
    companyProfile: {
      companyName,
      companySector,
      companyCity,
      teamSize,
      phone,
      landline,
      email,
      website: '',
      socialLinks,
      siteMode,
      restrictionMessage: String(extras.restrictionMessage || '').trim(),
      restrictionAttachmentUrl: String(extras.restrictionAttachmentUrl || '').trim(),
      restrictionAttachmentName: String(extras.restrictionAttachmentName || '').trim(),
      companyDescription: '',
      companyLogoUrl: '',
      companyCoverUrl: '',
      jobs: [],
      draft: {},
    },
    ...extras,
  };
}

function buildSession(input: {
  uid: string;
  companyId: string;
  email: string;
  name: string;
  provider: 'supabase' | 'firebase' | 'local';
  remember: boolean;
}): CompanySession {
  const now = new Date().toISOString();
  return {
    loggedIn: true,
    role: 'company',
    provider: input.provider,
    uid: input.uid,
    companyId: input.companyId,
    email: input.email,
    name: input.name,
    loggedInAt: now,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    remember: input.remember,
  };
}

function getCompanyAuthRedirectUrl(view: 'login' | 'reset-password' = 'login') {
  if (typeof window === 'undefined') return '';

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function hasCompanyPasswordRecoveryPending() {
  if (typeof window === 'undefined') return false;
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#/, '');
  return search.get('view') === 'reset-password' || /(?:^|&)type=recovery(?:&|$)/.test(hash);
}

function buildSupabaseProfileFromCompany(user: User, company: SupabaseCompanyRow): CompanyProfileRecord {
  return buildProfileFromRegistration(
    {
      companyName: company.name,
      companySector: company.sector || '',
      companyCity: company.location || company.address || '',
      teamSize: String((user.user_metadata?.teamSize as string | undefined) || '').trim(),
      phone: company.phone || '',
      email: company.email || user.email || '',
      password: '',
      confirmPassword: '',
      remember: true,
    },
    {
      accountStatus: company.status || 'pending',
      companyId: company.id,
      companyLandline: company.landline || '',
      companyLogoUrl: company.logo_url || '',
      companyCoverUrl: company.cover_url || '',
      companyDescription: company.description || company.summary || '',
      companyWebsite: company.website || '',
      socialLinks: normalizeCompanySocialLinks(company.social_links),
      siteMode: company.site_mode || 'full',
      restrictionMessage: company.restriction_message || '',
      restrictionAttachmentUrl: company.restriction_attachment_url || '',
      restrictionAttachmentName: company.restriction_attachment_name || '',
      createdAt: company.created_at || null,
      verified: company.verified,
    },
  );
}

function normalizeSupabaseAuthErrorMessage(error: unknown, fallback: string) {
  const message = String((error as { message?: string })?.message || '').trim().toLowerCase();
  if (!message) return fallback;

  if (message.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (message.includes('email not confirmed')) return 'راجع بريدك الإلكتروني أولًا ثم فعّل الحساب قبل تسجيل الدخول.';
  if (message.includes('user already registered')) return 'هذا البريد مسجل بالفعل. جرّب تسجيل الدخول مباشرة.';
  if (message.includes('password should be at least')) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.';
  if (message.includes('signup is disabled')) return 'إنشاء الحسابات متوقف حاليًا.';
  if (message.includes('email rate limit exceeded')) return 'تم تجاوز عدد المحاولات المسموح. جرّب مرة أخرى بعد قليل.';

  return fallback;
}

async function findSupabaseCompanyByOwner(supabase: SupabaseClient, ownerUid: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_uid', ownerUid)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as SupabaseCompanyRow | null) || null;
}

async function upsertSupabaseCompanyProfile(
  supabase: SupabaseClient,
  user: User,
  sourceProfile: CompanyProfileRecord,
) {
  const existing = await findSupabaseCompanyByOwner(supabase, user.id);
  const payload = {
    owner_uid: user.id,
    name: String(sourceProfile.companyName || user.user_metadata.companyName || user.email || '').trim(),
    email: String(sourceProfile.email || user.email || '').trim().toLowerCase(),
    phone: String(sourceProfile.phone || user.user_metadata.phone || '').trim(),
    landline: String(sourceProfile.companyLandline || '').trim(),
    address: String(sourceProfile.companyCity || sourceProfile.city || '').trim(),
    sector: String(sourceProfile.companySector || sourceProfile.headline || '').trim(),
    location: String(sourceProfile.companyCity || sourceProfile.city || '').trim(),
    website: String(sourceProfile.companyWebsite || sourceProfile.website || '').trim(),
    social_links: normalizeCompanySocialLinks(sourceProfile.socialLinks),
    site_mode: String(sourceProfile.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full',
    restriction_message: String(sourceProfile.restrictionMessage || '').trim(),
    restriction_attachment_url: String(sourceProfile.restrictionAttachmentUrl || '').trim() || null,
    restriction_attachment_name: String(sourceProfile.restrictionAttachmentName || '').trim(),
    summary: String(sourceProfile.companyDescription || sourceProfile.description || '').trim(),
    description: String(sourceProfile.companyDescription || sourceProfile.description || '').trim(),
    logo_url: String(sourceProfile.companyLogoUrl || '').trim() || null,
    cover_url: String(sourceProfile.companyCoverUrl || '').trim() || null,
    status: String(existing?.status || sourceProfile.accountStatus || 'pending').trim() || 'pending',
    verified: existing?.verified ?? false,
    deleted_at: null,
  };

  const { data, error } = existing
    ? await supabase.from('companies').update(payload).eq('id', existing.id).select('*').single()
    : await supabase.from('companies').insert(payload).select('*').single();

  if (error) throw error;

  const company = data as SupabaseCompanyRow;
  const { error: userError } = await supabase.from('users').upsert(
    {
      auth_user_id: user.id,
      company_id: company.id,
      role: 'company',
      email: company.email,
      display_name: company.name,
      phone: company.phone,
      city: company.location,
      status: ['restricted', 'archived'].includes(normalize(company.status)) ? 'suspended' : 'active',
    },
    { onConflict: 'auth_user_id' },
  );

  if (userError) throw userError;
  return company;
}

async function bootstrapSupabaseCompanyState(user: User, remember: boolean, fallbackProfile?: CompanyProfileRecord) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const profileSeed =
    fallbackProfile ||
    buildProfileFromRegistration(
      {
        companyName: String(user.user_metadata.companyName || user.email || 'شركة').trim(),
        companySector: String(user.user_metadata.companySector || '').trim(),
        companyCity: String(user.user_metadata.companyCity || '').trim(),
        teamSize: String(user.user_metadata.teamSize || '').trim(),
        phone: String(user.user_metadata.phone || '').trim(),
        email: user.email || '',
        password: '',
        confirmPassword: '',
        remember,
      },
      {
        accountStatus: 'pending',
      },
    );

  const company = await upsertSupabaseCompanyProfile(supabase, user, profileSeed);
  const profile = buildSupabaseProfileFromCompany(user, company);
  const session = buildSession({
    uid: user.id,
    companyId: company.id,
    email: company.email || user.email || '',
    name: company.name,
    provider: 'supabase',
    remember,
  });

  safeWriteSession(session, remember);
  persistLocalProfile(profile);

  return { session, profile, company };
}

function persistLocalProfile(profile: CompanyProfileRecord) {
  safeWriteJSON(APPLICATION_PROFILE_KEY, profile);
  syncCompanyRuntimeSnapshot(profile);
}

function createRuntimeCompanyId(companyName: string) {
  return `company-${normalize(companyName).replace(/[^a-z0-9]/g, '-') || 'custom'}`;
}

function getCompanyJobsFromProfile(profile: Record<string, unknown>) {
  const directJobs = Array.isArray(profile.companyJobs) ? profile.companyJobs : [];
  const nestedJobs =
    profile.companyProfile && typeof profile.companyProfile === 'object' && Array.isArray((profile.companyProfile as { jobs?: unknown[] }).jobs)
      ? (profile.companyProfile as { jobs: unknown[] }).jobs
      : [];

  return [...directJobs, ...nestedJobs];
}

function normalizeRuntimeJob(job: Record<string, unknown>, profile: Record<string, unknown>) {
  const companyName = String(job.companyName || profile.companyName || profile.fullName || '').trim();
  const title = String(job.title || job.jobTitle || '').trim();

  if (!companyName || !title) {
    return null;
  }

  const location = String(job.location || job.city || profile.companyCity || profile.city || '').trim();
  const postedAt = String(job.postedAt || job.createdAt || new Date().toISOString()).trim();

  return {
    id: String(job.id || createId('job')),
    title,
    companyName,
    location,
    type: String(job.type || '').trim(),
    postedLabel: String(job.postedLabel || '').trim(),
    salary: String(job.salary || '').trim(),
    summary: String(job.summary || job.description || '').trim(),
    sector: String(job.sector || profile.companySector || profile.headline || '').trim(),
    featured: Boolean(job.featured),
    status: String(job.status || 'approved').trim(),
    deletedAt: job.deletedAt || null,
    positions: String(job.positions || '').trim(),
    requirements: String(job.requirements || '').trim(),
    benefits: String(job.benefits || '').trim(),
    postedAt,
    createdAt: String(job.createdAt || postedAt).trim(),
    updatedAt: String(job.updatedAt || postedAt).trim(),
  };
}

function syncCompanyRuntimeSnapshot(profile: Record<string, unknown>) {
  const companyName = String(profile.companyName || profile.fullName || '').trim();
  if (!companyName) {
    return;
  }

  const runtime = safeReadJSON<Record<string, unknown>>(ADMIN_RUNTIME_KEY, {});
  const companies = Array.isArray(runtime.companies) ? runtime.companies : [];
  const jobs = Array.isArray(runtime.jobs) ? runtime.jobs : [];
  const existingCompany =
    companies.find((company) => normalize(String((company as Record<string, unknown>)?.name || '')) === normalize(companyName)) || {};

  const normalizedJobs = getCompanyJobsFromProfile(profile)
    .map((job) => normalizeRuntimeJob(job as Record<string, unknown>, profile))
    .filter(Boolean) as Array<Record<string, unknown>>;

  const nextCompany = {
    ...(existingCompany as Record<string, unknown>),
    id: String((existingCompany as Record<string, unknown>)?.id || createRuntimeCompanyId(companyName)).trim(),
    name: companyName,
    sector: String(profile.companySector || profile.headline || (existingCompany as Record<string, unknown>)?.sector || '').trim(),
    location: String(profile.companyCity || profile.city || (existingCompany as Record<string, unknown>)?.location || '').trim(),
    phone: String(profile.phone || (existingCompany as Record<string, unknown>)?.phone || '').trim(),
    landline: String(
      profile.companyLandline ||
        (profile.companyProfile as Record<string, unknown> | undefined)?.landline ||
        (existingCompany as Record<string, unknown>)?.landline ||
        '',
    ).trim(),
    socialLinks: normalizeCompanySocialLinks(
      profile.socialLinks ||
        (profile.companyProfile as Record<string, unknown> | undefined)?.socialLinks ||
        (existingCompany as Record<string, unknown>)?.socialLinks,
    ),
    website: String(profile.companyWebsite || profile.website || (existingCompany as Record<string, unknown>)?.website || '').trim(),
    openings: normalizedJobs.filter((job) => !job.deletedAt && normalize(String(job.status || 'approved')) === 'approved').length,
    summary: String(
      profile.companyDescription ||
        profile.description ||
        (existingCompany as Record<string, unknown>)?.summary ||
        (existingCompany as Record<string, unknown>)?.description ||
        '',
    ).trim(),
    logoLetter: String((existingCompany as Record<string, unknown>)?.logoLetter || companyName.charAt(0) || 'R').trim(),
    imageUrl: String(profile.companyLogoUrl || profile.companyCoverUrl || (existingCompany as Record<string, unknown>)?.imageUrl || '').trim() || null,
    logoUrl: String(profile.companyLogoUrl || (existingCompany as Record<string, unknown>)?.logoUrl || '').trim() || null,
    coverImage: String(profile.companyCoverUrl || (existingCompany as Record<string, unknown>)?.coverImage || '').trim() || null,
    description: String(profile.companyDescription || profile.description || (existingCompany as Record<string, unknown>)?.description || '').trim(),
    status: String((existingCompany as Record<string, unknown>)?.status || profile.accountStatus || 'pending').trim(),
    siteMode: String(
      profile.siteMode ||
        (profile.companyProfile as Record<string, unknown> | undefined)?.siteMode ||
        (existingCompany as Record<string, unknown>)?.siteMode ||
        'full',
    ).trim() === 'landing'
      ? 'landing'
      : 'full',
    restrictionMessage: String(
      profile.restrictionMessage ||
        (profile.companyProfile as Record<string, unknown> | undefined)?.restrictionMessage ||
        (existingCompany as Record<string, unknown>)?.restrictionMessage ||
        '',
    ).trim(),
    restrictionAttachmentUrl: String(
      profile.restrictionAttachmentUrl ||
        (profile.companyProfile as Record<string, unknown> | undefined)?.restrictionAttachmentUrl ||
        (existingCompany as Record<string, unknown>)?.restrictionAttachmentUrl ||
        '',
    ).trim(),
    restrictionAttachmentName: String(
      profile.restrictionAttachmentName ||
        (profile.companyProfile as Record<string, unknown> | undefined)?.restrictionAttachmentName ||
        (existingCompany as Record<string, unknown>)?.restrictionAttachmentName ||
        '',
    ).trim(),
    verified: (existingCompany as Record<string, unknown>)?.verified ?? false,
    deletedAt: null,
  };

  const nextJobs = [...jobs] as Array<Record<string, unknown>>;
  normalizedJobs.forEach((job) => {
    const existingJobIndex = nextJobs.findIndex((existingJob) => {
      const sameId = normalize(String(existingJob.id || '')) === normalize(String(job.id || ''));
      const sameSignature =
        normalize(String(existingJob.title || '')) === normalize(String(job.title || '')) &&
        normalize(String(existingJob.companyName || '')) === normalize(String(job.companyName || '')) &&
        normalize(String(existingJob.location || '')) === normalize(String(job.location || ''));

      return sameId || sameSignature;
    });

    if (existingJobIndex >= 0) {
      nextJobs[existingJobIndex] = {
        ...nextJobs[existingJobIndex],
        ...job,
        companyName,
      };
      return;
    }

    nextJobs.unshift({
      ...job,
      companyName,
    });
  });

  safeWriteJSON(ADMIN_RUNTIME_KEY, {
    ...runtime,
    companies: [
      nextCompany,
      ...companies.filter(
        (company) => normalize(String((company as Record<string, unknown>)?.name || '')) !== normalize(companyName),
      ),
    ],
    jobs: nextJobs,
  });
}

async function persistFirebaseProfile(session: CompanySession, profile: Record<string, unknown>) {
  const services = await getFirebaseServices();
  if (!services) {
    return;
  }

  const { firestoreModule, db } = services;
  const now = firestoreModule.serverTimestamp();
  const companyDoc = {
    id: session.companyId,
    uid: session.uid,
    ownerUid: session.uid,
    name: String(profile.companyName || session.name || '').trim(),
    sector: String(profile.companySector || profile.headline || '').trim(),
    city: String(profile.companyCity || profile.city || '').trim(),
    location: String(profile.companyCity || profile.city || '').trim(),
    teamSize: String(profile.teamSize || '').trim(),
    phone: String(profile.phone || session.email || '').trim(),
    landline: String(profile.companyLandline || (profile.companyProfile as Record<string, unknown> | undefined)?.landline || '').trim(),
    email: String(profile.email || session.email || '').trim().toLowerCase(),
    website: String(profile.companyWebsite || profile.website || '').trim(),
    socialLinks: normalizeCompanySocialLinks(
      profile.socialLinks || (profile.companyProfile as Record<string, unknown> | undefined)?.socialLinks,
    ),
    siteMode:
      String(profile.siteMode || (profile.companyProfile as Record<string, unknown> | undefined)?.siteMode || 'full').trim() === 'landing'
        ? 'landing'
        : 'full',
    restrictionMessage: String(
      profile.restrictionMessage || (profile.companyProfile as Record<string, unknown> | undefined)?.restrictionMessage || '',
    ).trim(),
    restrictionAttachmentUrl: String(
      profile.restrictionAttachmentUrl ||
        (profile.companyProfile as Record<string, unknown> | undefined)?.restrictionAttachmentUrl ||
        '',
    ).trim(),
    restrictionAttachmentName: String(
      profile.restrictionAttachmentName ||
        (profile.companyProfile as Record<string, unknown> | undefined)?.restrictionAttachmentName ||
        '',
    ).trim(),
    description: String(profile.companyDescription || profile.description || '').trim(),
    status: 'pending',
    verified: false,
    deletedAt: null,
    logoUrl: String(profile.companyLogoUrl || '').trim(),
    coverUrl: String(profile.companyCoverUrl || '').trim(),
    logoLetter: String(profile.companyName || session.name || 'ش').trim().slice(0, 1) || 'ش',
    createdAt: profile.createdAt || now,
    updatedAt: now,
  };

  await firestoreModule.setDoc(firestoreModule.doc(db, 'companies', session.companyId), companyDoc, { merge: true });
  await firestoreModule.setDoc(
    firestoreModule.doc(db, 'users', session.uid),
    {
      uid: session.uid,
      role: 'company',
      companyId: session.companyId,
      companyName: companyDoc.name,
      email: companyDoc.email,
      status: 'active',
      updatedAt: now,
    },
    { merge: true },
  );
}

function buildSupabaseMetadata(input: CompanyRegistrationInput) {
  return {
    role: 'company',
    companyName: input.companyName.trim(),
    companySector: input.companySector.trim(),
    companyCity: input.companyCity.trim(),
    teamSize: input.teamSize.trim(),
    phone: input.phone.trim(),
  };
}

async function registerWithSupabase(input: CompanyRegistrationInput): Promise<CompanyAuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: 'خدمة إنشاء الحساب غير متاحة الآن.',
    };
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const profileSeed = buildProfileFromRegistration(input, { accountStatus: 'pending' });
  const emailRedirectTo = getCompanyAuthRedirectUrl('login');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: emailRedirectTo || undefined,
      data: buildSupabaseMetadata(input),
    },
  });

  if (error) {
    return {
      ok: false,
      message: normalizeSupabaseAuthErrorMessage(error, 'تعذر إنشاء حساب الشركة الآن.'),
    };
  }

  let activeUser = data.user;
  let activeSession = data.session;
  if (!activeSession) {
    const signInAttempt = await supabase.auth.signInWithPassword({ email, password });
    if (!signInAttempt.error) {
      activeUser = signInAttempt.data.user;
      activeSession = signInAttempt.data.session;
    }
  }

  if (!activeUser || !activeSession) {
    return {
      ok: true,
      message: 'تم إنشاء الحساب. راجع بريدك الإلكتروني لتفعيل الحساب ثم سجّل الدخول.',
      requiresEmailVerification: true,
    };
  }

  await bootstrapSupabaseCompanyState(activeUser, input.remember, profileSeed);

  return {
    ok: true,
    message: 'تم إنشاء حساب الشركة بنجاح.',
    session: getStoredCompanySession() || undefined,
  };
}

async function loginWithSupabase(input: CompanyLoginInput): Promise<CompanyAuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: 'تسجيل الدخول غير متاح الآن.',
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error || !data.user) {
    return {
      ok: false,
      message: normalizeSupabaseAuthErrorMessage(error, 'تعذر تسجيل الدخول الآن.'),
    };
  }

  const bootstrapped = await bootstrapSupabaseCompanyState(data.user, input.remember);
  if (!bootstrapped) {
    return {
      ok: false,
      message: 'تعذر تحميل بيانات الشركة بعد تسجيل الدخول.',
    };
  }

  if (['restricted', 'archived'].includes(normalize(bootstrapped.company.status))) {
    await supabase.auth.signOut();
    clearStoredSession();
    return {
      ok: false,
      message: 'هذا الحساب غير متاح حاليًا. تواصل مع الدعم لو كنت تحتاج مراجعة الحالة.',
    };
  }

  return {
    ok: true,
    message: 'تم تسجيل الدخول بنجاح.',
    session: bootstrapped.session,
  };
}

async function registerWithFirebase(input: CompanyRegistrationInput): Promise<CompanyAuthResult> {
  const services = await getFirebaseServices();
  if (!services) {
    return {
      ok: false,
      message: 'الخدمة غير متاحة الآن. جرّب مرة أخرى بعد قليل.',
    };
  }

  const { auth, authModule } = services;
  await authModule.setPersistence(
    auth,
    input.remember ? authModule.browserLocalPersistence : authModule.browserSessionPersistence,
  );

  const credential = await authModule.createUserWithEmailAndPassword(auth, input.email.trim().toLowerCase(), input.password);
  const user = credential.user;
  const companyId = user.uid;
  const companyName = input.companyName.trim();
  const profile = buildProfileFromRegistration(input, { accountStatus: 'pending' });
  const session = buildSession({
    uid: user.uid,
    companyId,
    email: user.email || input.email.trim().toLowerCase(),
    name: companyName,
    provider: 'firebase',
    remember: input.remember,
  });

  await authModule.updateProfile(user, { displayName: companyName });
  await persistFirebaseProfile(session, profile);
  safeWriteSession(session, input.remember);
  persistLocalProfile(profile);

  return {
    ok: true,
    message: 'تم إنشاء حساب الشركة بنجاح.',
    session,
  };
}

async function loginWithFirebase(input: CompanyLoginInput): Promise<CompanyAuthResult> {
  const services = await getFirebaseServices();
  if (!services) {
    return {
      ok: false,
      message: 'الخدمة غير متاحة الآن. جرّب مرة أخرى بعد قليل.',
    };
  }

  const { auth, authModule, firestoreModule, db } = services;
  await authModule.setPersistence(
    auth,
    input.remember ? authModule.browserLocalPersistence : authModule.browserSessionPersistence,
  );

  const credential = await authModule.signInWithEmailAndPassword(auth, input.email.trim().toLowerCase(), input.password);
  const user = credential.user;
  const companyId = user.uid;
  const companySnap = await firestoreModule.getDoc(firestoreModule.doc(db, 'companies', companyId));
  const companyData = companySnap.exists() ? companySnap.data() : {};

  if (companyData.status && ['restricted', 'suspended', 'archived'].includes(normalize(String(companyData.status)))) {
    return {
      ok: false,
      message: 'هذا الحساب غير متاح حاليًا. تواصل مع الدعم إذا كنت تحتاج مراجعة الحالة.',
    };
  }

  const companyName = String(companyData.name || companyData.companyName || user.displayName || input.email.split('@')[0] || 'شركة').trim();
  const profile = buildProfileFromRegistration(
    {
      companyName,
      companySector: String(companyData.sector || companyData.companySector || '').trim(),
      companyCity: String(companyData.city || companyData.location || '').trim(),
      teamSize: String(companyData.teamSize || '').trim(),
      phone: String(companyData.phone || '').trim(),
      email: user.email || input.email.trim().toLowerCase(),
      password: input.password,
      confirmPassword: input.password,
      remember: input.remember,
    },
    {
      accountStatus: String(companyData.status || 'active'),
      companyLandline: String(companyData.landline || companyData.companyLandline || '').trim(),
      companyLogoUrl: String(companyData.logoUrl || companyData.companyLogoUrl || '').trim(),
      companyCoverUrl: String(companyData.coverUrl || companyData.companyCoverUrl || '').trim(),
      companyDescription: String(companyData.description || companyData.companyDescription || '').trim(),
      companyWebsite: String(companyData.website || '').trim(),
      socialLinks: normalizeCompanySocialLinks(companyData.socialLinks),
      siteMode: String(companyData.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full',
      restrictionMessage: String(companyData.restrictionMessage || '').trim(),
      restrictionAttachmentUrl: String(companyData.restrictionAttachmentUrl || '').trim(),
      restrictionAttachmentName: String(companyData.restrictionAttachmentName || '').trim(),
      createdAt: companyData.createdAt || null,
    },
  );

  const session = buildSession({
    uid: user.uid,
    companyId,
    email: user.email || input.email.trim().toLowerCase(),
    name: companyName,
    provider: 'firebase',
    remember: input.remember,
  });

  safeWriteSession(session, input.remember);
  persistLocalProfile(profile);

  return {
    ok: true,
    message: 'تم تسجيل الدخول بنجاح.',
    session,
  };
}

/* Legacy local auth fallback removed.
async function registerWithLocalFallback(input: CompanyRegistrationInput): Promise<CompanyAuthResult> {
  const accounts = safeReadJSON<LocalCompanyAccount[]>(LEGACY_ACCOUNTS_KEY, []);
  const email = input.email.trim().toLowerCase();
  const existingAccount = accounts.find((account) => normalize(account.email) === normalize(email));
  if (existingAccount) {
    return {
      ok: false,
      message: 'هذا البريد مستخدم بالفعل لحساب شركة محلي.',
    };
  }

  const passwordHash = await sha256Hex(input.password);
  const uid = createId('company-user');
  const companyId = createId('company');
  const profile = buildProfileFromRegistration(input);

  safeWriteJSON(LEGACY_ACCOUNTS_KEY, [
    ...accounts,
    {
      uid,
      companyId,
      companyName: input.companyName.trim(),
      companySector: input.companySector.trim(),
      companyCity: input.companyCity.trim(),
      teamSize: input.teamSize.trim(),
      phone: input.phone.trim(),
      email,
      passwordHash,
      status: 'active',
    },
  ]);

  const session = buildSession({
    uid,
    companyId,
    email,
    name: input.companyName.trim(),
    provider: 'local',
    remember: input.remember,
  });

  safeWriteSession(session, input.remember);
  persistLocalProfile(profile);

  return {
    ok: true,
    message: 'تم إنشاء حساب الشركة محليًا بنجاح.',
    session,
  };
}

async function loginWithLocalFallback(input: CompanyLoginInput): Promise<CompanyAuthResult> {
  const accounts = safeReadJSON<LocalCompanyAccount[]>(LEGACY_ACCOUNTS_KEY, []);
  const email = input.email.trim().toLowerCase();
  const passwordHash = await sha256Hex(input.password);
  const account = accounts.find(
    (item) => normalize(item.email) === normalize(email) && item.passwordHash === passwordHash,
  );

  if (!account) {
    return {
      ok: false,
      message: 'بيانات الدخول غير صحيحة في الوضع المحلي.',
    };
  }

  const profile = buildProfileFromRegistration(
    {
      companyName: account.companyName,
      companySector: account.companySector,
      companyCity: account.companyCity,
      teamSize: account.teamSize,
      phone: account.phone,
      email: account.email,
      password: input.password,
      confirmPassword: input.password,
      remember: input.remember,
    },
    {
      accountStatus: account.status,
    },
  );

  const session = buildSession({
    uid: account.uid,
    companyId: account.companyId,
    email: account.email,
    name: account.companyName,
    provider: 'local',
    remember: input.remember,
  });

  safeWriteSession(session, input.remember);
  persistLocalProfile(profile);

  return {
    ok: true,
    message: 'تم تسجيل الدخول محليًا بنجاح.',
    session,
  };
}
*/

async function registerWithLocalFallback(_input: CompanyRegistrationInput): Promise<CompanyAuthResult> {
  return {
    ok: false,
    message: 'التسجيل المحلي غير متاح الآن. فعّل الخدمة المطلوبة قبل إنشاء أي حساب شركة.',
  };
}

async function loginWithLocalFallback(_input: CompanyLoginInput): Promise<CompanyAuthResult> {
  return {
    ok: false,
    message: 'تسجيل الدخول المحلي غير متاح الآن. فعّل الخدمة المطلوبة قبل استخدام لوحة الشركة.',
  };
}

export async function registerCompany(input: CompanyRegistrationInput): Promise<CompanyAuthResult> {
  if (!input.companyName.trim() || !input.companySector.trim() || !input.companyCity.trim() || !input.email.trim()) {
    return {
      ok: false,
      message: 'املأ بيانات الشركة الأساسية قبل المتابعة.',
    };
  }

  if (input.password.length < 8) {
    return {
      ok: false,
      message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
    };
  }

  if (input.confirmPassword && input.password !== input.confirmPassword) {
    return {
      ok: false,
      message: 'كلمتا المرور غير متطابقتين.',
    };
  }

  if (hasSupabaseConfig()) {
    return registerWithSupabase(input);
  }

  if (hasFirebaseConfig()) {
    return registerWithFirebase(input);
  }

  return registerWithLocalFallback(input);
}

export async function loginCompany(input: CompanyLoginInput): Promise<CompanyAuthResult> {
  if (!input.email.trim() || !input.password) {
    return {
      ok: false,
      message: 'اكتب البريد الإلكتروني وكلمة المرور أولًا.',
    };
  }

  if (hasSupabaseConfig()) {
    return loginWithSupabase(input);
  }

  if (hasFirebaseConfig()) {
    return loginWithFirebase(input);
  }

  return loginWithLocalFallback(input);
}

export async function bootstrapCompanySession(): Promise<CompanySession | null> {
  const localSession = getStoredCompanySession();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        const remember = localSession?.remember ?? true;
        const bootstrapped = await bootstrapSupabaseCompanyState(data.session.user, remember);
        return bootstrapped?.session || localSession;
      }

      if (localSession?.provider === 'supabase') {
        clearStoredSession();
        return null;
      }
    }
  }

  return localSession;
}

export async function requestCompanyPasswordReset(email: string): Promise<{ ok: boolean; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      ok: false,
      message: 'اكتب البريد الإلكتروني المرتبط بحساب الشركة أولًا.',
    };
  }

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        message: 'تعذر تجهيز خدمة الاستعادة الآن.',
      };
    }

    const redirectTo = getCompanyAuthRedirectUrl('reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectTo || undefined,
    });

    if (error) {
      return {
        ok: false,
        message: normalizeSupabaseAuthErrorMessage(error, 'تعذر إرسال رابط الاستعادة الآن.'),
      };
    }

    return {
      ok: true,
      message: 'إذا كان البريد مسجلًا لدينا، ستصلك رسالة تحتوي على رابط آمن لتعيين كلمة مرور جديدة.',
    };
  }

  if (!hasFirebaseConfig()) {
    return {
      ok: false,
      message: 'استعادة كلمة المرور غير متاحة الآن.',
    };
  }

  const services = await getFirebaseServices();
  if (!services) {
    return {
      ok: false,
      message: 'تعذر تجهيز الخدمة الآن. حاول مرة أخرى بعد قليل.',
    };
  }

  const { auth, authModule } = services;
  const resetRedirectUrl = getCompanyAuthRedirectUrl('login');
  const actionCodeSettings = resetRedirectUrl
    ? {
        url: resetRedirectUrl,
        handleCodeInApp: false,
      }
    : undefined;

  await authModule.sendPasswordResetEmail(auth, normalizedEmail, actionCodeSettings);

  return {
    ok: true,
    message: 'إذا كان البريد مسجلًا لدينا، ستصلك رسالة رسمية تحتوي على رابط آمن لإعادة تعيين كلمة المرور.',
  };
}

export async function resetCompanyPassword(password: string): Promise<{ ok: boolean; message: string }> {
  if (String(password || '').trim().length < 8) {
    return {
      ok: false,
      message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.',
    };
  }

  if (!hasSupabaseConfig()) {
    return {
      ok: false,
      message: 'تحديث كلمة المرور غير متاح الآن.',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: 'تعذر تجهيز خدمة تحديث كلمة المرور الآن.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      ok: false,
      message: normalizeSupabaseAuthErrorMessage(error, 'تعذر تحديث كلمة المرور الآن.'),
    };
  }

  try {
    const url = new URL(window.location.href);
    url.hash = '';
    url.searchParams.set('view', 'login');
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore URL cleanup failures.
  }

  return {
    ok: true,
    message: 'تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.',
  };
}




