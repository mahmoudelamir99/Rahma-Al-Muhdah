import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getFirebaseServices, hasFirebaseConfig } from './firebase';
import { getSupabaseClient, hasSupabaseConfig } from './supabase';

export type CompanyRegistrationInput = {
  companyName: string;
  companySector: string;
  country?: string;
  companyCity: string;
  teamSize: string;
  phone: string;
  landline?: string;
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
  country?: string;
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

function normalizeEasternArabicDigits(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

function normalizePositiveIntegerString(value: string, options: { allowLegacyRange?: boolean } = {}) {
  const normalizedValue = normalizeEasternArabicDigits(String(value || '')).trim();
  if (/^[1-9]\d*$/.test(normalizedValue)) {
    return normalizedValue;
  }

  if (!options.allowLegacyRange) {
    return '';
  }

  const rangeMatch = normalizedValue.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return rangeMatch[2];
  }

  const plusMatch = normalizedValue.match(/(\d+)\s*\+$/);
  if (plusMatch) {
    return plusMatch[1];
  }

  return '';
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '1secmail.com',
  '1secmail.net',
  '1secmail.org',
  'dispostable.com',
  'dropmail.me',
  'dropmail.vip',
  'emailondeck.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamailblock.com',
  'grr.la',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mintemail.com',
  'moakt.com',
  'sharklasers.com',
  'spam4.me',
  'tempmail.email',
  'tempmail.plus',
  'temp-mail.org',
  'tempail.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  'yopmail.gq',
]);

function getEmailDomain(value: string) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const atIndex = normalizedValue.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalizedValue.length - 1) {
    return '';
  }

  return normalizedValue.slice(atIndex + 1).replace(/^\.+|\.+$/g, '');
}

function isDisposableEmailAddress(value: string) {
  const domain = getEmailDomain(value);
  if (!domain) {
    return false;
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  return Array.from(DISPOSABLE_EMAIL_DOMAINS).some((blockedDomain) => domain.endsWith(`.${blockedDomain}`));
}

function buildProfileFromRegistration(input: CompanyRegistrationInput, extras: Record<string, unknown> = {}) {
  const companyName = input.companyName.trim();
  const companySector = input.companySector.trim();
  const country = String(input.country || extras.companyCountry || '').trim();
  const companyCity = input.companyCity.trim();
  const teamSize = normalizePositiveIntegerString(input.teamSize, { allowLegacyRange: true });
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const landline = String(input.landline || extras.companyLandline || '').trim();
  const socialLinks = normalizeCompanySocialLinks(extras.socialLinks);
  const siteMode = String(extras.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full';

  return {
    role: 'company',
    accountStatus: 'pending',
    fullName: companyName,
    email,
    phone,
    companyLandline: landline,
    country,
    companyCountry: country,
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
      country,
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
      country: String((company.country || user.user_metadata?.companyCountry || '') as string).trim(),
      companyCity: company.location || company.address || '',
      teamSize: String((user.user_metadata?.teamSize as string | undefined) || '').trim(),
      phone: company.phone || '',
      landline: company.landline || '',
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

function normalizeFirebaseAuthErrorMessage(error: unknown, fallback: string) {
  const code = String((error as { code?: string })?.code || '').trim().toLowerCase();
  const message = String((error as { message?: string })?.message || '').trim().toLowerCase();

  if (
    [
      'auth/invalid-credential',
      'auth/invalid-login-credentials',
      'auth/user-not-found',
      'auth/wrong-password',
    ].includes(code) ||
    message.includes('invalid-credential') ||
    message.includes('invalid login credentials') ||
    message.includes('wrong-password') ||
    message.includes('user-not-found')
  ) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }

  if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
    return 'عذرًا، هذا البريد الإلكتروني مسجل بالفعل.';
  }

  if (code === 'auth/invalid-email' || message.includes('badly formatted')) {
    return 'البريد الإلكتروني غير صالح.';
  }

  if (code === 'auth/user-disabled') {
    return 'هذا الحساب موقوف حاليًا. تواصل مع الدعم للمراجعة.';
  }

  if (code === 'auth/too-many-requests') {
    return 'تم تجاوز عدد المحاولات المسموح. انتظر قليلًا ثم أعد المحاولة.';
  }

  if (code === 'auth/network-request-failed' || message.includes('network request failed')) {
    return 'تعذر الاتصال بالخدمة الآن. تحقق من الإنترنت ثم أعد المحاولة.';
  }

  if (code === 'permission-denied' || message.includes('missing or insufficient permissions')) {
    return 'تعذر إكمال الطلب الآن بسبب إعدادات الصلاحيات. راجع إعدادات المشروع ثم أعد المحاولة.';
  }

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

async function findSupabaseCompanyByOwnerIncludingDeleted(supabase: SupabaseClient, ownerUid: string) {
  const { data, error } = await supabase.from('companies').select('*').eq('owner_uid', ownerUid).limit(1).maybeSingle();

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
        country: String(user.user_metadata.companyCountry || '').trim(),
        companyCity: String(user.user_metadata.companyCity || '').trim(),
        teamSize: String(user.user_metadata.teamSize || '').trim(),
        phone: String(user.user_metadata.phone || '').trim(),
        landline: String(user.user_metadata.landline || '').trim(),
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
    country: String(
      profile.companyCountry ||
        (profile.companyProfile as Record<string, unknown> | undefined)?.country ||
        (existingCompany as Record<string, unknown>)?.country ||
        '',
    ).trim(),
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
    country: String(
      profile.companyCountry || (profile.companyProfile as Record<string, unknown> | undefined)?.country || '',
    ).trim(),
    phone: String(profile.phone || '').trim(),
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
    companyCountry: String(input.country || '').trim(),
    companyCity: input.companyCity.trim(),
    teamSize: normalizePositiveIntegerString(input.teamSize, { allowLegacyRange: true }),
    phone: input.phone.trim(),
    landline: String(input.landline || '').trim(),
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

  try {
    const companyRecord = await findSupabaseCompanyByOwnerIncludingDeleted(supabase, data.user.id);
    if (!companyRecord) {
      await supabase.auth.signOut();
      clearStoredSession();
      return {
        ok: false,
        message: 'هذا الحساب غير متاح حاليًا أو تمت إزالته من النظام. تواصل مع الدعم إذا كنت تحتاج مراجعة الحساب.',
      };
    }

    if (companyRecord.deleted_at) {
      await supabase.auth.signOut();
      clearStoredSession();
      return {
        ok: false,
        message: 'هذا الحساب عليه طلب حذف قيد المراجعة الآن. تواصل مع الدعم إذا كنت تحتاج استعادة الشركة.',
      };
    }
  } catch {
    await supabase.auth.signOut();
    clearStoredSession();
    return {
      ok: false,
      message: 'تعذر التحقق من حالة الشركة الآن. حاول مرة أخرى بعد قليل.',
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
  try {
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
  } catch (error) {
    return {
      ok: false,
      message: normalizeFirebaseAuthErrorMessage(error, 'تعذر إنشاء حساب الشركة الآن. حاول مرة أخرى بعد قليل.'),
    };
  }
}

async function clearFirebaseCompanySession(
  services: NonNullable<Awaited<ReturnType<typeof getFirebaseServices>>>,
) {
  try {
    await services.authModule.signOut(services.auth);
  } catch {
    // Ignore sign-out failures and still clear the local session snapshot.
  }
  clearStoredSession();
}

function buildFirebaseCompanyProfileAndSession(
  user: { uid: string; email: string | null; displayName: string | null },
  companyData: Record<string, unknown>,
  remember: boolean,
  fallbackEmail: string,
) {
  const resolvedEmail = user.email || fallbackEmail.trim().toLowerCase();
  const companyId = user.uid;
  const companyName = String(companyData.name || companyData.companyName || user.displayName || fallbackEmail.split('@')[0] || 'شركة').trim();
  const profile = buildProfileFromRegistration(
    {
      companyName,
      companySector: String(companyData.sector || companyData.companySector || '').trim(),
      country: String(companyData.country || '').trim(),
      companyCity: String(companyData.city || companyData.location || '').trim(),
      teamSize: String(companyData.teamSize || '').trim(),
      phone: String(companyData.phone || '').trim(),
      landline: String(companyData.landline || companyData.companyLandline || '').trim(),
      email: resolvedEmail,
      password: '',
      confirmPassword: '',
      remember,
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
    email: resolvedEmail,
    name: companyName,
    provider: 'firebase',
    remember,
  });

  return { profile, session };
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
  try {
    await authModule.setPersistence(
      auth,
      input.remember ? authModule.browserLocalPersistence : authModule.browserSessionPersistence,
    );

    const credential = await authModule.signInWithEmailAndPassword(auth, input.email.trim().toLowerCase(), input.password);
    const user = credential.user;
    const companyId = user.uid;
    const companySnap = await firestoreModule.getDoc(firestoreModule.doc(db, 'companies', companyId));
    if (!companySnap.exists()) {
      await clearFirebaseCompanySession(services);
      return {
        ok: false,
        message: 'هذا الحساب لم يعد متاحًا داخل النظام. ربما تم حذفه نهائيًا من لوحة الأدمن.',
      };
    }

    const companyData = companySnap.data() || {};

    if (companyData.deletedAt || String(companyData.deletedBy || '').trim() === 'company') {
      await clearFirebaseCompanySession(services);
      return {
        ok: false,
        message: 'هذا الحساب عليه طلب حذف قيد المراجعة الآن. تواصل مع الدعم إذا كنت تحتاج استعادة الشركة.',
      };
    }

    if (companyData.status && ['restricted', 'suspended', 'archived'].includes(normalize(String(companyData.status)))) {
      await clearFirebaseCompanySession(services);
      return {
        ok: false,
        message: 'هذا الحساب غير متاح حاليًا. تواصل مع الدعم إذا كنت تحتاج مراجعة الحالة.',
      };
    }

    const { profile, session } = buildFirebaseCompanyProfileAndSession(
      user,
      companyData as Record<string, unknown>,
      input.remember,
      input.email,
    );

    safeWriteSession(session, input.remember);
    persistLocalProfile(profile);

    return {
      ok: true,
      message: 'تم تسجيل الدخول بنجاح.',
      session,
    };
  } catch (error) {
    await clearFirebaseCompanySession(services);
    return {
      ok: false,
      message: normalizeFirebaseAuthErrorMessage(error, 'تعذر تسجيل الدخول الآن. حاول مرة أخرى بعد قليل.'),
    };
  }
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

  const normalizedEmail = input.email.trim().toLowerCase();
  if (isDisposableEmailAddress(normalizedEmail)) {
    return {
      ok: false,
      message: 'استخدم بريدًا إلكترونيًا رسميًا للشركة. الإيميلات المؤقتة أو الوهمية غير مسموح بها.',
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

  const normalizedTeamSize = normalizePositiveIntegerString(input.teamSize, { allowLegacyRange: true });
  if (!normalizedTeamSize) {
    return {
      ok: false,
      message: 'اكتب حجم الفريق كرقم صحيح أكبر من صفر.',
    };
  }

  const normalizedInput = {
    ...input,
    email: normalizedEmail,
    teamSize: normalizedTeamSize,
  };

  if (hasSupabaseConfig()) {
    return registerWithSupabase(normalizedInput);
  }

  if (hasFirebaseConfig()) {
    return registerWithFirebase(normalizedInput);
  }

  return registerWithLocalFallback(normalizedInput);
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
        let companyRecord: SupabaseCompanyRow | null = null;
        try {
          companyRecord = await findSupabaseCompanyByOwnerIncludingDeleted(supabase, data.session.user.id);
        } catch {
          clearStoredSession();
          await supabase.auth.signOut();
          return null;
        }

        const normalizedStatus = normalize(String(companyRecord?.status || ''));
        if (!companyRecord || companyRecord.deleted_at || ['restricted', 'archived'].includes(normalizedStatus)) {
          clearStoredSession();
          await supabase.auth.signOut();
          return null;
        }

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

  if (hasFirebaseConfig()) {
    const services = await getFirebaseServices();
    if (services) {
      const authStateReady = (
        services.auth as typeof services.auth & { authStateReady?: () => Promise<void> }
      ).authStateReady;

      if (typeof authStateReady === 'function') {
        try {
          await authStateReady.call(services.auth);
        } catch {
          // Ignore auth-state readiness failures and fall back to the current auth snapshot.
        }
      }

      const firebaseUser = services.auth.currentUser;
      if (localSession?.provider === 'firebase' || firebaseUser) {
        if (!firebaseUser) {
          clearStoredSession();
          return null;
        }

        try {
          const companySnap = await services.firestoreModule.getDoc(
            services.firestoreModule.doc(services.db, 'companies', firebaseUser.uid),
          );

          if (!companySnap.exists()) {
            await clearFirebaseCompanySession(services);
            return null;
          }

          const companyData = companySnap.data() || {};
          const normalizedStatus = normalize(String(companyData.status || ''));
          if (
            companyData.deletedAt ||
            String(companyData.deletedBy || '').trim() === 'company' ||
            ['restricted', 'suspended', 'archived'].includes(normalizedStatus)
          ) {
            await clearFirebaseCompanySession(services);
            return null;
          }

          const remember = localSession?.remember ?? true;
          const { profile, session } = buildFirebaseCompanyProfileAndSession(
            firebaseUser,
            companyData as Record<string, unknown>,
            remember,
            firebaseUser.email || localSession?.email || '',
          );

          safeWriteSession(session, remember);
          persistLocalProfile(profile);
          return session;
        } catch {
          await clearFirebaseCompanySession(services);
          return null;
        }
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




