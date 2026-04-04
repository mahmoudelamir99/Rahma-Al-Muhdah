import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_FAQ_ITEMS,
  DEFAULT_NOTIFICATION_TEMPLATES,
  DEFAULT_ROLE_TEMPLATES,
  PERMISSION_CATALOG,
  SITE_METADATA,
  STATIC_SITE_COMPANIES,
  STATIC_SITE_JOBS,
} from './admin-data';
import { getFirebaseServices, hasFirebaseConfig } from './firebase';

const STORAGE_KEYS = {
  state: 'rahmaAdminControlCenter.v1',
  session: 'rahmaAdminSession.v1',
  publicRuntime: 'rahmaAdminPublicRuntime.v1',
  siteProfile: 'rahmaApplicationProfile',
  siteApplications: 'rahmaJobApplications',
  siteSession: 'rahmaAuthSession',
  loginAttempts: 'rahmaAdminLoginAttempts.v1',
} as const;
const SHARED_RUNTIME_SYNC_PATH = '/__runtime-sync__/public-runtime';
const SHARED_RUNTIME_POLL_INTERVAL_MS = 2500;

function isPrivateRuntimeSyncHost(hostname = '') {
  const normalizedHost = String(hostname || '').trim().toLowerCase();
  if (!normalizedHost) return false;
  if (normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::1') {
    return true;
  }
  if (/^10\./.test(normalizedHost)) return true;
  if (/^192\.168\./.test(normalizedHost)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalizedHost)) return true;
  return false;
}

const KNOWN_PERMISSION_KEYS = new Set<string>(PERMISSION_CATALOG.map((permission) => permission.key));

const LEGACY_ROLE_ID_MAP = new Map<string, string>([
  ['review-manager', 'platform-operator'],
  ['support-operator', 'support-manager'],
]);

const LEGACY_PERMISSION_ALIAS_MAP: Record<string, string[]> = {
  'users:delete': ['users:archive'],
  'companies:moderate': ['companies:review', 'companies:approve'],
  'jobs:moderate': ['jobs:edit', 'jobs:publish'],
  'messages:view': ['support:view'],
  'messages:assign': ['support:assign'],
  'settings:edit': ['settings:view', 'settings:edit'],
  'security:view': ['roles:view'],
  'security:roles': ['roles:manage'],
};

const DEFAULT_HOME_HERO_TITLE = 'وظائف واضحة وتقديم مباشر ومتابعة للطلبات.';
const DEFAULT_HOME_HERO_SUBTITLE = 'اعرض الوظائف المنشورة فعليًا، قدّم مباشرة، واحتفظ برقم الطلب للمتابعة.';
const LEGACY_HOME_HERO_TITLES = new Set([
  'منصة الرحمة المهداه للوظائف',
  'منصة الرحمة المهداة للوظائف',
  'الرحمة المهداة للوظائف',
  'الرحمة المهداه للوظائف',
  'الرحمة المهداه للتوظيف',
]);
const LEGACY_HOME_HERO_SUBTITLES = new Set([
  'لوحة تحكم تنفيذية لإدارة المستخدمين والشركات والوظائف والتقارير من مكان واحد.',
]);

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LOCK_MS = 10 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const FIREBASE_PASSWORD_SENTINEL = 'firebase-managed';
const LEGACY_BOOTSTRAP_ADMIN_IDS = new Set(['admin-root', 'admin-bootstrap-super', 'admin-alrahma-primary']);
const LEGACY_BOOTSTRAP_ADMIN_FINGERPRINTS = new Set([
  '16b2705080884526914c9eed5e10f23c::458502b7274698cb6358e6446b4d5acbd73d9f2df6cd9d9f0bbbef7451e7a056::0a820f16066f8d2d9ed63c284c07cf192478d8f12a7cdb0b2c089b29cdc220f5',
  '7e2f9b5b8f4c3d1a6e7f8a9b0c1d2e3f::ed0f8daaa6ebe2580993c31fe566272c666eab74cc259c6c692ddfacd9e5830e::b9a4cc4ac4c2735cdce2074c49b96eb16ebb1305e2049c3fbc1316d870eada3a',
]);
const hashLegacySeedKey = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};
const normalizeLooseArabic = (value: string | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\u064b-\u065f]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const LEGACY_DEMO_APPLICANT_SIGNATURE_HASHES = new Set(['8f42223b', 'b54f11e7']);
const buildApplicantSignatureHash = (values: Array<string | null | undefined>) =>
  hashLegacySeedKey(values.map((value) => normalizeLooseArabic(value)).join('||'));
const LEGACY_STATIC_COMPANY_IDS = new Set([
  'company-fawry',
  'company-cib',
  'company-we',
  'company-elsewedy',
  'company-----------tiba-store',
  'company-creative-trips',
  'company-sync-test-001',
]);
const LEGACY_STATIC_COMPANY_NAME_HASHES = new Set([
  '7c80afc1',
  '255be1a1',
  '08dc6391',
  '23d6c4d6',
  'c658c64f',
  '9171906e',
  '2b519cae',
  'f0439cdc',
  '4a00589d',
]);
const LEGACY_TEST_COMPANY_NAMES = new Set(
  [
    'شركة اختبار موبايل',
    'شركة الاختبار الآلي',
    'شركة الاختبار لي',
    'شركة النور للتجارة',
    'شركة البيان',
    'طيبة ستور Tiba Store',
    'Creative trips',
    '\u0634\u0631\u0643\u0629 \u062a\u062c\u0631\u064a\u0628\u064a\u0629',
  ].map(
    (value) => normalizeLooseArabic(value),
  ),
);
const LEGACY_STATIC_JOB_IDS = new Set([
  'job-fawry-senior-software-engineer',
  'job-edita-digital-marketing-manager',
  'job-cleopatra-hr-specialist',
  'job-raya-ui-ux-designer',
  'job-efinance-business-analyst',
  'job-orange-customer-support',
  'job-sync-test-001',
]);
const LEGACY_STATIC_JOB_KEY_HASHES = new Set([
  '42b16ec6',
  '75b5c676',
  '130b3432',
  '1db068d2',
  'abbf9801',
  '56921ba4',
]);

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];

export type NoteRecord = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
};

export type RoleDefinition = {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  permissions: string[];
};

export type AdminAccount = {
  id: string;
  displayName: string;
  roleId: string;
  status: 'active' | 'suspended';
  authProvider?: 'local' | 'firebase';
  email?: string;
  firebaseUid?: string | null;
  salt: string;
  emailHash: string;
  passwordHash: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export type PlatformUser = {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  city: string;
  role: 'applicant' | 'company' | 'admin';
  companyName: string;
  status: 'active' | 'suspended' | 'banned' | 'archived';
  verified: boolean;
  lastActivityAt: string;
  openSessions: number;
  devices: string[];
  notes: NoteRecord[];
  deletedAt: string | null;
};

export type CompanySocialLinks = {
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
};

export type CompanyRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  landline: string;
  address: string;
  sector: string;
  location: string;
  openings: number;
  summary: string;
  logoLetter: string;
  website: string;
  socialLinks: CompanySocialLinks;
  siteMode: 'full' | 'landing';
  restrictionMessage: string;
  restrictionAttachmentUrl: string | null;
  restrictionAttachmentName: string;
  imageUrl?: string | null;
  status: 'approved' | 'pending' | 'restricted' | 'archived';
  verified: boolean;
  notes: NoteRecord[];
  deletedBy: 'admin' | null;
  deletedStatusSnapshot: 'approved' | 'pending' | 'restricted' | 'archived' | null;
  deletedAt: string | null;
};

export type CompanyDraft = {
  name: string;
  email: string;
  phone: string;
  landline: string;
  address: string;
  sector: string;
  location: string;
  summary: string;
  website: string;
  socialLinks: CompanySocialLinks;
  siteMode: CompanyRecord['siteMode'];
  restrictionMessage: string;
  restrictionAttachmentUrl?: string | null;
  restrictionAttachmentName?: string;
  imageUrl?: string | null;
  status?: CompanyRecord['status'];
  verified?: boolean;
};

export type JobRecord = {
  id: string;
  title: string;
  companyName: string;
  location: string;
  type: string;
  postedLabel: string;
  salary: string;
  summary: string;
  sector: string;
  applicationEnabled: boolean;
  featured: boolean;
  status: 'approved' | 'pending' | 'hidden' | 'archived' | 'rejected';
  applicantsCount: number;
  notes: NoteRecord[];
  deletedBy: 'admin' | 'company' | null;
  deletedStatusSnapshot: 'approved' | 'pending' | 'hidden' | 'archived' | 'rejected' | null;
  restoredByAdminAt: string | null;
  deletedAt: string | null;
};

export type JobDraft = {
  title: string;
  companyName: string;
  location: string;
  type: string;
  salary: string;
  summary: string;
  sector: string;
  applicationEnabled?: boolean;
  postedLabel?: string;
  status?: JobRecord['status'];
  featured?: boolean;
};

export type ApplicationRecord = {
  id: string;
  requestId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  address: string;
  governorate: string;
  city: string;
  experience: string;
  experienceYears: string;
  expectedSalary: string;
  educationLevel: string;
  specialization: string;
  militaryStatus: string;
  publicServiceCompleted: string;
  maritalStatus: string;
  coverLetter: string;
  cvFileName: string;
  cvFileType: string;
  jobTitle: string;
  companyName: string;
  status: 'pending' | 'review' | 'interview' | 'approved' | 'accepted' | 'rejected' | 'hired';
  rejectionReason: string;
  companyTag: string;
  interviewScheduledAt: string | null;
  interviewMode: string;
  interviewLocation: string;
  submittedAt: string;
  respondedAt: string | null;
  forwardedTo: string;
  notes: NoteRecord[];
  deletedAt: string | null;
};

export type MessageThread = {
  id: string;
  applicationId: string;
  title: string;
  participantName: string;
  participantRole: string;
  companyName: string;
  status: 'open' | 'closed' | 'flagged';
  unreadCount: number;
  assignedAdminId: string | null;
  internalNotes: NoteRecord[];
  lastMessageAt: string;
};

export type NotificationTemplate = {
  id: string;
  name: string;
  audience: string;
  subject: string;
  body: string;
};

export type SentNotification = {
  id: string;
  audience: string;
  subject: string;
  body: string;
  sentAt: string;
};

export type SystemSettings = {
  userRegistration: boolean;
  companyRegistration: boolean;
  jobApplications: boolean;
  fileUploads: boolean;
  maintenanceMode: boolean;
  maintenanceReason: string;
  maintenanceUntil: string;
  maxFileSizeMb: number;
  allowedFileTypes: string[];
  systemMessage: string;
};

export type FaqCategory = 'account' | 'companies' | 'support';

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

export type ContentState = {
  heroTitle: string;
  heroSubtitle: string;
  siteAnnouncement: string;
  faqHeroTitle: string;
  faqHeroSubtitle: string;
  faqIntroText: string;
  faqAccountTitle: string;
  faqAccountDescription: string;
  faqCompaniesTitle: string;
  faqCompaniesDescription: string;
  faqSupportTitle: string;
  faqSupportDescription: string;
  faqItems: FaqItem[];
  aboutHeroTitle: string;
  aboutHeroSubtitle: string;
  aboutOverviewTitle: string;
  aboutOverviewText: string;
  aboutProcessTitle: string;
  aboutProcessText: string;
  aboutCTAHeading: string;
  aboutCTAText: string;
  contactHeroTitle: string;
  contactHeroSubtitle: string;
  contactIntroText: string;
  contactPhone: string;
  contactEmail: string;
  contactLocation: string;
  contactHours: string;
  privacyHeroTitle: string;
  privacyHeroSubtitle: string;
  privacyIntroText: string;
  termsHeroTitle: string;
  termsHeroSubtitle: string;
  termsIntroText: string;
};

export type AuditLog = {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityLabel: string;
  details: string;
  createdAt: string;
  severity: 'info' | 'warning' | 'success' | 'danger';
};

export type AdminSession = {
  adminId: string;
  displayName: string;
  identifier?: string;
  roleId: string;
  provider?: 'local' | 'firebase';
  firebaseUid?: string | null;
  expiresAt: string;
  remember: boolean;
};

export type AdminState = {
  version: number;
  admins: AdminAccount[];
  roles: RoleDefinition[];
  users: PlatformUser[];
  companies: CompanyRecord[];
  jobs: JobRecord[];
  applications: ApplicationRecord[];
  messages: MessageThread[];
  settings: SystemSettings;
  content: ContentState;
  notificationTemplates: NotificationTemplate[];
  sentNotifications: SentNotification[];
  auditLogs: AuditLog[];
  widgetPreferences: string[];
};

type AdminContextValue = {
  state: AdminState;
  session: AdminSession | null;
  currentAdmin: AdminAccount | null;
  currentRole: RoleDefinition | null;
  isAuthenticated: boolean;
  isSetupRequired: boolean;
  login: (identifier: string, password: string, remember: boolean) => Promise<{ ok: true } | { ok: false; message: string }>;
  setupPrimaryAdmin: (name: string, email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => void;
  refreshFromSite: () => void;
  hasPermission: (permission: string) => boolean;
  updateUserStatus: (userId: string, status: PlatformUser['status']) => void;
  updateUserRole: (userId: string, role: PlatformUser['role']) => void;
  toggleUserVerified: (userId: string) => void;
  softDeleteUser: (userId: string) => void;
  restoreUser: (userId: string) => void;
  updateCompanyStatus: (companyId: string, status: CompanyRecord['status']) => void;
  toggleCompanyVerified: (companyId: string) => void;
  softDeleteCompany: (companyId: string) => void;
  restoreCompany: (companyId: string) => void;
  saveCompany: (draft: CompanyDraft, companyId?: string | null) => string | null;
  updateJobStatus: (jobId: string, status: JobRecord['status']) => void;
  toggleJobFeatured: (jobId: string) => void;
  softDeleteJob: (jobId: string) => void;
  restoreJob: (jobId: string) => void;
  saveJob: (draft: JobDraft, jobId?: string | null) => string | null;
  updateApplicationStatus: (applicationId: string, status: ApplicationRecord['status'], rejectionReason?: string) => void;
  forwardApplication: (applicationId: string, companyName: string) => void;
  addNote: (entityType: 'users' | 'companies' | 'jobs' | 'applications' | 'messages', entityId: string, body: string) => void;
  updateSettings: (patch: Partial<SystemSettings>) => void;
  updateContent: (patch: Partial<ContentState>) => void;
  createRole: (name: string, description: string) => void;
  toggleRolePermission: (roleId: string, permission: string) => void;
  createAdminAccount: (
    name: string,
    email: string,
    password: string,
    roleId: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  updateAdminStatus: (adminId: string, status: AdminAccount['status']) => void;
  updateAdminRole: (adminId: string, roleId: string) => void;
  updateCurrentAdminProfile: (patch: {
    displayName: string;
    email: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  assignThread: (threadId: string, adminId: string | null) => void;
  updateThreadStatus: (threadId: string, status: MessageThread['status']) => void;
  sendNotification: (audience: string, subject: string, body: string) => void;
  saveWidgetPreferences: (ids: string[]) => void;
  exportApplicationsCsv: () => void;
  exportAuditCsv: () => void;
  searchEverywhere: (query: string) => Array<{ id: string; label: string; meta: string; path: string }>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

const LEGACY_MOJIBAKE_PATTERN =
  /[\u00a1-\u00bf\u0192\u0152\u0153\u0161\u0178\u017e\u02c6\u200c\u201a\u201e\u2020\u2021\u2026\u2030\u2039\u203a\u06af\u06ba\u06be\u0679\u067e\u0686\u0691]/;
const LEGACY_MOJIBAKE_FRAGMENT_PATTERN =
  /(?:(?:\u0637\u00b7|\u0637\u00b8)[\u0600-\u06ff]){2,}|[\u00a1-\u00bf\u0192\u0152\u0153\u0161\u0178\u017e\u02c6\u200c\u201a\u201e\u2020\u2021\u2026\u2030\u2039\u203a]{2,}/g;
let cp1256EncodingMap: Map<string, number> | null = null;

function countLegacyMojibakeChars(value: unknown) {
  return Array.from(String(value ?? '')).reduce(
    (total, character) => total + Number(LEGACY_MOJIBAKE_PATTERN.test(character)),
    0,
  );
}

function countLegacyMojibakePairs(value: unknown) {
  return (
    String(value ?? '').match(
      /(?:\u0637\u00b7[\u0637\u00a7\u0637\u00a3\u0637\u00a5\u0637\u00a2\u0637\u060c-\u0638\u0679]|\u0637\u00b8[\u0637\u00a7\u0637\u00a3\u0637\u00a5\u0637\u00a2\u0637\u060c-\u0638\u0679])/g,
    ) || []
  ).length;
}

function getLegacySignalScore(value: unknown) {
  return countLegacyMojibakeChars(value) * 3 + countLegacyMojibakePairs(value);
}

function shouldAttemptLegacyDecode(value: unknown) {
  const rawValue = String(value ?? '');
  return LEGACY_MOJIBAKE_PATTERN.test(rawValue) || countLegacyMojibakePairs(rawValue) >= 2;
}

function getCp1256EncodingMap() {
  if (cp1256EncodingMap) return cp1256EncodingMap;

  try {
    const decoder = new TextDecoder('windows-1256', { fatal: false });
    const nextMap = new Map<string, number>();

    for (let byte = 0; byte <= 255; byte += 1) {
      const character = decoder.decode(new Uint8Array([byte]));
      if (character && character !== '\uFFFD' && !nextMap.has(character)) {
        nextMap.set(character, byte);
      }
    }

    cp1256EncodingMap = nextMap;
  } catch {
    cp1256EncodingMap = new Map();
  }

  return cp1256EncodingMap;
}

function decodeLegacyMojibakeCandidate(value: string, encoderMap: Map<string, number>) {
  if (!shouldAttemptLegacyDecode(value) || !encoderMap.size) return value;

  const bytes: number[] = [];

  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
      continue;
    }

    const mappedByte = encoderMap.get(character);
    if (mappedByte === undefined) {
      return value;
    }
    bytes.push(mappedByte);
  }

  try {
    const fixedValue = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    return getLegacySignalScore(fixedValue) < getLegacySignalScore(value) ? fixedValue : value;
  } catch {
    return value;
  }
}

function repairLegacyMojibakeText(value: string) {
  if (!shouldAttemptLegacyDecode(value)) return value;

  const encoderMap = getCp1256EncodingMap();
  if (!encoderMap.size) return value;

  const repairLegacyMojibakeFragments = (text: string) =>
    text.replace(LEGACY_MOJIBAKE_FRAGMENT_PATTERN, (fragment) => decodeLegacyMojibakeCandidate(fragment, encoderMap));

  let bestValue = value;
  let bestScore = getLegacySignalScore(value);

  const considerCandidate = (candidate: string) => {
    if (!candidate || candidate === bestValue) return;

    const candidateScore = getLegacySignalScore(candidate);
    if (candidateScore < bestScore) {
      bestValue = candidate;
      bestScore = candidateScore;
    }
  };

  considerCandidate(decodeLegacyMojibakeCandidate(value, encoderMap));

  considerCandidate(
    value
      .split(/(\s+)/)
      .map((segment) => (/^\s+$/.test(segment) ? segment : decodeLegacyMojibakeCandidate(segment, encoderMap)))
      .join(''),
  );

  considerCandidate(repairLegacyMojibakeFragments(value));

  let previousValue = '';
  while (bestValue !== previousValue) {
    previousValue = bestValue;

    considerCandidate(
      bestValue
        .split(/(\s+)/)
        .map((segment) => (/^\s+$/.test(segment) ? segment : decodeLegacyMojibakeCandidate(segment, encoderMap)))
        .join(''),
    );

    considerCandidate(repairLegacyMojibakeFragments(bestValue));
  }

  return bestValue;
}

function repairLegacyStoredValue<T>(value: T): { value: T; changed: boolean } {
  if (typeof value === 'string') {
    const nextValue = repairLegacyMojibakeText(value) as T;
    return {
      value: nextValue,
      changed: nextValue !== value,
    };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const nextValue = value.map((entry) => {
      const repaired = repairLegacyStoredValue(entry);
      if (repaired.changed) changed = true;
      return repaired.value;
    }) as T;
    return { value: nextValue, changed };
  }

  if (value && typeof value === 'object') {
    let changed = false;
    const nextValue = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        const repaired = repairLegacyStoredValue(entry);
        if (repaired.changed) changed = true;
        return [key, repaired.value];
      }),
    ) as T;
    return { value: nextValue, changed };
  }

  return { value, changed: false };
}

const repairAdminUiValue = <T,>(value: T): T => repairLegacyStoredValue(value).value;

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as T;
    const repaired = repairLegacyStoredValue(parsed);

    if (repaired.changed) {
      window.localStorage.setItem(key, JSON.stringify(repaired.value));
    }

    return repaired.value;
  } catch {
    return fallback;
  }
}

function safeReadSession<T>(key: string, fallback: T): T {
  try {
    const sessionRaw = window.sessionStorage.getItem(key);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw) as T;
      const repaired = repairLegacyStoredValue(parsed);
      if (repaired.changed) {
        window.sessionStorage.setItem(key, JSON.stringify(repaired.value));
      }
      return repaired.value;
    }
    const localRaw = window.localStorage.getItem(key);
    if (!localRaw) return fallback;

    const parsed = JSON.parse(localRaw) as T;
    const repaired = repairLegacyStoredValue(parsed);
    if (repaired.changed) {
      window.localStorage.setItem(key, JSON.stringify(repaired.value));
    }
    return repaired.value;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(repairLegacyStoredValue(value).value));
}

function saveSession(session: AdminSession | null) {
  if (!session) {
    window.sessionStorage.removeItem(STORAGE_KEYS.session);
    window.localStorage.removeItem(STORAGE_KEYS.session);
    return;
  }

  const target = session.remember ? window.localStorage : window.sessionStorage;
  const alternate = session.remember ? window.sessionStorage : window.localStorage;
  alternate.removeItem(STORAGE_KEYS.session);
  target.setItem(STORAGE_KEYS.session, JSON.stringify(session));
}

function normalize(value: string | null | undefined) {
  return repairLegacyMojibakeText(value || '').trim().toLowerCase();
}

function isLegacyStaticCompanyRecord(company: Partial<CompanyRecord> | { id?: unknown; name?: unknown } | null | undefined) {
  const id = normalize(String(company?.id || ''));
  const normalizedName = normalize(String(company?.name || ''));
  const nameHash = hashLegacySeedKey(normalizedName);
  const looksLikeDemoCompany = normalizedName.includes('اختبار') && /\d{6,}/.test(normalizedName);

  return (
    LEGACY_STATIC_COMPANY_IDS.has(id) ||
    LEGACY_STATIC_COMPANY_NAME_HASHES.has(nameHash) ||
    LEGACY_TEST_COMPANY_NAMES.has(normalizedName) ||
    looksLikeDemoCompany
  );
}

function isLegacyStaticJobRecord(
  job:
    | Partial<JobRecord>
    | {
        id?: unknown;
        title?: unknown;
        companyName?: unknown;
      }
    | null
    | undefined,
) {
  const id = normalize(String(job?.id || ''));
  const keyHash = hashLegacySeedKey(
    `${normalize(String(job?.title || ''))}::${normalize(String(job?.companyName || ''))}`,
  );
  return (
    LEGACY_STATIC_JOB_IDS.has(id) ||
    LEGACY_STATIC_JOB_KEY_HASHES.has(keyHash) ||
    isLegacyStaticCompanyRecord({ name: String(job?.companyName || '') })
  );
}

function isLegacyStaticApplicationRecord(
  application:
    | Partial<ApplicationRecord>
    | {
        requestId?: unknown;
        id?: unknown;
        jobTitle?: unknown;
        companyName?: unknown;
      }
    | null
    | undefined,
) {
  return isLegacyStaticJobRecord({
    id: String(application?.requestId || application?.id || ''),
    title: String(application?.jobTitle || ''),
    companyName: String(application?.companyName || ''),
  });
}

function isLegacyDemoApplicantPayload(
  payload:
    | {
        fullName?: unknown;
        phone?: unknown;
        address?: unknown;
        city?: unknown;
        governorate?: unknown;
      }
    | null
    | undefined,
) {
  const compactHash = buildApplicantSignatureHash([
    String(payload?.fullName || ''),
    String(payload?.phone || ''),
    String(payload?.city || ''),
    String(payload?.governorate || ''),
  ]);
  const extendedHash = buildApplicantSignatureHash([
    String(payload?.fullName || ''),
    String(payload?.phone || ''),
    String(payload?.address || ''),
    String(payload?.city || ''),
    String(payload?.governorate || ''),
  ]);

  return (
    LEGACY_DEMO_APPLICANT_SIGNATURE_HASHES.has(compactHash) ||
    LEGACY_DEMO_APPLICANT_SIGNATURE_HASHES.has(extendedHash)
  );
}

function clearApplicantDraftFields<T extends Record<string, unknown>>(profile: T): T {
  return {
    ...profile,
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    governorate: '',
    experience: '',
    cvFileMeta: null,
  };
}

function clearApplicantSeekerFields<T extends Record<string, unknown>>(profile: T): T {
  return {
    ...profile,
    desiredRole: '',
    desiredCity: '',
    experienceYears: '',
    educationLevel: '',
    specialization: '',
    militaryStatus: '',
    publicServiceCompleted: '',
    maritalStatus: '',
    expectedSalary: '',
    address: '',
    governorate: '',
    resumeFileMeta: null,
  };
}

function sanitizeSiteProfile(profile: Record<string, unknown> | null | undefined): {
  changed: boolean;
  profile: Record<string, unknown>;
} {
  if (!profile || typeof profile !== 'object') {
    return { changed: false, profile: {} };
  }

  const isCompanyAccount = normalize(String(profile.role || '')) === 'company';
  const draftProfile =
    isCompanyAccount && profile.applicationDraft && typeof profile.applicationDraft === 'object'
      ? (profile.applicationDraft as Record<string, unknown>)
      : profile;
  const seekerProfile =
    draftProfile.seekerProfile && typeof draftProfile.seekerProfile === 'object'
      ? (draftProfile.seekerProfile as Record<string, unknown>)
      : !isCompanyAccount && profile.seekerProfile && typeof profile.seekerProfile === 'object'
        ? (profile.seekerProfile as Record<string, unknown>)
        : {};

  if (isCompanyAccount) {
    const hasCompanyApplicationDraft =
      Boolean(String(draftProfile.fullName || '').trim()) ||
      Boolean(String(draftProfile.phone || '').trim()) ||
      Boolean(String(draftProfile.address || '').trim()) ||
      Boolean(String(draftProfile.city || '').trim()) ||
      Boolean(String(draftProfile.governorate || '').trim()) ||
      Object.values(seekerProfile).some((value) => Boolean(String(value || '').trim()));

    if (!hasCompanyApplicationDraft) {
      return { changed: false, profile };
    }

    return {
      changed: true,
      profile: {
        ...profile,
        applicationDraft: {
          ...clearApplicantDraftFields(draftProfile),
          seekerProfile: clearApplicantSeekerFields(seekerProfile),
        },
      },
    };
  }

  if (!isLegacyDemoApplicantPayload(draftProfile)) {
    return { changed: false, profile };
  }

  return {
    changed: true,
    profile: {
      ...clearApplicantDraftFields(profile),
      seekerProfile: clearApplicantSeekerFields(seekerProfile),
    },
  };
}

function sanitizePersistedState(state: AdminState): AdminState {
  const applications = dedupeApplications(
    state.applications.filter((application) => !isLegacyStaticApplicationRecord(application)).map(normalizeApplicationRecordData),
  ).filter(isMeaningfulApplicationRecord);
  const jobs = dedupeJobs(state.jobs.filter((job) => !isLegacyStaticJobRecord(job)).map(normalizeJobRecordData)).filter(isMeaningfulJobRecord);
  const relatedCompanyNames = new Set(
    [...jobs.map((job) => job.companyName), ...applications.map((application) => application.companyName)]
      .map((value) => normalize(value))
      .filter(Boolean),
  );
  const companies = dedupeCompanies(
    state.companies.filter((company) => !isLegacyStaticCompanyRecord(company)).map(normalizeCompanyRecordData),
  ).filter((company) => isMeaningfulCompanyRecord(company, relatedCompanyNames));
  const validApplicationIds = new Set(applications.map((application) => application.id));
  const messages = state.messages.filter(
    (thread) =>
      validApplicationIds.has(thread.applicationId) && !isLegacyStaticCompanyRecord({ name: thread.companyName }),
  );
  const roles = state.roles.map((role) => normalizeRoleDefinition(role));
  const roleIds = new Set(roles.map((role) => role.id));
  const admins = ensureDefaultAdminAccounts(state.admins.map((admin) => normalizeAdminAccount(admin, roleIds)));

  return {
    ...state,
    companies,
    jobs,
    applications,
    messages,
    roles,
    admins,
    settings: {
      ...baseSettings(),
      ...state.settings,
    },
  };
}

function normalizePermissionList(permissions: string[]) {
  const nextPermissions = new Set<string>();

  permissions.forEach((permission) => {
    const aliases = LEGACY_PERMISSION_ALIAS_MAP[permission] || [permission];
    aliases.forEach((alias) => {
      if (KNOWN_PERMISSION_KEYS.has(alias)) {
        nextPermissions.add(alias);
      }
    });
  });

  return Array.from(nextPermissions);
}

function normalizeRoleDefinition(role: RoleDefinition): RoleDefinition {
  const nextId = LEGACY_ROLE_ID_MAP.get(role.id) || role.id;
  const template = DEFAULT_ROLE_TEMPLATES.find((entry) => entry.id === nextId);
  const nextPermissions = normalizePermissionList(role.permissions);

  return {
    ...role,
    id: nextId,
    name: template?.name || role.name,
    description: template?.description || role.description,
    locked: template?.locked ?? Boolean(role.locked),
    permissions: template?.locked
      ? normalizePermissionList(template.permissions)
      : nextPermissions.length
        ? nextPermissions
        : normalizePermissionList(template?.permissions || []),
  };
}

function normalizeAdminAccount(admin: AdminAccount, roleIds: Set<string>): AdminAccount {
  const nextRoleId = LEGACY_ROLE_ID_MAP.get(admin.roleId) || admin.roleId;
  return {
    ...admin,
    roleId: roleIds.has(nextRoleId) ? nextRoleId : 'super-admin',
  };
}

function normalizeCompanyRecordData(company: CompanyRecord): CompanyRecord {
  return {
    ...company,
    email: String(company.email || '').trim(),
    phone: String(company.phone || '').trim(),
    address: String(company.address || '').trim(),
    sector: String(company.sector || '').trim(),
    location: String(company.location || '').trim(),
    summary: String(company.summary || '').trim(),
    imageUrl: String(company.imageUrl || '').trim() || null,
    logoLetter: String(company.logoLetter || pickInitial(company.name || 'ش')),
    openings: Number(company.openings || 0),
    verified: Boolean(company.verified),
    notes: Array.isArray(company.notes) ? company.notes : [],
    deletedBy: company.deletedBy === 'admin' ? 'admin' : null,
    deletedStatusSnapshot:
      company.deletedStatusSnapshot === 'approved' ||
      company.deletedStatusSnapshot === 'pending' ||
      company.deletedStatusSnapshot === 'restricted' ||
      company.deletedStatusSnapshot === 'archived'
        ? company.deletedStatusSnapshot
        : null,
    deletedAt: company.deletedAt || null,
  };
}

function normalizeJobRecordData(job: JobRecord): JobRecord {
  return {
    ...job,
    title: String(job.title || '').trim(),
    companyName: String(job.companyName || '').trim(),
    location: String(job.location || '').trim(),
    type: String(job.type || '').trim(),
    postedLabel: String(job.postedLabel || '').trim(),
    salary: String(job.salary || '').trim(),
    summary: String(job.summary || '').trim(),
    sector: String(job.sector || '').trim(),
    applicationEnabled: job.applicationEnabled !== false,
    featured: Boolean(job.featured),
    applicantsCount: Number(job.applicantsCount || 0),
    notes: Array.isArray(job.notes) ? job.notes : [],
    deletedBy: job.deletedBy === 'company' || job.deletedBy === 'admin' ? job.deletedBy : null,
    deletedStatusSnapshot:
      job.deletedStatusSnapshot === 'approved' ||
      job.deletedStatusSnapshot === 'pending' ||
      job.deletedStatusSnapshot === 'hidden' ||
      job.deletedStatusSnapshot === 'archived' ||
      job.deletedStatusSnapshot === 'rejected'
        ? job.deletedStatusSnapshot
        : null,
    restoredByAdminAt: job.restoredByAdminAt ? String(job.restoredByAdminAt) : null,
    deletedAt: job.deletedAt || null,
  };
}

function normalizeApplicationRecordData(application: ApplicationRecord): ApplicationRecord {
  return {
    ...application,
    id: String(application.id || application.requestId || '').trim(),
    requestId: String(application.requestId || application.id || '').trim(),
    applicantName: String(application.applicantName || '').trim(),
    applicantEmail: String(application.applicantEmail || '').trim(),
    applicantPhone: String(application.applicantPhone || '').trim(),
    address: String(application.address || '').trim(),
    governorate: String(application.governorate || '').trim(),
    city: String(application.city || '').trim(),
    experience: String(application.experience || '').trim(),
    experienceYears: String(application.experienceYears || '').trim(),
    expectedSalary: String(application.expectedSalary || '').trim(),
    educationLevel: String(application.educationLevel || '').trim(),
    specialization: String(application.specialization || '').trim(),
    militaryStatus: String(application.militaryStatus || '').trim(),
    publicServiceCompleted: String(application.publicServiceCompleted || '').trim(),
    maritalStatus: String(application.maritalStatus || '').trim(),
    coverLetter: String(application.coverLetter || '').trim(),
    cvFileName: String(application.cvFileName || '').trim(),
    cvFileType: String(application.cvFileType || '').trim(),
    jobTitle: String(application.jobTitle || '').trim(),
    companyName: String(application.companyName || '').trim(),
    rejectionReason: String(application.rejectionReason || '').trim(),
    companyTag: String(application.companyTag || '').trim(),
    interviewScheduledAt: application.interviewScheduledAt ? String(application.interviewScheduledAt).trim() : null,
    interviewMode: String(application.interviewMode || '').trim(),
    interviewLocation: String(application.interviewLocation || '').trim(),
    submittedAt: String(application.submittedAt || new Date().toISOString()).trim(),
    respondedAt: application.respondedAt ? String(application.respondedAt).trim() : null,
    forwardedTo: String(application.forwardedTo || '').trim(),
    notes: Array.isArray(application.notes) ? application.notes : [],
    deletedAt: application.deletedAt || null,
  };
}

function isPlaceholderScaffoldId(value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  return /^(company|job|application)-[-_]+$/.test(text);
}

function hasMeaningfulValue(value: unknown) {
  return Boolean(normalize(String(value || '')));
}

function isMeaningfulJobRecord(job: JobRecord) {
  return hasMeaningfulValue(job.title) && hasMeaningfulValue(job.companyName);
}

function isMeaningfulApplicationRecord(application: ApplicationRecord) {
  const hasIdentifier = hasMeaningfulValue(application.requestId || application.id);
  const hasCoreData =
    hasMeaningfulValue(application.applicantName) ||
    hasMeaningfulValue(application.applicantPhone) ||
    hasMeaningfulValue(application.jobTitle) ||
    hasMeaningfulValue(application.companyName);

  return hasIdentifier && hasCoreData;
}

function isMeaningfulCompanyRecord(company: CompanyRecord, relatedCompanyNames: Set<string>) {
  if (!hasMeaningfulValue(company.name)) return false;

  const hasStructuredData =
    hasMeaningfulValue(company.email) ||
    hasMeaningfulValue(company.phone) ||
    hasMeaningfulValue(company.address) ||
    hasMeaningfulValue(company.summary) ||
    hasMeaningfulValue(company.imageUrl) ||
    Array.isArray(company.notes) && company.notes.length > 0 ||
    Number(company.openings || 0) > 0;

  if (!isPlaceholderScaffoldId(company.id)) {
    return true;
  }

  return hasStructuredData || relatedCompanyNames.has(normalize(company.name));
}

function buildNormalizedRecordKey(...parts: Array<string | null | undefined>) {
  return normalize(
    parts
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join('::'),
  );
}

function buildTextQualityScore(value: unknown) {
  const normalizedValue = repairLegacyMojibakeText(String(value || '').trim());
  if (!normalizedValue) return -1;

  const questionMarks = (normalizedValue.match(/\?/g) || []).length;
  const latinLetters = (normalizedValue.match(/[A-Za-z]/g) || []).length;
  const arabicLetters = (normalizedValue.match(/[\u0600-\u06ff]/g) || []).length;
  const visibleChars = (normalizedValue.match(/[A-Za-z\u0600-\u06ff0-9]/g) || []).length;

  return visibleChars + arabicLetters * 2 - latinLetters * 0.25 - questionMarks * 4 - getLegacySignalScore(normalizedValue) * 3;
}

function pickPreferredText(...values: Array<string | null | undefined>) {
  return values
    .map((value) => repairLegacyMojibakeText(String(value || '').trim()))
    .sort((first, second) => buildTextQualityScore(second) - buildTextQualityScore(first))[0] || '';
}

function mergeNoteRecords(first: NoteRecord[] = [], second: NoteRecord[] = []) {
  const merged = new Map<string, NoteRecord>();

  [...first, ...second].forEach((note, index) => {
    const id = String(note?.id || `note-${index}`);
    const existing = merged.get(id);
    merged.set(id, {
      id,
      body: pickPreferredText(existing?.body, note?.body),
      createdAt: pickPreferredText(existing?.createdAt, note?.createdAt) || new Date().toISOString(),
      authorName: pickPreferredText(existing?.authorName, note?.authorName) || 'إدارة المنصة',
    });
  });

  return Array.from(merged.values()).sort((firstNote, secondNote) => firstNote.createdAt.localeCompare(secondNote.createdAt));
}

function mergeCompanyRecords(current: CompanyRecord, incoming: CompanyRecord): CompanyRecord {
  return normalizeCompanyRecordData({
    ...current,
    ...incoming,
    id: pickPreferredText(current.id, incoming.id),
    name: pickPreferredText(current.name, incoming.name),
    email: pickPreferredText(current.email, incoming.email),
    phone: pickPreferredText(current.phone, incoming.phone),
    address: pickPreferredText(current.address, incoming.address),
    sector: pickPreferredText(current.sector, incoming.sector),
    location: pickPreferredText(current.location, incoming.location),
    summary: pickPreferredText(current.summary, incoming.summary),
    logoLetter: pickPreferredText(current.logoLetter, incoming.logoLetter, pickInitial(current.name || incoming.name || 'ش')),
    imageUrl: pickPreferredText(current.imageUrl || '', incoming.imageUrl || '') || null,
    openings: Math.max(Number(current.openings || 0), Number(incoming.openings || 0)),
    verified: current.verified || incoming.verified,
    deletedBy: incoming.deletedBy || current.deletedBy || null,
    deletedStatusSnapshot: incoming.deletedStatusSnapshot || current.deletedStatusSnapshot || null,
    status:
      (incoming.status === 'approved' || current.status === 'approved'
        ? 'approved'
        : incoming.status === 'restricted' || current.status === 'restricted'
          ? 'restricted'
          : incoming.status === 'pending' || current.status === 'pending'
            ? 'pending'
            : 'archived') satisfies CompanyRecord['status'],
    notes: mergeNoteRecords(current.notes, incoming.notes),
    deletedAt: current.deletedAt && incoming.deletedAt ? pickPreferredText(current.deletedAt, incoming.deletedAt) : null,
  });
}

function mergeJobRecords(current: JobRecord, incoming: JobRecord): JobRecord {
  return normalizeJobRecordData({
    ...current,
    ...incoming,
    id: pickPreferredText(current.id, incoming.id),
    title: pickPreferredText(current.title, incoming.title),
    companyName: pickPreferredText(current.companyName, incoming.companyName),
    location: pickPreferredText(current.location, incoming.location),
    type: pickPreferredText(current.type, incoming.type),
    postedLabel: pickPreferredText(current.postedLabel, incoming.postedLabel),
    salary: pickPreferredText(current.salary, incoming.salary),
    summary: pickPreferredText(current.summary, incoming.summary),
    sector: pickPreferredText(current.sector, incoming.sector),
    applicationEnabled: current.applicationEnabled !== false && incoming.applicationEnabled !== false,
    featured: current.featured || incoming.featured,
    deletedBy: incoming.deletedBy || current.deletedBy || null,
    deletedStatusSnapshot: incoming.deletedStatusSnapshot || current.deletedStatusSnapshot || null,
    restoredByAdminAt: incoming.restoredByAdminAt || current.restoredByAdminAt || null,
    status:
      (incoming.deletedAt || current.deletedAt
        ? 'archived'
        : incoming.status === 'approved' || current.status === 'approved'
          ? 'approved'
          : incoming.status === 'pending' || current.status === 'pending'
            ? 'pending'
            : incoming.status === 'hidden' || current.status === 'hidden'
              ? 'hidden'
              : incoming.status === 'rejected' || current.status === 'rejected'
                ? 'rejected'
                : 'archived') satisfies JobRecord['status'],
    applicantsCount: Math.max(Number(current.applicantsCount || 0), Number(incoming.applicantsCount || 0)),
    notes: mergeNoteRecords(current.notes, incoming.notes),
    deletedAt: current.deletedAt && incoming.deletedAt ? pickPreferredText(current.deletedAt, incoming.deletedAt) : null,
  });
}

function mergeApplicationRecords(current: ApplicationRecord, incoming: ApplicationRecord): ApplicationRecord {
  const nextStatus = ['hired', 'accepted', 'approved', 'rejected', 'interview', 'review', 'pending'].find((status) =>
    [incoming.status, current.status].includes(status as ApplicationRecord['status']),
  ) as ApplicationRecord['status'];

  return {
    ...current,
    ...incoming,
    id: pickPreferredText(current.id, incoming.id),
    requestId: pickPreferredText(current.requestId, incoming.requestId),
    applicantName: pickPreferredText(current.applicantName, incoming.applicantName),
    applicantEmail: pickPreferredText(current.applicantEmail, incoming.applicantEmail),
    applicantPhone: pickPreferredText(current.applicantPhone, incoming.applicantPhone),
    address: pickPreferredText(current.address, incoming.address),
    governorate: pickPreferredText(current.governorate, incoming.governorate),
    city: pickPreferredText(current.city, incoming.city),
    experience: pickPreferredText(current.experience, incoming.experience),
    experienceYears: pickPreferredText(current.experienceYears, incoming.experienceYears),
    expectedSalary: pickPreferredText(current.expectedSalary, incoming.expectedSalary),
    educationLevel: pickPreferredText(current.educationLevel, incoming.educationLevel),
    specialization: pickPreferredText(current.specialization, incoming.specialization),
    militaryStatus: pickPreferredText(current.militaryStatus, incoming.militaryStatus),
    publicServiceCompleted: pickPreferredText(current.publicServiceCompleted, incoming.publicServiceCompleted),
    maritalStatus: pickPreferredText(current.maritalStatus, incoming.maritalStatus),
    coverLetter: pickPreferredText(current.coverLetter, incoming.coverLetter),
    cvFileName: pickPreferredText(current.cvFileName, incoming.cvFileName),
    cvFileType: pickPreferredText(current.cvFileType, incoming.cvFileType),
    jobTitle: pickPreferredText(current.jobTitle, incoming.jobTitle),
    companyName: pickPreferredText(current.companyName, incoming.companyName),
    status: nextStatus || current.status || incoming.status,
    rejectionReason: pickPreferredText(current.rejectionReason, incoming.rejectionReason),
    companyTag: pickPreferredText(current.companyTag, incoming.companyTag),
    interviewScheduledAt: pickPreferredText(current.interviewScheduledAt || '', incoming.interviewScheduledAt || '') || null,
    interviewMode: pickPreferredText(current.interviewMode, incoming.interviewMode),
    interviewLocation: pickPreferredText(current.interviewLocation, incoming.interviewLocation),
    submittedAt: pickPreferredText(current.submittedAt, incoming.submittedAt) || new Date().toISOString(),
    respondedAt: pickPreferredText(current.respondedAt || '', incoming.respondedAt || '') || null,
    forwardedTo: pickPreferredText(current.forwardedTo, incoming.forwardedTo),
    notes: mergeNoteRecords(current.notes, incoming.notes),
    deletedAt: current.deletedAt && incoming.deletedAt ? pickPreferredText(current.deletedAt, incoming.deletedAt) : null,
  };
}

function dedupeCompanies(companies: CompanyRecord[]) {
  const byKey = new Map<string, CompanyRecord>();

  companies.forEach((company) => {
    const idKey = buildNormalizedRecordKey(company.id);
    const nameKey = buildNormalizedRecordKey(company.name);
    const resolvedKey = idKey || nameKey;
    if (!resolvedKey) return;

    const existing = byKey.get(resolvedKey);
    const merged = existing ? mergeCompanyRecords(existing, company) : company;
    byKey.set(resolvedKey, merged);

    if (idKey && nameKey && idKey !== nameKey) {
      byKey.set(idKey, merged);
      byKey.set(nameKey, merged);
    }
  });

  return Array.from(new Map(Array.from(byKey.values()).map((company) => [buildNormalizedRecordKey(company.id, company.name), company])).values());
}

function dedupeJobs(jobs: JobRecord[]) {
  const byKey = new Map<string, JobRecord>();

  jobs.forEach((job) => {
    const idKey = buildNormalizedRecordKey(job.id);
    const compositeKey = buildNormalizedRecordKey(job.title, job.companyName, job.location);
    const resolvedKey = idKey || compositeKey;
    if (!resolvedKey) return;

    const existing = byKey.get(resolvedKey);
    const merged = existing ? mergeJobRecords(existing, job) : job;
    byKey.set(resolvedKey, merged);

    if (idKey && compositeKey && idKey !== compositeKey) {
      byKey.set(idKey, merged);
      byKey.set(compositeKey, merged);
    }
  });

  return Array.from(
    new Map(Array.from(byKey.values()).map((job) => [buildNormalizedRecordKey(job.id, job.title, job.companyName, job.location), job])).values(),
  );
}

function dedupeApplications(applications: ApplicationRecord[]) {
  const byKey = new Map<string, ApplicationRecord>();

  applications.forEach((application) => {
    const requestKey = buildNormalizedRecordKey(application.requestId || application.id);
    const compositeKey = buildNormalizedRecordKey(application.applicantPhone, application.jobTitle, application.companyName);
    const resolvedKey = requestKey || compositeKey;
    if (!resolvedKey) return;

    const existing = byKey.get(resolvedKey);
    const merged = existing ? mergeApplicationRecords(existing, application) : application;
    byKey.set(resolvedKey, merged);

    if (requestKey && compositeKey && requestKey !== compositeKey) {
      byKey.set(requestKey, merged);
      byKey.set(compositeKey, merged);
    }
  });

  return Array.from(
    new Map(
      Array.from(byKey.values()).map((application) => [
        buildNormalizedRecordKey(application.requestId, application.applicantPhone, application.jobTitle, application.companyName),
        application,
      ]),
    ).values(),
  );
}

function migrateSiteApplicationIds(applications: Array<Record<string, unknown>>): {
  changed: boolean;
  applications: Array<Record<string, unknown>>;
} {
  let changed = false;
  const usedIds = new Set<string>();

  const buildReplacementId = (application: Record<string, unknown>, index: number) => {
    const submittedAt = new Date(String(application.submittedAt || '')).getTime();
    const baseId = Number.isFinite(submittedAt) && submittedAt > 0 ? String(submittedAt) : String(Date.now() + index);
    let candidate = `${baseId}${String(index + 1).padStart(2, '0')}`;

    while (usedIds.has(candidate)) {
      candidate = `${baseId}${Math.floor(Math.random() * 90 + 10)}`;
    }

    return candidate;
  };

  const migratedApplications: Array<Record<string, unknown>> = applications
    .filter((application) => {
      const applicant =
        application.applicant && typeof application.applicant === 'object'
          ? (application.applicant as Record<string, unknown>)
          : {};
      const keepApplication = !isLegacyDemoApplicantPayload({
        fullName: applicant.fullName,
        phone: applicant.phone,
        address: applicant.address,
        city: applicant.city,
        governorate: applicant.governorate,
      });

      if (!keepApplication) {
        changed = true;
      }

      return keepApplication;
    })
    .map((application, index) => {
      const currentId = String(application.requestId || application.id || '').trim();
      const needsReplacement = !/^\d+$/.test(currentId) || usedIds.has(currentId);
      const nextId = needsReplacement ? buildReplacementId(application, index) : currentId;

      if (needsReplacement || String(application.id || '') !== nextId || String(application.requestId || '') !== nextId) {
        changed = true;
      }

      usedIds.add(nextId);

      return {
        ...application,
        id: nextId,
        requestId: nextId,
      };
    });

  return {
    changed,
    applications: migratedApplications,
  };
}

function formatDate(dateLike: string | null | undefined) {
  if (!dateLike) return 'غير محدد';
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return dateLike;
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function relativeTime(dateLike: string | null | undefined) {
  if (!dateLike) return 'غير معروف';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return 'غير معروف';
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  const diffDays = Math.round(diffHours / 24);
  return `منذ ${diffDays} يوم`;
}

function pickInitial(value: string) {
  const cleaned = value.trim();
  return cleaned ? cleaned.charAt(0) : 'م';
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function toHex(buffer: ArrayBufferLike | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr32 = (value: number, shift: number) => (value >>> shift) | (value << (32 - shift));

function sha256Bytes(bytes: Uint8Array) {
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const words = new Uint32Array(paddedLength / 4);

  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] |= bytes[index] << ((3 - (index % 4)) * 8);
  }

  words[bytes.length >> 2] |= 0x80 << ((3 - (bytes.length % 4)) * 8);
  const bitLength = bytes.length * 8;
  words[words.length - 2] = Math.floor(bitLength / 0x100000000);
  words[words.length - 1] = bitLength >>> 0;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const schedule = new Uint32Array(64);

  for (let offset = 0; offset < words.length; offset += 16) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = words[offset + index];
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotr32(schedule[index - 15], 7) ^
        rotr32(schedule[index - 15], 18) ^
        (schedule[index - 15] >>> 3);
      const s1 =
        rotr32(schedule[index - 2], 17) ^
        rotr32(schedule[index - 2], 19) ^
        (schedule[index - 2] >>> 10);
      schedule[index] = (((schedule[index - 16] + s0) >>> 0) + ((schedule[index - 7] + s1) >>> 0)) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (((((h + sum1) >>> 0) + choice) >>> 0) + ((SHA256_K[index] + schedule[index]) >>> 0)) >>> 0;
      const sum0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((part) => part.toString(16).padStart(8, '0'))
    .join('');
}

function fillRandomBytes(bytes: Uint8Array) {
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function createSalt() {
  return toHex(fillRandomBytes(new Uint8Array(16)));
}

function getFailedLoginAttempts() {
  const raw = safeReadJson<Array<number> | { attempts?: number[]; lockedUntil?: number }>(
    STORAGE_KEYS.loginAttempts,
    [],
  );

  if (Array.isArray(raw)) {
    return {
      attempts: raw.filter((value) => Number.isFinite(value)),
      lockedUntil: 0,
    };
  }

  return {
    attempts: Array.isArray(raw.attempts) ? raw.attempts.filter((value) => Number.isFinite(value)) : [],
    lockedUntil: Number(raw.lockedUntil) || 0,
  };
}

function saveFailedLoginAttempts(payload: { attempts: number[]; lockedUntil?: number }) {
  saveJson(STORAGE_KEYS.loginAttempts, {
    attempts: payload.attempts,
    lockedUntil: payload.lockedUntil || 0,
  });
}

function resetFailedLoginAttempts() {
  window.localStorage.removeItem(STORAGE_KEYS.loginAttempts);
}

function registerFailedLoginAttempt() {
  const now = Date.now();
  const current = getFailedLoginAttempts();
  const attempts = current.attempts.filter((value) => now - value <= LOGIN_WINDOW_MS);
  attempts.push(now);
  const lockedUntil = attempts.length >= MAX_FAILED_LOGIN_ATTEMPTS ? now + LOGIN_LOCK_MS : current.lockedUntil;
  saveFailedLoginAttempts({ attempts, lockedUntil });
  return lockedUntil > now ? lockedUntil : 0;
}

function getLoginLockRemainingMs() {
  const now = Date.now();
  const current = getFailedLoginAttempts();
  if (current.lockedUntil > now) {
    return current.lockedUntil - now;
  }

  if (current.lockedUntil && current.lockedUntil <= now) {
    saveFailedLoginAttempts({
      attempts: current.attempts.filter((value) => now - value <= LOGIN_WINDOW_MS),
      lockedUntil: 0,
    });
  }

  return 0;
}

function getPasswordStrengthMessage(password: string) {
  if (password.length < 10) return 'كلمة المرور لازم تكون 10 أحرف على الأقل.';
  if (!/[A-Z]/.test(password)) return 'أضف حرفًا إنجليزيًا كبيرًا واحدًا على الأقل.';
  if (!/[a-z]/.test(password)) return 'أضف حرفًا إنجليزيًا صغيرًا واحدًا على الأقل.';
  if (!/\d/.test(password)) return 'أضف رقمًا واحدًا على الأقل.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'أضف رمزًا خاصًا واحدًا على الأقل.';
  return '';
}

function mapApplicationStatus(value: string | null | undefined): ApplicationRecord['status'] {
  const normalized = normalize(value);
  if (
    normalized.includes('approve') ||
    normalized.includes('approved') ||
    normalized.includes('accept') ||
    normalized.includes('accepted') ||
    normalized.includes('hire') ||
    normalized.includes('hired') ||
    normalized.includes('مقب') ||
    normalized.includes('موافق')
  ) {
    return 'approved';
  }
  if (normalized.includes('reject') || normalized.includes('rejected') || normalized.includes('رفض')) return 'rejected';
  if (normalized.includes('interview') || normalized.includes('مقاب')) return 'interview';
  if (normalized.includes('review') || normalized.includes('مراجعة')) return 'review';
  return 'pending';
}

async function hashCredential(salt: string, value: string) {
  const encoded = new TextEncoder().encode(`${salt}:${value}`);
  if (window.crypto?.subtle?.digest) {
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return toHex(digest);
  }
  return sha256Bytes(encoded);
}

function isFirebaseManagedAdmin(admin: Partial<AdminAccount> | null | undefined) {
  return admin?.authProvider === 'firebase' || String(admin?.salt || '').startsWith('firebase:');
}

function hasFirebaseAdminAccess(claims: Record<string, unknown>) {
  const role = normalize(String(claims.adminRole || claims.role || ''));
  return (
    claims.admin === true ||
    claims.superAdmin === true ||
    role === 'admin' ||
    role === 'super-admin' ||
    role === 'super_admin'
  );
}

function resolveFirebaseRoleId(claims: Record<string, unknown>, roles: RoleDefinition[]) {
  const rawRole = normalize(String(claims.adminRole || claims.role || ''));

  if (rawRole === 'super-admin' || rawRole === 'super_admin' || rawRole === 'superadmin' || claims.superAdmin === true) {
    return 'super-admin';
  }

  const matchedRole = roles.find((role) => normalize(role.id) === rawRole);
  if (matchedRole) {
    return matchedRole.id;
  }

  if (rawRole === 'admin' || claims.admin === true) {
    return 'super-admin';
  }

  return 'super-admin';
}

function buildFirebaseMirrorAccount(input: {
  existingAccount?: AdminAccount | null;
  uid: string;
  email: string;
  displayName: string;
  roleId: string;
}): AdminAccount {
  const existingAccount = input.existingAccount || null;

  return {
    id: existingAccount?.id || `firebase-admin-${input.uid}`,
    displayName: input.displayName,
    roleId: input.roleId,
    status: 'active',
    authProvider: 'firebase',
    email: input.email,
    firebaseUid: input.uid,
    salt: existingAccount?.salt || `firebase:${input.uid}`,
    emailHash: existingAccount?.emailHash || `firebase:${input.email}`,
    passwordHash: existingAccount?.passwordHash || FIREBASE_PASSWORD_SENTINEL,
    lastLoginAt: new Date().toISOString(),
    createdAt: existingAccount?.createdAt || new Date().toISOString(),
  };
}

function upsertAdminAccount(admins: AdminAccount[], nextAdmin: AdminAccount) {
  const nextAdmins = Array.isArray(admins) ? [...admins] : [];
  const existingIndex = nextAdmins.findIndex(
    (admin) =>
      admin.id === nextAdmin.id ||
      (nextAdmin.firebaseUid && admin.firebaseUid === nextAdmin.firebaseUid) ||
      (nextAdmin.email && normalize(admin.email) === normalize(nextAdmin.email)),
  );

  if (existingIndex === -1) {
    nextAdmins.unshift(nextAdmin);
    return nextAdmins;
  }

  nextAdmins[existingIndex] = {
    ...nextAdmins[existingIndex],
    ...nextAdmin,
    createdAt: nextAdmins[existingIndex].createdAt || nextAdmin.createdAt,
  };

  return nextAdmins;
}

function getFirebaseAdminErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code || '') : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'بيانات الدخول غير صحيحة.';
    case 'auth/too-many-requests':
      return 'تم إيقاف المحاولات مؤقتًا بسبب عدد كبير من الطلبات. حاول مرة أخرى بعد قليل.';
    case 'auth/requires-recent-login':
      return 'هذه العملية تحتاج إعادة التحقق من الحساب قبل المتابعة.';
    case 'auth/email-already-in-use':
      return 'هذا البريد مستخدم بالفعل داخل النظام.';
    case 'auth/invalid-email':
      return 'اكتب بريدًا إلكترونيًا صحيحًا.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة جدًا. استخدم كلمة أقوى من 10 أحرف على الأقل.';
    default:
      return 'حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.';
  }
}

const FIREBASE_SUPER_ADMIN_SETUP_MESSAGE =
  'أكمل إعداد Super Admin من Firebase أولًا، ثم سجّل الدخول بالحساب الإداري المعتمد على نفس المشروع.';
const FIREBASE_ADMIN_MANAGEMENT_MESSAGE =
  'إدارة حسابات الأدمن المرتبطة بـ Firebase متاحة بعد تفعيل الربط الكامل داخل المشروع نفسه.';

function createAdminAudit(actorName: string, action: string, entityType: string, entityLabel: string, details: string, severity: AuditLog['severity'] = 'info'): AuditLog {
  return {
    id: createId('audit'),
    actorName: repairAdminUiValue(String(actorName || '')),
    action: repairAdminUiValue(String(action || '')),
    entityType: repairAdminUiValue(String(entityType || '')),
    entityLabel: repairAdminUiValue(String(entityLabel || '')),
    details: repairAdminUiValue(String(details || '')),
    severity,
    createdAt: new Date().toISOString(),
  };
}

function baseSettings(): SystemSettings {
  return {
    userRegistration: true,
    companyRegistration: true,
    jobApplications: true,
    fileUploads: true,
    maintenanceMode: false,
    maintenanceReason: '',
    maintenanceUntil: '',
    maxFileSizeMb: 5,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'],
    systemMessage: '',
  };
}

const DEFAULT_SUPER_ADMIN_ACCOUNT: AdminAccount = {
  id: 'admin-alrahma-primary',
  displayName: 'محمود',
  roleId: 'super-admin',
  status: 'active',
  authProvider: 'local',
  salt: '7e2f9b5b8f4c3d1a6e7f8a9b0c1d2e3f',
  emailHash: 'ed0f8daaa6ebe2580993c31fe566272c666eab74cc259c6c692ddfacd9e5830e',
  passwordHash: 'b9a4cc4ac4c2735cdce2074c49b96eb16ebb1305e2049c3fbc1316d870eada3a',
  lastLoginAt: null,
  createdAt: '2026-03-28T00:00:00.000Z',
};

function createDefaultAdmins(): AdminAccount[] {
  return [];
}

function ensureDefaultAdminAccounts(admins: AdminAccount[]) {
  return Array.isArray(admins) ? [...admins] : [];
}

function createDefaultContentState(): ContentState {
  return repairAdminUiValue({
    heroTitle: DEFAULT_HOME_HERO_TITLE,
    heroSubtitle: DEFAULT_HOME_HERO_SUBTITLE,
    siteAnnouncement: '',
    faqHeroTitle: 'الأسئلة الشائعة',
    faqHeroSubtitle: 'إجابات مختصرة عن الاستخدام، التقديم، ومتابعة الطلب.',
    faqIntroText: '',
    faqAccountTitle: 'الحساب والتقديم',
    faqAccountDescription: 'إدارة التسجيل، التقديم، ومتابعة حالة الطلب.',
    faqCompaniesTitle: 'الشركات والوظائف',
    faqCompaniesDescription: 'إدارة الشركات، الوظائف، وحالة النشر.',
    faqSupportTitle: 'الدعم',
    faqSupportDescription: 'المساعدة التقنية واستفسارات الحساب.',
    faqItems: [],
    aboutHeroTitle: 'من نحن',
    aboutHeroSubtitle: 'الرحمة المهداه للتوظيف جهة توظيف تركز على نشر الفرص الفعلية، استقبال الطلبات، ومتابعة حالتها بشكل واضح.',
    aboutOverviewTitle: 'ماذا نقدم',
    aboutOverviewText: 'نوفر للشركات مساحة واحدة لنشر الوظائف ومراجعة الطلبات، ونوفر للمتقدم رحلة تقديم واضحة تنتهي برقم طلب يمكن الرجوع إليه.',
    aboutProcessTitle: 'كيف يتم العمل',
    aboutProcessText: 'تُنشر الوظيفة أولًا بمعلوماتها الأساسية، ثم يرسل المتقدم بياناته من النموذج المطلوب، وبعدها تظهر حالة الطلب من صفحة المتابعة.',
    aboutCTAHeading: 'ابدأ من المكان المناسب',
    aboutCTAText: 'إذا كنت تبحث عن وظيفة ابدأ من صفحة الوظائف. وإذا كنت تمثل شركة، سجّل حساب الشركة ثم أدر الوظائف والطلبات من لوحة التحكم.',
    contactHeroTitle: 'تواصل معنا',
    contactHeroSubtitle: 'قنوات التواصل الرسمية الخاصة بالمنصة مجمعة هنا بشكل واضح وسريع.',
    contactIntroText: 'استخدم هذه الصفحة للاستفسار عن التقديم، متابعة الطلبات، أو الوصول المباشر لرقم الدعم واللوكيشن.',
    contactPhone: '01066718722',
    contactEmail: '',
    contactLocation: 'العاشر من رمضان - الأردنية - مول الحجاز - الدور الرابع مكتب رقم ١٠',
    contactHours: 'من ٨ ص إلى ٥ م\nمن الأحد للخميس.',
    privacyHeroTitle: 'سياسة الخصوصية',
    privacyHeroSubtitle: 'نحترم خصوصيتك وملتزمون بحماية بياناتك الشخصية داخل المنصة.',
    privacyIntroText: 'تشرح هذه الصفحة كيف نجمع البيانات ونستخدمها ونحميها، مع إبراز حقوق المستخدم في الوصول إلى معلوماته أو تعديلها أو طلب حذفها.',
    termsHeroTitle: 'الشروط والأحكام',
    termsHeroSubtitle: 'باستخدامك للمنصة فأنت توافق على الشروط التي تنظّم الاستخدام ومسؤولية الأطراف المختلفة.',
    termsIntroText: 'توضح هذه الصفحة ما هو مسموح وما هو غير مسموح داخل المنصة، وكيف نتعامل مع المحتوى والحسابات والخصوصية والتحديثات المستقبلية.',
  });
}

const LEGACY_CONTENT_TEXT_ALIASES: Record<string, string> = {
  'منصة الرحمة المهداه للوظائف': 'الرحمة المهداه للتوظيف',
  'منصة الرحمة المهداة للوظائف': 'الرحمة المهداه للتوظيف',
  'أصحاب الشركات': 'متابعة الوظائف والفرص',
  'نشر الوظائف، المراجعة، وإدارة ظهور الشركة والفرص المتاحة.':
    'اختيار التخصص المناسب ومعرفة حالة الفرص المتاحة والتقديم عليها.',
  'كل ما تحتاج لمعرفته حول إدارة الحسابات والشركات والوظائف والتواصل داخل المنصة.':
    'كل ما تحتاج لمعرفته حول التقديم على الوظائف، متابعة الفرص، ووسائل التواصل معنا في مكان واحد.',
  'كيف تتم مراجعة الشركات الجديدة؟': 'كيف أختار الوظيفة المناسبة لي؟',
  'تدخل كل شركة جديدة طابور مراجعة موحد، ويستطيع الأدمن قبولها أو رفضها أو طلب استكمال البيانات.':
    'راجع التخصص، مكان العمل، نوع الدوام، والراتب المتوقع، ثم اقرأ وصف الوظيفة جيدًا قبل التقديم حتى تختار الفرصة الأنسب لخبراتك.',
  'كيف يمكنني نشر وظيفة جديدة؟': 'كيف أتابع الوظائف المتاحة وأختار الأنسب لي؟',
  'بالنسبة لأصحاب الشركات، يجب أولًا التسجيل كحساب "منشأة". بعد تفعيل الحساب، يمكنهم الدخول إلى لوحة التحكم والضغط على "إضافة وظيفة جديدة" وإدخال كل التفاصيل المطلوبة.':
    'تصفح الوظائف الحالية، وحدد التخصص المناسب لك، وراجع تفاصيل كل فرصة جيدًا. وإذا وجدت أن العدد اكتمل في فرصة مناسبة لك، اختر تخصصك وأقل مرتب متوقع حتى يتم التواصل معك عند توافر فرصة مناسبة.',
  'كيف تنشر الشركة وظيفة جديدة؟': 'ماذا أفعل إذا اكتمل العدد في الوظيفة المناسبة لي؟',
  'بعد تفعيل حساب الشركة، يمكنها إضافة الوظائف من داخل لوحة التحكم ومتابعة حالة كل وظيفة ونسبة التفاعل عليها.':
    'إذا وجدت أن العدد قد اكتمل في الوظيفة المناسبة لك حاليًا، اختر تخصصك وأقل مرتب متوقع حتى يتم التواصل معك عند توافر فرصة مناسبة لك.',
  '+20 100 000 0000': '01066718722',
  'القاهرة الجديدة، مصر': 'العاشر من رمضان - الأردنية - مول الحجاز - الدور الرابع مكتب رقم 8',
  'الأحد - الخميس: 9 ص - 6 م': 'من 8 ص إلى 5 م من الأحد للخميس.',
  'نحن هنا للإجابة عن استفسارات التوظيف، الحسابات، ونشر الوظائف بأعلى مستوى من الوضوح والسرعة.':
    'يسعدنا الرد على استفسارات التوظيف ومتابعة الطلبات واستقبال رسائلكم عبر واتساب ونموذج التواصل خلال مواعيد العمل الرسمية.',
  'إذا كانت لديك أسئلة عن التقديم، التوثيق، أو إدارة الحسابات، فهذه الصفحة هي البوابة الأسرع للوصول إلى فريق الدعم.':
    'إذا كانت لديك أي استفسارات عن التقديم أو متابعة الفرص المناسبة لك فهذه الصفحة هي الطريق الأسرع للوصول إلى فريق الرحمة المهداه للتوظيف.',
};

function normalizeLegacyContentText(value: string | undefined, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = repairLegacyMojibakeText(value).trim();
  if (!trimmed) return fallback;
  return LEGACY_CONTENT_TEXT_ALIASES[trimmed] || trimmed;
}

function sanitizeHiddenContactEmail(value: string | undefined) {
  const normalized = normalizeLegacyContentText(value, '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? '' : normalized;
}

function normalizeHomeHeroContentText(
  value: string | undefined,
  fallback: string,
  legacyValues: Set<string>,
) {
  const normalized = normalizeLegacyContentText(value, fallback);
  if (legacyValues.has(normalized)) return fallback;
  return normalized;
}

function normalizeFaqItem(item: Partial<FaqItem> | null | undefined, index: number): FaqItem {
  const category = item?.category === 'companies' || item?.category === 'support' ? item.category : 'account';

  return {
    id: String(item?.id || `faq-${index + 1}`),
    category,
    question: normalizeLegacyContentText(String(item?.question || ''), ''),
    answer: normalizeLegacyContentText(String(item?.answer || ''), ''),
  };
}

function normalizeContentState(content: Partial<ContentState> | null | undefined): ContentState {
  const defaults = createDefaultContentState();
  if (!content || typeof content !== 'object') {
    return defaults;
  }

  return {
    ...defaults,
    heroTitle: normalizeHomeHeroContentText(content.heroTitle, defaults.heroTitle, LEGACY_HOME_HERO_TITLES),
    heroSubtitle: normalizeHomeHeroContentText(
      content.heroSubtitle,
      defaults.heroSubtitle,
      LEGACY_HOME_HERO_SUBTITLES,
    ),
    siteAnnouncement: typeof content.siteAnnouncement === 'string' ? content.siteAnnouncement : defaults.siteAnnouncement,
    faqHeroTitle: normalizeLegacyContentText(content.faqHeroTitle, defaults.faqHeroTitle),
    faqHeroSubtitle: normalizeLegacyContentText(content.faqHeroSubtitle, defaults.faqHeroSubtitle),
    faqIntroText: normalizeLegacyContentText(content.faqIntroText, defaults.faqIntroText),
    faqAccountTitle: normalizeLegacyContentText(content.faqAccountTitle, defaults.faqAccountTitle),
    faqAccountDescription: normalizeLegacyContentText(content.faqAccountDescription, defaults.faqAccountDescription),
    faqCompaniesTitle: normalizeLegacyContentText(content.faqCompaniesTitle, defaults.faqCompaniesTitle),
    faqCompaniesDescription:
      normalizeLegacyContentText(content.faqCompaniesDescription, defaults.faqCompaniesDescription),
    faqSupportTitle: normalizeLegacyContentText(content.faqSupportTitle, defaults.faqSupportTitle),
    faqSupportDescription: normalizeLegacyContentText(content.faqSupportDescription, defaults.faqSupportDescription),
    faqItems: Array.isArray(content.faqItems) ? content.faqItems.map((item, index) => normalizeFaqItem(item, index)) : defaults.faqItems.map((item) => ({ ...item })),
    aboutHeroTitle: normalizeLegacyContentText(content.aboutHeroTitle, defaults.aboutHeroTitle),
    aboutHeroSubtitle: normalizeLegacyContentText(content.aboutHeroSubtitle, defaults.aboutHeroSubtitle),
    aboutOverviewTitle: normalizeLegacyContentText(content.aboutOverviewTitle, defaults.aboutOverviewTitle),
    aboutOverviewText: normalizeLegacyContentText(content.aboutOverviewText, defaults.aboutOverviewText),
    aboutProcessTitle: normalizeLegacyContentText(content.aboutProcessTitle, defaults.aboutProcessTitle),
    aboutProcessText: normalizeLegacyContentText(content.aboutProcessText, defaults.aboutProcessText),
    aboutCTAHeading: normalizeLegacyContentText(content.aboutCTAHeading, defaults.aboutCTAHeading),
    aboutCTAText: normalizeLegacyContentText(content.aboutCTAText, defaults.aboutCTAText),
    contactHeroTitle: normalizeLegacyContentText(content.contactHeroTitle, defaults.contactHeroTitle),
    contactHeroSubtitle: normalizeLegacyContentText(content.contactHeroSubtitle, defaults.contactHeroSubtitle),
    contactIntroText: normalizeLegacyContentText(content.contactIntroText, defaults.contactIntroText),
    contactPhone: normalizeLegacyContentText(content.contactPhone, defaults.contactPhone),
    contactEmail: sanitizeHiddenContactEmail(content.contactEmail),
    contactLocation: normalizeLegacyContentText(content.contactLocation, defaults.contactLocation),
    contactHours: normalizeLegacyContentText(content.contactHours, defaults.contactHours),
    privacyHeroTitle: normalizeLegacyContentText(content.privacyHeroTitle, defaults.privacyHeroTitle),
    privacyHeroSubtitle: normalizeLegacyContentText(content.privacyHeroSubtitle, defaults.privacyHeroSubtitle),
    privacyIntroText: normalizeLegacyContentText(content.privacyIntroText, defaults.privacyIntroText),
    termsHeroTitle: normalizeLegacyContentText(content.termsHeroTitle, defaults.termsHeroTitle),
    termsHeroSubtitle: normalizeLegacyContentText(content.termsHeroSubtitle, defaults.termsHeroSubtitle),
    termsIntroText: normalizeLegacyContentText(content.termsIntroText, defaults.termsIntroText),
  };
}

function buildUsers(profile: Record<string, unknown>, applications: ApplicationRecord[]): PlatformUser[] {
  const byKey = new Map<string, PlatformUser>();
  const siteSession = safeReadSession<Record<string, string | boolean | null>>(STORAGE_KEYS.siteSession, {});
  const rememberDevice = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 36) : 'Browser';

  applications.forEach((application) => {
    const applicantEmail = String(application.applicantEmail || '').trim();
    const applicantPhone = String(application.applicantPhone || '').trim();
    const applicantName = String(application.applicantName || '').trim();
    const key = normalize(applicantEmail || applicantPhone || application.id);
    if (!key || (!applicantName && !applicantEmail && !applicantPhone)) return;

    if (!byKey.has(key)) {
      byKey.set(key, {
        id: `user-${key.replace(/[^a-z0-9]/g, '-') || application.id}`,
        displayName: applicantName || applicantEmail || applicantPhone,
        email: applicantEmail,
        phone: applicantPhone,
        city: application.city,
        role: 'applicant',
        companyName: '',
        status: 'active',
        verified: Boolean(String(application.cvFileName || '').trim()),
        lastActivityAt: application.submittedAt,
        openSessions: 1,
        devices: [rememberDevice],
        notes: [],
        deletedAt: null,
      });
    }
  });

  const profileRole = normalize(String(profile.role || ''));
  if (profileRole && !['company', 'admin'].includes(profileRole)) {
    const email = String(profile.email || siteSession.email || '').trim();
    const displayName = String(profile.fullName || siteSession.name || '').trim();
    const phone = String(profile.phone || '').trim();
    const key = normalize(email || phone || displayName);
    if (!key || (!displayName && !email && !phone)) {
      return Array.from(byKey.values()).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    }

    byKey.set(key, {
      id: `user-${key.replace(/[^a-z0-9]/g, '-')}`,
      displayName: displayName || email || phone,
      email,
      phone,
      city: String(profile.city || ''),
      role: 'applicant',
      companyName: '',
      status: String(profile.accountStatus || 'active') === 'archived' ? 'archived' : 'active',
      verified: Boolean(profile.cvFileMeta || profile.applicantMeta || profile.seekerProfile),
      lastActivityAt: new Date().toISOString(),
      openSessions: 1,
      devices: [rememberDevice],
      notes: [],
      deletedAt: null,
    });
  }

  if (profileRole === 'company') {
    const email = String(profile.email || siteSession.email || '').trim();
    const companyName = String(
      (profile.companyProfile as Record<string, string> | undefined)?.companyName ||
        profile.companyName ||
        profile.fullName ||
        '',
    ).trim();
    const phone = String(profile.phone || '').trim();
    const key = normalize(email || companyName || phone);
    if (!key || (!companyName && !email && !phone)) {
      return Array.from(byKey.values()).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    }

    byKey.set(key, {
      id: `user-${key.replace(/[^a-z0-9]/g, '-')}`,
      displayName: companyName || email || phone,
      email,
      phone,
      city: String(profile.companyCity || profile.city || ''),
      role: 'company',
      companyName,
      status: String(profile.accountStatus || 'active') === 'archived' ? 'archived' : 'active',
      verified: Boolean(profile.companyLogoMeta || profile.companyProfile),
      lastActivityAt: new Date().toISOString(),
      openSessions: 1,
      devices: [rememberDevice],
      notes: [],
      deletedAt: null,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

function getProfileCompanyJobs(profile: Record<string, unknown>) {
  const topLevelJobs = Array.isArray(profile.companyJobs) ? (profile.companyJobs as Array<Record<string, unknown>>) : [];
  const nestedJobs = Array.isArray((profile.companyProfile as Record<string, unknown> | undefined)?.jobs)
    ? (((profile.companyProfile as Record<string, unknown> | undefined)?.jobs as Array<Record<string, unknown>>))
    : [];

  const jobsById = new Map<string, Record<string, unknown>>();

  [...topLevelJobs, ...nestedJobs].forEach((job, index) => {
    const title = String(job?.title || job?.jobTitle || '').trim();
    if (!title) return;

    const id =
      String(job?.id || '').trim() ||
      `job-${normalize(title).replace(/[^a-z0-9]/g, '-') || 'custom'}-${index + 1}`;

    jobsById.set(id, job);
  });

  return Array.from(jobsById.values());
}

function buildCompanies(profile: Record<string, unknown>): CompanyRecord[] {
  const companies: CompanyRecord[] = [];

  const profileRole = normalize(String(profile.role || ''));
  if (profileRole === 'company') {
    const companyJobs = getProfileCompanyJobs(profile);
    const companyName = String(
      (profile.companyProfile as Record<string, string> | undefined)?.companyName ||
        profile.companyName ||
        profile.fullName ||
        '',
    ).trim();
    if (!companyName) return companies;

    const normalizedName = normalize(companyName);
    const exists = companies.some((company) => normalize(company.name) === normalizedName);
    if (!exists) {
      companies.unshift({
        id: `company-${normalizedName.replace(/[^a-z0-9]/g, '-') || 'custom'}`,
        name: companyName,
        email: String(profile.email || (profile.companyProfile as Record<string, string> | undefined)?.companyEmail || '').trim(),
        phone: String(profile.phone || (profile.companyProfile as Record<string, string> | undefined)?.companyPhone || '').trim(),
        landline: String(
          (profile.companyProfile as Record<string, string> | undefined)?.landline || profile.companyLandline || '',
        ).trim(),
        address: String(profile.address || (profile.companyProfile as Record<string, string> | undefined)?.companyAddress || '').trim(),
        sector: String(
          (profile.companyProfile as Record<string, string> | undefined)?.companySector || profile.companySector || '',
        ).trim(),
        location: String(
          (profile.companyProfile as Record<string, string> | undefined)?.companyCity || profile.companyCity || profile.city || '',
        ).trim(),
        openings: companyJobs.filter((job) => !job?.deletedAt).length,
        summary: String(
          (profile.companyProfile as Record<string, string> | undefined)?.companyDescription ||
            (profile.companyProfile as Record<string, string> | undefined)?.description ||
            profile.companyDescription ||
            profile.bio ||
            profile.description ||
            profile.headline ||
            '',
        ).trim(),
        logoLetter: pickInitial(companyName),
        website: String(profile.companyWebsite || profile.website || '').trim(),
        socialLinks: normalizeCompanySocialLinks(
          (profile.companyProfile as Record<string, unknown> | undefined)?.socialLinks || profile.socialLinks,
        ),
        siteMode:
          String((profile.companyProfile as Record<string, unknown> | undefined)?.siteMode || profile.siteMode || 'full').trim() ===
          'landing'
            ? 'landing'
            : 'full',
        restrictionMessage: String(
          (profile.companyProfile as Record<string, unknown> | undefined)?.restrictionMessage || profile.restrictionMessage || '',
        ).trim(),
        restrictionAttachmentUrl:
          String(
            (profile.companyProfile as Record<string, unknown> | undefined)?.restrictionAttachmentUrl ||
              profile.restrictionAttachmentUrl ||
              '',
          ).trim() || null,
        restrictionAttachmentName: String(
          (profile.companyProfile as Record<string, unknown> | undefined)?.restrictionAttachmentName ||
            profile.restrictionAttachmentName ||
            '',
        ).trim(),
        imageUrl: null,
        status: 'approved',
        verified: Boolean(profile.companyLogoMeta || profile.companyProfile),
        notes: [],
        deletedAt: null,
      });
    }
  }

  return companies;
}

function buildJobs(profile: Record<string, unknown>): JobRecord[] {
  const jobs: JobRecord[] = [];

  const profileRole = normalize(String(profile.role || ''));
  const companyJobs = getProfileCompanyJobs(profile);
  if (profileRole === 'company' && companyJobs.length) {
    const companyName = String(
      (profile.companyProfile as Record<string, string> | undefined)?.companyName ||
        profile.companyName ||
        '',
    ).trim();

    companyJobs.forEach((job) => {
      const title = String(job?.title || job?.jobTitle || '').trim();
      if (!title) return;

      jobs.unshift({
        id: String(job?.id || createId('job')),
        title,
        companyName: String(job?.companyName || companyName || '').trim(),
        location: String(
          job?.location ||
            job?.city ||
            (profile.companyProfile as Record<string, string> | undefined)?.companyCity ||
            '',
        ),
        type: String(job?.type || '').trim(),
        postedLabel: String(job?.postedLabel || '').trim(),
        salary: String(job?.salary || '').trim(),
        summary: String(job?.summary || job?.description || '').trim(),
        sector: String(
          job?.sector ||
            (profile.companyProfile as Record<string, string> | undefined)?.companySector ||
            profile.companySector ||
            '',
        ).trim(),
        applicationEnabled: job?.applicationEnabled !== false,
        featured: Boolean(job?.featured),
        status: String(job?.status || 'approved') as JobRecord['status'],
        applicantsCount: 0,
        notes: [],
        deletedAt: job?.deletedAt ? String(job.deletedAt) : null,
      });
    });
  }

  return jobs;
}

function buildApplications(): ApplicationRecord[] {
  const rawSiteApplications = safeReadJson<Array<Record<string, unknown>>>(STORAGE_KEYS.siteApplications, []);
  const { changed, applications: siteApplications } = migrateSiteApplicationIds(rawSiteApplications);

  if (changed) {
    saveJson(STORAGE_KEYS.siteApplications, siteApplications);
  }

  return siteApplications
    .filter((application) => {
      const job = (application.job as Record<string, unknown> | undefined) || {};
      return !isLegacyStaticApplicationRecord({
        id: String(application.id || ''),
        requestId: String(application.requestId || ''),
        jobTitle: String(job.jobTitle || ''),
        companyName: String(job.jobCompany || ''),
      });
    })
    .map((application) => {
      const applicant = (application.applicant as Record<string, unknown> | undefined) || {};
      const job = (application.job as Record<string, unknown> | undefined) || {};
      const cvMeta =
        ((applicant.cvFileMeta as Record<string, string> | undefined) ||
          (application.cvFileMeta as Record<string, string> | undefined)) ??
        undefined;
      const requestId = String(application.requestId || application.id || createId('application'));

      return {
        id: requestId,
        requestId,
        applicantName: String(applicant.fullName || application.applicantName || '').trim(),
        applicantEmail: String(applicant.email || application.applicantEmail || '').trim(),
        applicantPhone: String(applicant.phone || application.applicantPhone || '').trim(),
        address: String(applicant.address || application.address || '').trim(),
        governorate: String(applicant.governorate || application.governorate || '').trim(),
        city: String(applicant.city || application.city || '').trim(),
        experience: String(applicant.experience || application.experience || '').trim(),
        experienceYears: String(applicant.experienceYears || application.experienceYears || '').trim(),
        expectedSalary: String(applicant.expectedSalary || application.expectedSalary || '').trim(),
        educationLevel: String(applicant.educationLevel || application.educationLevel || '').trim(),
        specialization: String(applicant.specialization || application.specialization || '').trim(),
        militaryStatus: String(applicant.militaryStatus || application.militaryStatus || '').trim(),
        publicServiceCompleted: String(applicant.publicServiceCompleted || application.publicServiceCompleted || '').trim(),
        maritalStatus: String(applicant.maritalStatus || application.maritalStatus || '').trim(),
        coverLetter: String(applicant.coverLetter || application.coverLetter || '').trim(),
        cvFileName: String(cvMeta?.name || application.cvFileName || '').trim(),
        cvFileType: String(cvMeta?.type || application.cvFileType || '').trim(),
        jobTitle: String(job.jobTitle || application.jobTitle || '').trim(),
        companyName: String(job.jobCompany || application.companyName || '').trim(),
        status: mapApplicationStatus(String(application.status || 'pending')),
        rejectionReason: String(application.rejectionReason || '').trim(),
        companyTag: String(application.companyTag || '').trim(),
        interviewScheduledAt: application.interviewScheduledAt ? String(application.interviewScheduledAt) : null,
        interviewMode: String(application.interviewMode || '').trim(),
        interviewLocation: String(application.interviewLocation || '').trim(),
        submittedAt: String(application.submittedAt || new Date().toISOString()),
        respondedAt: application.respondedAt ? String(application.respondedAt) : null,
        forwardedTo: String(application.forwardedTo || '').trim(),
        notes: [],
        deletedAt: application.deletedAt ? String(application.deletedAt) : null,
      };
    });
}

function buildThreads(applications: ApplicationRecord[]): MessageThread[] {
  return applications.map((application) => ({
    id: `thread-${application.id}`,
    applicationId: application.id,
    title: [application.jobTitle, application.companyName].filter(Boolean).join(' â€¢ ') || application.requestId,
    participantName: application.applicantName || application.applicantEmail || application.requestId,
    participantRole: 'متقدم',
    companyName: application.companyName,
    status: 'open',
    unreadCount: 0,
    assignedAdminId: null,
    internalNotes: [],
    lastMessageAt: application.submittedAt,
  }));
}

function sanitizeAdmins(admins: AdminAccount[] | undefined, version: number): AdminAccount[] {
  if (!Array.isArray(admins)) return [];

  const uniqueAdmins = new Map<string, AdminAccount>();

  admins.forEach((admin) => {
    if (!admin || typeof admin !== 'object') return;

    const fingerprint = `${admin.salt || ''}::${admin.emailHash || ''}::${admin.passwordHash || ''}`;
    if (version < 4 && LEGACY_BOOTSTRAP_ADMIN_IDS.has(admin.id)) return;
    if (LEGACY_BOOTSTRAP_ADMIN_IDS.has(admin.id) || LEGACY_BOOTSTRAP_ADMIN_FINGERPRINTS.has(fingerprint)) return;
    if (!admin.id || !admin.displayName || !admin.roleId || !admin.salt || !admin.emailHash || !admin.passwordHash) return;

    uniqueAdmins.set(admin.id, {
      ...admin,
      displayName: String(admin.displayName || '').trim(),
      roleId: String(admin.roleId || '').trim(),
      status: admin.status === 'suspended' ? 'suspended' : 'active',
      authProvider: admin.authProvider === 'firebase' ? 'firebase' : 'local',
      email: admin.email ? String(admin.email).trim().toLowerCase() : undefined,
      firebaseUid: admin.firebaseUid ? String(admin.firebaseUid).trim() : null,
      salt: String(admin.salt || '').trim(),
      emailHash: String(admin.emailHash || '').trim(),
      passwordHash: String(admin.passwordHash || '').trim(),
      lastLoginAt: admin.lastLoginAt ? String(admin.lastLoginAt) : null,
      createdAt: admin.createdAt ? String(admin.createdAt) : new Date().toISOString(),
    });
  });

  return Array.from(uniqueAdmins.values());
}

function hydrateState(raw: Partial<AdminState> | null): AdminState | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.admins) || !Array.isArray(raw.roles)) return null;
  const originalVersion = typeof raw.version === 'number' ? raw.version : 0;

  return sanitizePersistedState({
    ...(raw as AdminState),
    version: Math.max(originalVersion, 4),
    admins: sanitizeAdmins(raw.admins as AdminAccount[] | undefined, originalVersion),
    content: normalizeContentState(raw.content as Partial<ContentState> | null | undefined),
  });
}

function enrichState(state: AdminState): AdminState {
  const nextCompanies = state.companies.map((company) => ({
    ...company,
    openings:
      state.jobs.filter(
        (job) =>
          normalize(job.companyName) === normalize(company.name) &&
          !job.deletedAt &&
          ['approved', 'pending'].includes(job.status),
      ).length || company.openings,
  }));

  const nextJobs = state.jobs.map((job) => ({
    ...job,
    applicantsCount: state.applications.filter(
      (application) =>
        normalize(application.jobTitle) === normalize(job.title) &&
        normalize(application.companyName) === normalize(job.companyName) &&
        !application.deletedAt,
    ).length,
  }));

  const nextMessages = state.messages.length
    ? state.messages.map((thread) => {
        const linkedApplication = state.applications.find((application) => application.id === thread.applicationId);
        return linkedApplication
          ? {
              ...thread,
              title: `${linkedApplication.jobTitle} â€¢ ${linkedApplication.companyName}`,
              participantName: linkedApplication.applicantName,
              companyName: linkedApplication.companyName,
              lastMessageAt: linkedApplication.submittedAt,
            }
          : thread;
      })
    : buildThreads(state.applications);

  return {
    ...state,
    companies: nextCompanies,
    jobs: nextJobs,
    messages: nextMessages,
  };
}

function createSeedState(): AdminState {
  const baseState: AdminState = {
    version: 4,
    admins: createDefaultAdmins(),
    roles: DEFAULT_ROLE_TEMPLATES.map((role) => ({ ...role, permissions: [...role.permissions] })),
    users: [],
    companies: [],
    jobs: [],
    applications: [],
    messages: [],
    settings: baseSettings(),
    content: createDefaultContentState(),
    notificationTemplates: [],
    sentNotifications: [],
    auditLogs: [],
    widgetPreferences: ['overview', 'queue', 'activity', 'health', 'analytics'],
  };

  const cachedRuntime = sanitizeSharedRuntimePayload(
    safeReadJson<SharedRuntimePayload>(STORAGE_KEYS.publicRuntime, {}),
  );
  const seededState = mergeSharedRuntimeIntoState(baseState, cachedRuntime);

  return repairLegacyStoredValue(
    sanitizePersistedState(
      enrichState({
        ...seededState,
        users: buildUsers({}, seededState.applications),
      }),
    ),
  ).value;
}

function syncExternalData(state: AdminState): AdminState {
  const cachedRuntime = sanitizeSharedRuntimePayload(
    safeReadJson<SharedRuntimePayload>(STORAGE_KEYS.publicRuntime, {}),
  );
  const nextState = mergeSharedRuntimeIntoState(sanitizePersistedState({ ...state }), cachedRuntime);
  const existingUserNotes = new Map(state.users.map((user) => [user.id, user.notes]));
  nextState.users = buildUsers({}, nextState.applications).map((user) => ({
    ...user,
    notes: existingUserNotes.get(user.id) || [],
  }));

  return sanitizePersistedState(enrichState(nextState));
}

function buildPublicRuntime(state: AdminState) {
  const cleanState = sanitizePersistedState(state);
  return {
    settings: cleanState.settings,
    content: cleanState.content,
    jobs: cleanState.jobs.map((job) => ({
      id: job.id,
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      type: job.type,
      postedLabel: job.postedLabel,
      salary: job.salary,
      summary: job.summary,
      sector: job.sector,
      applicationEnabled: job.applicationEnabled,
      status: job.status,
      featured: job.featured,
      notes: job.notes,
      deletedAt: job.deletedAt,
    })),
    companies: cleanState.companies.map((company) => ({
      id: company.id,
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      sector: company.sector,
      location: company.location,
      openings: company.openings,
      summary: company.summary,
      logoLetter: company.logoLetter,
      imageUrl: company.imageUrl || null,
      status: company.status,
      verified: company.verified,
      notes: company.notes,
      deletedAt: company.deletedAt,
    })),
    applications: cleanState.applications.map((application) => ({
      id: application.id,
      requestId: application.requestId,
      applicantName: application.applicantName,
      applicantEmail: application.applicantEmail,
      applicantPhone: application.applicantPhone,
      address: application.address,
      governorate: application.governorate,
      city: application.city,
      experience: application.experience,
      experienceYears: application.experienceYears,
      expectedSalary: application.expectedSalary,
      educationLevel: application.educationLevel,
      specialization: application.specialization,
      militaryStatus: application.militaryStatus,
      publicServiceCompleted: application.publicServiceCompleted,
      maritalStatus: application.maritalStatus,
      coverLetter: application.coverLetter,
      cvFileName: application.cvFileName,
      cvFileType: application.cvFileType,
      jobTitle: application.jobTitle,
      companyName: application.companyName,
      status: application.status,
      rejectionReason: application.rejectionReason,
      submittedAt: application.submittedAt,
      respondedAt: application.respondedAt,
      forwardedTo: application.forwardedTo,
      notes: application.notes,
      deletedAt: application.deletedAt,
    })),
  };
}

type SharedRuntimePayload = {
  settings?: Partial<SystemSettings>;
  content?: Partial<ContentState>;
  companies?: CompanyRecord[];
  jobs?: JobRecord[];
  applications?: Array<Record<string, unknown>>;
};

function getSharedRuntimeCompanyKey(company: CompanyRecord | Partial<CompanyRecord> | null | undefined) {
  return buildNormalizedRecordKey(String(company?.id || ''), String(company?.name || ''));
}

function getSharedRuntimeJobKey(job: JobRecord | Partial<JobRecord> | null | undefined) {
  return buildNormalizedRecordKey(String(job?.id || ''), String(job?.title || ''), String(job?.companyName || ''), String(job?.location || ''));
}

function getSharedRuntimeApplicationKey(application: ApplicationRecord | Record<string, unknown> | null | undefined) {
  return buildNormalizedRecordKey(String(application?.requestId || application?.id || ''));
}

function mergeRuntimeCollections<T extends Record<string, unknown>>(
  currentItems: T[] = [],
  incomingItems: T[] = [],
  keyGetter: (item: T) => string,
) {
  const merged = new Map<string, T>();

  [...currentItems, ...incomingItems].forEach((item) => {
    const key = keyGetter(item);
    if (!key) return;

    const existing = merged.get(key) || {};
    merged.set(key, { ...existing, ...item } as T);
  });

  return Array.from(merged.values());
}

function sanitizeSharedRuntimePayload(payload: unknown): SharedRuntimePayload {
  const repairedPayload =
    payload && typeof payload === 'object'
      ? (repairLegacyStoredValue(payload as SharedRuntimePayload).value as SharedRuntimePayload)
      : {};
  const nextPayload: SharedRuntimePayload =
    repairedPayload && typeof repairedPayload === 'object' ? { ...repairedPayload } : {};

  if (Array.isArray(nextPayload.companies)) {
    nextPayload.companies = nextPayload.companies.filter((company) => !isLegacyStaticCompanyRecord(company));
  }

  if (Array.isArray(nextPayload.jobs)) {
    nextPayload.jobs = nextPayload.jobs.filter((job) => !isLegacyStaticJobRecord(job));
  }

  return nextPayload;
}

function mergeSharedRuntimeIntoState(currentState: AdminState, incomingRuntime: SharedRuntimePayload): AdminState {
  const sharedApplications = (Array.isArray(incomingRuntime.applications) ? incomingRuntime.applications : [])
    .map((application) => repairLegacyStoredValue(application).value as Record<string, unknown>)
    .map((application) => {
      const applicant = (application.applicant as Record<string, unknown> | undefined) || {};
      const job = (application.job as Record<string, unknown> | undefined) || {};
      const cvMeta =
        ((applicant.cvFileMeta as Record<string, string> | undefined) ||
          (application.cvFileMeta as Record<string, string> | undefined)) ??
        undefined;
      const requestId = String(application.requestId || application.id || createId('application')).trim();

      return {
        id: requestId,
        requestId,
        applicantName: String(applicant.fullName || application.applicantName || '').trim(),
        applicantEmail: String(applicant.email || application.applicantEmail || '').trim(),
        applicantPhone: String(applicant.phone || application.applicantPhone || '').trim(),
        address: String(applicant.address || application.address || '').trim(),
        governorate: String(applicant.governorate || application.governorate || '').trim(),
        city: String(applicant.city || application.city || '').trim(),
        experience: String(applicant.experience || application.experience || '').trim(),
        experienceYears: String(applicant.experienceYears || application.experienceYears || '').trim(),
        expectedSalary: String(applicant.expectedSalary || application.expectedSalary || '').trim(),
        educationLevel: String(applicant.educationLevel || application.educationLevel || '').trim(),
        specialization: String(applicant.specialization || application.specialization || '').trim(),
        militaryStatus: String(applicant.militaryStatus || application.militaryStatus || '').trim(),
        publicServiceCompleted: String(applicant.publicServiceCompleted || application.publicServiceCompleted || '').trim(),
        maritalStatus: String(applicant.maritalStatus || application.maritalStatus || '').trim(),
        coverLetter: String(applicant.coverLetter || application.coverLetter || '').trim(),
        cvFileName: String(cvMeta?.name || application.cvFileName || '').trim(),
        cvFileType: String(cvMeta?.type || application.cvFileType || '').trim(),
        jobTitle: String(job.jobTitle || application.jobTitle || '').trim(),
        companyName: String(job.jobCompany || application.companyName || '').trim(),
        status: mapApplicationStatus(String(application.status || 'pending')),
        rejectionReason: String(application.rejectionReason || '').trim(),
        companyTag: String(application.companyTag || '').trim(),
        interviewScheduledAt: application.interviewScheduledAt ? String(application.interviewScheduledAt) : null,
        interviewMode: String(application.interviewMode || '').trim(),
        interviewLocation: String(application.interviewLocation || '').trim(),
        submittedAt: String(application.submittedAt || new Date().toISOString()),
        respondedAt: application.respondedAt ? String(application.respondedAt) : null,
        forwardedTo: String(application.forwardedTo || '').trim(),
        notes: sanitizeRemoteNotes(application.notes),
        deletedAt: application.deletedAt ? String(application.deletedAt) : null,
      } satisfies ApplicationRecord;
    });
  const mergedCompanies = mergeRuntimeCollections(
    currentState.companies,
    Array.isArray(incomingRuntime.companies) ? incomingRuntime.companies : [],
    getSharedRuntimeCompanyKey,
  );
  const mergedJobs = mergeRuntimeCollections(
    currentState.jobs,
    Array.isArray(incomingRuntime.jobs) ? incomingRuntime.jobs : [],
    getSharedRuntimeJobKey,
  );
  const mergedApplications = mergeRuntimeCollections(currentState.applications, sharedApplications, getSharedRuntimeApplicationKey);

  return sanitizePersistedState(
    enrichState({
      ...currentState,
      settings: {
        ...currentState.settings,
        ...(incomingRuntime.settings || {}),
      },
      content: {
        ...currentState.content,
        ...(incomingRuntime.content || {}),
      },
      companies: mergedCompanies,
      jobs: mergedJobs,
      applications: mergedApplications,
    }),
  );
}

async function readSharedRuntimePayload() {
  if (!isPrivateRuntimeSyncHost(window.location.hostname)) return null;

  try {
    const response = await fetch(`${SHARED_RUNTIME_SYNC_PATH}?_=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as unknown;
    return sanitizeSharedRuntimePayload(payload);
  } catch {
    return null;
  }
}

async function syncSharedPublicRuntimeFile(runtime: ReturnType<typeof buildPublicRuntime>) {
  if (!isPrivateRuntimeSyncHost(window.location.hostname)) return false;
  try {
    const response = await fetch(SHARED_RUNTIME_SYNC_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runtime),
    });
    return response.ok;
  } catch {
    // The shared file is a local-dev bridge. Failing here should not block the admin UI.
    return false;
  }
}

function syncSiteApplicationStatus(
  applicationId: string,
  status: ApplicationRecord['status'],
  rejectionReason = '',
) {
  const rawApplications = safeReadJson<Array<Record<string, unknown>>>(STORAGE_KEYS.siteApplications, []);
  const { applications: normalizedApplications } = migrateSiteApplicationIds(rawApplications);
  const respondedAt = ['interview', 'approved', 'accepted', 'rejected', 'hired'].includes(status)
    ? new Date().toISOString()
    : '';

  const nextApplications = normalizedApplications.map((application) => {
    const requestId = String(application.requestId || application.id || '');
    if (requestId !== applicationId) return application;

    return {
      ...application,
      id: requestId || applicationId,
      requestId: requestId || applicationId,
      status,
      rejectionReason: status === 'rejected' ? rejectionReason : '',
      respondedAt,
    };
  });

  saveJson(STORAGE_KEYS.siteApplications, nextApplications);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const FIREBASE_SITE_CONFIG_DOC = { collection: 'siteConfig', id: 'public' } as const;

function normalizeFirestoreTimestamp(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof (value as { seconds?: number }).seconds === 'number') {
    return new Date(((value as { seconds: number }).seconds || 0) * 1000).toISOString();
  }
  return '';
}

function sanitizeRemoteNotes(value: unknown): NoteRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => {
      const item = entry as Partial<NoteRecord>;
      return {
        id: String(item.id || `note-${index}`),
        body: String(item.body || ''),
        createdAt: String(item.createdAt || new Date().toISOString()),
        authorName: String(item.authorName || 'إدارة المنصة'),
      };
    });
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

function mapFirebaseCompanyToAdmin(entry: Record<string, unknown>): CompanyRecord {
  const name = String(entry.name || entry.companyName || '').trim();
  return {
    id: String(entry.id || entry.companyId || createId('company')),
    name,
    email: String(entry.email || entry.companyEmail || '').trim(),
    phone: String(entry.phone || entry.mobile || entry.companyPhone || '').trim(),
    landline: String(entry.landline || entry.companyLandline || '').trim(),
    address: String(entry.address || entry.fullAddress || '').trim(),
    sector: String(entry.sector || entry.companySector || '').trim(),
    location: String(entry.location || entry.city || '').trim(),
    openings: Number(entry.openings || 0),
    summary: String(entry.summary || entry.description || '').trim(),
    logoLetter: String(entry.logoLetter || pickInitial(name || 'ش')),
    website: String(entry.website || '').trim(),
    socialLinks: normalizeCompanySocialLinks(entry.socialLinks),
    siteMode: String(entry.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full',
    restrictionMessage: String(entry.restrictionMessage || '').trim(),
    restrictionAttachmentUrl: String(entry.restrictionAttachmentUrl || '').trim() || null,
    restrictionAttachmentName: String(entry.restrictionAttachmentName || '').trim(),
    imageUrl: String(entry.imageUrl || entry.logoUrl || entry.coverUrl || '').trim() || null,
    status:
      String(entry.status || 'approved').trim() === 'restricted'
        ? 'restricted'
        : String(entry.status || 'approved').trim() === 'archived'
          ? 'archived'
          : String(entry.status || 'approved').trim() === 'pending'
            ? 'pending'
            : 'approved',
    verified: Boolean(entry.verified),
    notes: sanitizeRemoteNotes(entry.notes),
    deletedBy: String(entry.deletedBy || '').trim() === 'admin' ? 'admin' : null,
    deletedStatusSnapshot:
      String(entry.deletedStatusSnapshot || '').trim() === 'approved'
        ? 'approved'
        : String(entry.deletedStatusSnapshot || '').trim() === 'pending'
          ? 'pending'
          : String(entry.deletedStatusSnapshot || '').trim() === 'restricted'
            ? 'restricted'
            : String(entry.deletedStatusSnapshot || '').trim() === 'archived'
              ? 'archived'
              : null,
    deletedAt: normalizeFirestoreTimestamp(entry.deletedAt) || null,
  };
}

function mapFirebaseJobToAdmin(entry: Record<string, unknown>): JobRecord {
  return {
    id: String(entry.id || createId('job')),
    title: String(entry.title || entry.jobTitle || '').trim(),
    companyName: String(entry.companyName || '').trim(),
    location: String(entry.location || '').trim(),
    type: String(entry.type || '').trim(),
    postedLabel: String(entry.postedLabel || 'الآن').trim() || 'الآن',
    salary: String(entry.salary || '').trim(),
    summary: String(entry.summary || entry.description || '').trim(),
    sector: String(entry.sector || '').trim(),
    applicationEnabled: entry.applicationEnabled !== false,
    featured: Boolean(entry.featured),
    status:
      String(entry.status || 'approved').trim() === 'pending'
        ? 'pending'
        : String(entry.status || 'approved').trim() === 'hidden'
          ? 'hidden'
          : String(entry.status || 'approved').trim() === 'archived'
            ? 'archived'
            : String(entry.status || 'approved').trim() === 'rejected'
              ? 'rejected'
              : 'approved',
    applicantsCount: Number(entry.applicantsCount || 0),
    notes: sanitizeRemoteNotes(entry.notes),
    deletedBy:
      String(entry.deletedBy || '').trim() === 'company'
        ? 'company'
        : String(entry.deletedBy || '').trim() === 'admin'
          ? 'admin'
          : null,
    deletedStatusSnapshot:
      String(entry.deletedStatusSnapshot || '').trim() === 'approved'
        ? 'approved'
        : String(entry.deletedStatusSnapshot || '').trim() === 'pending'
          ? 'pending'
          : String(entry.deletedStatusSnapshot || '').trim() === 'hidden'
            ? 'hidden'
            : String(entry.deletedStatusSnapshot || '').trim() === 'archived'
              ? 'archived'
              : String(entry.deletedStatusSnapshot || '').trim() === 'rejected'
                ? 'rejected'
                : null,
    restoredByAdminAt: normalizeFirestoreTimestamp(entry.restoredByAdminAt) || null,
    deletedAt: normalizeFirestoreTimestamp(entry.deletedAt) || null,
  };
}

function mapFirebaseApplicationToAdmin(entry: Record<string, unknown>): ApplicationRecord {
  const nestedApplicant =
    entry.applicant && typeof entry.applicant === 'object' ? (entry.applicant as Record<string, unknown>) : {};
  const nestedJob = entry.job && typeof entry.job === 'object' ? (entry.job as Record<string, unknown>) : {};
  const nestedCvMeta =
    nestedApplicant.cvFileMeta && typeof nestedApplicant.cvFileMeta === 'object'
      ? (nestedApplicant.cvFileMeta as { name?: string; type?: string })
      : {};

  return {
    id: String(entry.id || entry.requestId || createId('application')),
    requestId: String(entry.requestId || entry.id || ''),
    applicantName: String(entry.applicantName || nestedApplicant.fullName || '').trim(),
    applicantEmail: String(entry.applicantEmail || nestedApplicant.email || '').trim(),
    applicantPhone: String(entry.applicantPhone || nestedApplicant.phone || '').trim(),
    address: String(entry.address || nestedApplicant.address || '').trim(),
    governorate: String(entry.governorate || nestedApplicant.governorate || '').trim(),
    city: String(entry.city || nestedApplicant.city || '').trim(),
    experience: String(entry.experience || nestedApplicant.experience || '').trim(),
    experienceYears: String(entry.experienceYears || nestedApplicant.experienceYears || '').trim(),
    expectedSalary: String(entry.expectedSalary || nestedApplicant.expectedSalary || '').trim(),
    educationLevel: String(entry.educationLevel || nestedApplicant.educationLevel || '').trim(),
    specialization: String(entry.specialization || nestedApplicant.specialization || '').trim(),
    militaryStatus: String(entry.militaryStatus || nestedApplicant.militaryStatus || '').trim(),
    publicServiceCompleted: String(entry.publicServiceCompleted || nestedApplicant.publicServiceCompleted || '').trim(),
    maritalStatus: String(entry.maritalStatus || nestedApplicant.maritalStatus || '').trim(),
    coverLetter: String(entry.coverLetter || nestedApplicant.coverLetter || '').trim(),
    cvFileName: String(entry.cvFileName || nestedApplicant.cvFileName || nestedCvMeta.name || '').trim(),
    cvFileType: String(entry.cvFileType || nestedApplicant.cvFileType || nestedCvMeta.type || '').trim(),
    jobTitle: String(entry.jobTitle || nestedJob.jobTitle || nestedJob.title || '').trim(),
    companyName: String(entry.companyName || nestedJob.jobCompany || nestedJob.companyName || '').trim(),
    status:
      String(entry.status || 'review').trim() === 'pending'
        ? 'pending'
        : String(entry.status || 'review').trim() === 'approved'
          ? 'approved'
          : String(entry.status || 'review').trim() === 'accepted'
            ? 'accepted'
            : String(entry.status || 'review').trim() === 'rejected'
              ? 'rejected'
              : String(entry.status || 'review').trim() === 'hired'
                ? 'hired'
                : 'review',
    rejectionReason: String(entry.rejectionReason || '').trim(),
    companyTag: String(entry.companyTag || '').trim(),
    interviewScheduledAt: normalizeFirestoreTimestamp(entry.interviewScheduledAt) || null,
    interviewMode: String(entry.interviewMode || '').trim(),
    interviewLocation: String(entry.interviewLocation || '').trim(),
    submittedAt: normalizeFirestoreTimestamp(entry.submittedAt) || new Date().toISOString(),
    respondedAt: normalizeFirestoreTimestamp(entry.respondedAt) || null,
    forwardedTo: String(entry.forwardedTo || '').trim(),
    notes: sanitizeRemoteNotes(entry.notes),
    deletedAt: normalizeFirestoreTimestamp(entry.deletedAt) || null,
  };
}

function buildFirebaseSyncSlice(state: AdminState) {
  return {
    companies: [...state.companies].sort((first, second) => first.id.localeCompare(second.id)),
    jobs: [...state.jobs].sort((first, second) => first.id.localeCompare(second.id)),
    applications: [...state.applications].sort((first, second) => first.id.localeCompare(second.id)),
    settings: state.settings,
    content: state.content,
  };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminState>(() => {
    const hydrated = hydrateState(safeReadJson<Partial<AdminState> | null>(STORAGE_KEYS.state, null));
    return syncExternalData(hydrated ? enrichState(hydrated) : createSeedState());
  });
  const [session, setSessionState] = useState<AdminSession | null>(() => {
    const saved = safeReadSession<AdminSession | null>(STORAGE_KEYS.session, null);
    if (!saved) return null;
    if (Date.now() > Date.parse(saved.expiresAt)) {
      saveSession(null);
      return null;
    }
    return saved;
  });
  const firebaseRemoteSliceRef = useRef(buildFirebaseSyncSlice(state));
  const firebaseSyncMetaRef = useRef({
    ready: false,
    hydrating: false,
    lastRemoteFingerprint: '',
    lastWrittenFingerprint: '',
  });
  const sharedRuntimeSyncFingerprintRef = useRef('');
  const sharedRuntimeWriteFingerprintRef = useRef('');
  const [firebaseAuthResolved, setFirebaseAuthResolved] = useState(!hasFirebaseConfig());
  const [firebaseAuthUid, setFirebaseAuthUid] = useState<string | null>(hasFirebaseConfig() ? null : '__local__');
  const currentAdmin = session ? state.admins.find((admin) => admin.id === session.adminId) || null : null;
  const currentRole = currentAdmin ? state.roles.find((role) => role.id === currentAdmin.roleId) || null : null;
  const isSetupRequired = !hasFirebaseConfig() && !state.admins.some((admin) => admin.status === 'active');
  const actorName = currentAdmin?.displayName || 'إدارة المنصة';

  const applyFirebaseAdminSession = (input: {
    uid: string;
    email: string;
    displayName: string;
    roleId: string;
    remember: boolean;
  }) => {
    const nextSession: AdminSession = {
      adminId: `firebase-admin-${input.uid}`,
      displayName: input.displayName,
      identifier: input.email,
      roleId: input.roleId,
      provider: 'firebase',
      firebaseUid: input.uid,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      remember: input.remember,
    };

    setFirebaseAuthUid(input.uid);
    setFirebaseAuthResolved(true);
    setState((current) => {
      const existingAccount =
        current.admins.find(
          (admin) =>
            admin.id === nextSession.adminId ||
            admin.firebaseUid === input.uid ||
            normalize(admin.email) === normalize(input.email),
        ) || null;

      return enrichState({
        ...current,
        admins: upsertAdminAccount(
          current.admins,
          buildFirebaseMirrorAccount({
            existingAccount,
            uid: input.uid,
            email: input.email,
            displayName: input.displayName,
            roleId: input.roleId,
          }),
        ),
      });
    });
    saveSession(nextSession);
    setSessionState(nextSession);
    return nextSession;
  };

  useEffect(() => {
    if (!hasFirebaseConfig()) {
      setFirebaseAuthResolved(true);
      setFirebaseAuthUid('__local__');
      return;
    }

    let cancelled = false;
    let unsubscribe = () => {};

    void (async () => {
      const services = await getFirebaseServices();
      if (!services || cancelled) {
        if (!cancelled) {
          setFirebaseAuthResolved(true);
          setFirebaseAuthUid('');
        }
        return;
      }

      const { auth, authModule } = services;

      unsubscribe = authModule.onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          if (cancelled) return;

          if (!firebaseUser) {
            setFirebaseAuthUid('');
            setFirebaseAuthResolved(true);
            saveSession(null);
            setSessionState((current) => (current?.provider === 'firebase' ? null : current));
            return;
          }

          try {
            const tokenResult = await authModule.getIdTokenResult(firebaseUser, true);
            const claims = (tokenResult?.claims || {}) as Record<string, unknown>;

            if (!hasFirebaseAdminAccess(claims)) {
              setFirebaseAuthUid('');
              setFirebaseAuthResolved(true);
              await authModule.signOut(auth);
              if (cancelled) return;
              saveSession(null);
              setSessionState((current) => (current?.provider === 'firebase' ? null : current));
              return;
            }

            const email = String(firebaseUser.email || '').trim().toLowerCase();
            const roleId = resolveFirebaseRoleId(claims, state.roles);
            const displayName = pickPreferredText(
              String(firebaseUser.displayName || '').trim(),
              email.split('@')[0],
              'مدير المنصة',
            );
            applyFirebaseAdminSession({
              uid: firebaseUser.uid,
              email,
              displayName,
              roleId,
              remember: session?.remember ?? true,
            });
          } catch {
            setFirebaseAuthUid('');
            setFirebaseAuthResolved(true);
            saveSession(null);
            setSessionState((current) => (current?.provider === 'firebase' ? null : current));
          }
        },
        () => {
          if (cancelled) return;
          setFirebaseAuthUid('');
          setFirebaseAuthResolved(true);
          saveSession(null);
          setSessionState((current) => (current?.provider === 'firebase' ? null : current));
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [state.roles]);

  useEffect(() => {
    if (hasFirebaseConfig()) return;
    if (!isPrivateRuntimeSyncHost(window.location.hostname)) return;

    let cancelled = false;
    let inFlight = false;

    const syncSharedRuntime = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;

      try {
        const payload = await readSharedRuntimePayload();
        if (!payload || cancelled) return;

        const fingerprint = JSON.stringify(payload);
        if (!fingerprint || fingerprint === sharedRuntimeSyncFingerprintRef.current) {
          return;
        }

        sharedRuntimeSyncFingerprintRef.current = fingerprint;
        sharedRuntimeWriteFingerprintRef.current = fingerprint;

        startTransition(() => {
          setState((current) => mergeSharedRuntimeIntoState(current, payload));
        });
      } finally {
        inFlight = false;
      }
    };

    void syncSharedRuntime();
    const interval = window.setInterval(() => {
      void syncSharedRuntime();
    }, SHARED_RUNTIME_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const publicRuntime = buildPublicRuntime(state);
    const fingerprint = JSON.stringify(publicRuntime);
    saveJson(STORAGE_KEYS.state, state);
    saveJson(STORAGE_KEYS.publicRuntime, publicRuntime);
    if (hasFirebaseConfig()) {
      return;
    }
    if (fingerprint && fingerprint === sharedRuntimeWriteFingerprintRef.current) {
      return;
    }

    void (async () => {
      const synced = await syncSharedPublicRuntimeFile(publicRuntime);
      if (synced) {
        sharedRuntimeWriteFingerprintRef.current = fingerprint;
      }
    })();
  }, [state]);

  useEffect(() => {
    if (!hasFirebaseConfig()) return;
    if (!firebaseAuthResolved) return;
    if (!session || !currentAdmin) return;
    if (session?.provider === 'firebase' && (!session.firebaseUid || firebaseAuthUid !== session.firebaseUid)) return;

    let cancelled = false;
    const unsubscribeHandlers: Array<() => void> = [];
    const remoteSlice = firebaseRemoteSliceRef.current;

    const applyRemoteSlice = () => {
      if (cancelled) return;

      const normalizedSlice = {
        companies: [...remoteSlice.companies].sort((first, second) => first.id.localeCompare(second.id)),
        jobs: [...remoteSlice.jobs].sort((first, second) => first.id.localeCompare(second.id)),
        applications: [...remoteSlice.applications].sort((first, second) => first.id.localeCompare(second.id)),
        settings: { ...remoteSlice.settings },
        content: { ...remoteSlice.content },
      };
      const fingerprint = JSON.stringify(normalizedSlice);
      firebaseSyncMetaRef.current.hydrating = true;
      firebaseSyncMetaRef.current.lastRemoteFingerprint = fingerprint;

      startTransition(() => {
        setState((current) =>
          enrichState({
            ...current,
            companies: normalizedSlice.companies,
            jobs: normalizedSlice.jobs,
            applications: normalizedSlice.applications,
            settings: {
              ...current.settings,
              ...normalizedSlice.settings,
            },
            content: {
              ...current.content,
              ...normalizedSlice.content,
            },
          }),
        );
      });

      window.setTimeout(() => {
        firebaseSyncMetaRef.current.hydrating = false;
      }, 0);
    };

    void (async () => {
      const services = await getFirebaseServices();
      if (!services || cancelled) return;

      const { db, firestoreModule } = services;

      unsubscribeHandlers.push(
        firestoreModule.onSnapshot(firestoreModule.collection(db, 'companies'), (snapshot) => {
          remoteSlice.companies = snapshot.docs.map((docSnapshot) =>
            mapFirebaseCompanyToAdmin({ ...(docSnapshot.data() as Record<string, unknown>), id: docSnapshot.id }),
          );
          applyRemoteSlice();
        }),
      );

      unsubscribeHandlers.push(
        firestoreModule.onSnapshot(firestoreModule.collection(db, 'jobs'), (snapshot) => {
          remoteSlice.jobs = snapshot.docs.map((docSnapshot) =>
            mapFirebaseJobToAdmin({ ...(docSnapshot.data() as Record<string, unknown>), id: docSnapshot.id }),
          );
          applyRemoteSlice();
        }),
      );

      unsubscribeHandlers.push(
        firestoreModule.onSnapshot(firestoreModule.collection(db, 'applications'), (snapshot) => {
          remoteSlice.applications = snapshot.docs.map((docSnapshot) =>
            mapFirebaseApplicationToAdmin({ ...(docSnapshot.data() as Record<string, unknown>), id: docSnapshot.id }),
          );
          applyRemoteSlice();
        }),
      );

      unsubscribeHandlers.push(
        firestoreModule.onSnapshot(
          firestoreModule.doc(db, FIREBASE_SITE_CONFIG_DOC.collection, FIREBASE_SITE_CONFIG_DOC.id),
          (snapshot) => {
            const payload = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
            remoteSlice.settings =
              payload.settings && typeof payload.settings === 'object'
                ? (payload.settings as SystemSettings)
                : remoteSlice.settings;
            remoteSlice.content =
              payload.content && typeof payload.content === 'object'
                ? normalizeContentState(payload.content as Partial<ContentState>)
                : remoteSlice.content;
            applyRemoteSlice();
          },
        ),
      );

      firebaseSyncMetaRef.current.ready = true;
    })();

    return () => {
      cancelled = true;
      firebaseSyncMetaRef.current.ready = false;
      unsubscribeHandlers.forEach((unsubscribe) => unsubscribe());
    };
  }, [currentAdmin, firebaseAuthResolved, firebaseAuthUid, session]);

  useEffect(() => {
    if (!hasFirebaseConfig()) return;
    if (!firebaseAuthResolved) return;
    if (session?.provider === 'firebase' && (!session.firebaseUid || firebaseAuthUid !== session.firebaseUid)) return;
    if (!session || !currentAdmin) return;
    if (!firebaseSyncMetaRef.current.ready || firebaseSyncMetaRef.current.hydrating) return;

    const slice = buildFirebaseSyncSlice(state);
    const fingerprint = JSON.stringify(slice);
    if (
      !fingerprint ||
      fingerprint === firebaseSyncMetaRef.current.lastRemoteFingerprint ||
      fingerprint === firebaseSyncMetaRef.current.lastWrittenFingerprint
    ) {
      return;
    }

    firebaseSyncMetaRef.current.lastWrittenFingerprint = fingerprint;

    void (async () => {
      const services = await getFirebaseServices();
      if (!services) return;

      const { db, firestoreModule } = services;
      const companiesByName = new Map(slice.companies.map((company) => [normalize(company.name), company]));
      const jobsByKey = new Map(slice.jobs.map((job) => [normalize(`${job.title}::${job.companyName}`), job]));

      await Promise.all(
        slice.companies.map((company) =>
          firestoreModule.setDoc(
            firestoreModule.doc(db, 'companies', company.id),
            {
              id: company.id,
              uid: company.id,
              ownerUid: company.id,
              name: company.name,
              sector: company.sector,
              city: company.location,
              location: company.location,
              teamSize: '',
              phone: company.phone,
              landline: company.landline || '',
              email: company.email || '',
              address: company.address || '',
              website: company.website || '',
              socialLinks: company.socialLinks || {},
              siteMode: company.siteMode,
              restrictionMessage: company.restrictionMessage || '',
              restrictionAttachmentUrl: company.restrictionAttachmentUrl || null,
              restrictionAttachmentName: company.restrictionAttachmentName || '',
              description: company.summary || '',
              summary: company.summary || '',
              status: company.status,
              verified: company.verified,
              logoUrl: company.imageUrl || '',
              coverUrl: '',
              logoLetter: company.logoLetter,
              imageUrl: company.imageUrl || null,
              coverImage: '',
              openings: company.openings,
              notes: company.notes || [],
              deletedBy: company.deletedBy || null,
              deletedStatusSnapshot: company.deletedStatusSnapshot || null,
              deletedAt: company.deletedAt || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          ),
        ),
      );

      await Promise.all(
        slice.jobs.map((job) => {
          const company = companiesByName.get(normalize(job.companyName));
          return firestoreModule.setDoc(
            firestoreModule.doc(db, 'jobs', job.id),
            {
              id: job.id,
              ownerUid: company?.id || job.id,
              companyId: company?.id || '',
              companyName: job.companyName,
              title: job.title,
              location: job.location,
              type: job.type,
              salary: job.salary,
              summary: job.summary,
              sector: job.sector,
              applicationEnabled: job.applicationEnabled,
              featured: job.featured,
              status: job.status,
              applicantsCount: job.applicantsCount,
              notes: job.notes,
              deletedBy: job.deletedBy,
              deletedStatusSnapshot: job.deletedStatusSnapshot,
              restoredByAdminAt: job.restoredByAdminAt,
              deletedAt: job.deletedAt,
              postedAt: new Date().toISOString(),
              postedLabel: job.postedLabel,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }),
      );

      await Promise.all(
        slice.applications.map((application) => {
          const company = companiesByName.get(normalize(application.companyName));
          const linkedJob = jobsByKey.get(normalize(`${application.jobTitle}::${application.companyName}`));
          const requestId = application.requestId || application.id;
          const applicantPhoneDigits = String(application.applicantPhone || '').replace(/\D+/g, '');
          const applicantPhoneKey = applicantPhoneDigits ? `20${applicantPhoneDigits.replace(/^20/, '')}` : '';

          return Promise.all([
            firestoreModule.setDoc(
              firestoreModule.doc(db, 'applications', requestId),
              {
                id: application.id,
                requestId: application.requestId,
                companyId: company?.id || '',
                companyName: application.companyName,
                jobId: linkedJob?.id || '',
                jobTitle: application.jobTitle,
                applicantName: application.applicantName,
                applicantEmail: application.applicantEmail,
                applicantPhone: application.applicantPhone,
                applicantPhoneDigits,
                applicantPhoneKey,
                address: application.address,
                governorate: application.governorate,
                city: application.city,
                experience: application.experience,
                experienceYears: application.experienceYears,
                expectedSalary: application.expectedSalary,
                educationLevel: application.educationLevel,
                specialization: application.specialization,
                militaryStatus: application.militaryStatus,
                publicServiceCompleted: application.publicServiceCompleted,
                maritalStatus: application.maritalStatus,
                coverLetter: application.coverLetter,
                cvFileName: application.cvFileName,
                cvFileType: application.cvFileType,
                status: application.status,
                rejectionReason: application.rejectionReason,
                companyTag: application.companyTag,
                interviewScheduledAt: application.interviewScheduledAt,
                interviewMode: application.interviewMode,
                interviewLocation: application.interviewLocation,
                submittedAt: application.submittedAt,
                respondedAt: application.respondedAt,
                forwardedTo: application.forwardedTo,
                notes: application.notes,
                deletedAt: application.deletedAt,
                applicant: {
                  fullName: application.applicantName,
                  email: application.applicantEmail,
                  phone: application.applicantPhone,
                  address: application.address,
                  governorate: application.governorate,
                  city: application.city,
                  experience: application.experience,
                  experienceYears: application.experienceYears,
                  expectedSalary: application.expectedSalary,
                  educationLevel: application.educationLevel,
                  specialization: application.specialization,
                  militaryStatus: application.militaryStatus,
                  publicServiceCompleted: application.publicServiceCompleted,
                  maritalStatus: application.maritalStatus,
                  coverLetter: application.coverLetter,
                  cvFileName: application.cvFileName,
                  cvFileType: application.cvFileType,
                },
                job: {
                  id: linkedJob?.id || '',
                  jobTitle: application.jobTitle,
                  jobCompany: application.companyName,
                  jobLocation: linkedJob?.location || '',
                  jobType: linkedJob?.type || '',
                  jobSalary: linkedJob?.salary || '',
                  jobSector: linkedJob?.sector || '',
                  jobSummary: linkedJob?.summary || '',
                },
                company: {
                  id: company?.id || '',
                  name: application.companyName,
                  email: '',
                },
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            ),
            firestoreModule.setDoc(
              firestoreModule.doc(db, 'applicationTracking', requestId),
              {
                id: requestId,
                requestId,
                companyId: company?.id || '',
                companyName: application.companyName,
                jobId: linkedJob?.id || '',
                jobTitle: application.jobTitle,
                status: application.status,
                rejectionReason: application.rejectionReason,
                companyTag: application.companyTag,
                interviewScheduledAt: application.interviewScheduledAt,
                interviewMode: application.interviewMode,
                interviewLocation: application.interviewLocation,
                submittedAt: application.submittedAt,
                respondedAt: application.respondedAt,
                applicantPhoneKey,
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            ),
          ]);
        }),
      );

      await firestoreModule.setDoc(
        firestoreModule.doc(db, FIREBASE_SITE_CONFIG_DOC.collection, FIREBASE_SITE_CONFIG_DOC.id),
        {
          settings: slice.settings,
          content: slice.content,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      firebaseSyncMetaRef.current.lastRemoteFingerprint = fingerprint;
    })();
  }, [currentAdmin, firebaseAuthResolved, firebaseAuthUid, session, state]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.publicRuntime) {
        startTransition(() => {
          setState((current) => syncExternalData(current));
        });
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!session || currentAdmin) return;

    if (session.provider === 'firebase' && hasFirebaseConfig()) {
      if (!firebaseAuthResolved) return;
      if (!firebaseAuthUid) return;
      if (session.firebaseUid && firebaseAuthUid === session.firebaseUid) return;
    }

    saveSession(null);
    setSessionState(null);
  }, [currentAdmin, firebaseAuthResolved, firebaseAuthUid, session]);

  const updateState = (updater: (current: AdminState) => AdminState) => {
    setState((current) => enrichState(updater(current)));
  };

  const writeAudit = (
    actor: string,
    action: string,
    entityType: string,
    entityLabel: string,
    details: string,
    severity: AuditLog['severity'] = 'info',
  ) => {
    setState((current) => ({
      ...current,
      auditLogs: [createAdminAudit(actor, action, entityType, entityLabel, details, severity), ...current.auditLogs].slice(0, 250),
    }));
  };

  const login: AdminContextValue['login'] = async (identifier, password, remember) => {
    if (isSetupRequired) {
      return { ok: false, message: 'لازم تنشئ أول حساب أدمن قبل تسجيل الدخول.' };
    }

    const lockRemainingMs = getLoginLockRemainingMs();
    if (lockRemainingMs > 0) {
      const minutes = Math.max(1, Math.ceil(lockRemainingMs / 60000));
      return { ok: false, message: `تم إيقاف المحاولات مؤقتًا. جرّب بعد ${minutes} دقيقة.` };
    }

    const normalizedIdentifier = normalize(identifier);

    if (hasFirebaseConfig()) {
      try {
        const services = await getFirebaseServices();
        if (!services) {
          return { ok: false, message: 'تعذر تهيئة خدمات تسجيل دخول الأدمن.' };
        }

        const { auth, authModule } = services;
        await authModule.setPersistence(
          auth,
          remember ? authModule.browserLocalPersistence : authModule.browserSessionPersistence,
        );

        const credential = await authModule.signInWithEmailAndPassword(auth, normalizedIdentifier, password);
        const tokenResult = await authModule.getIdTokenResult(credential.user, true);
        const claims = (tokenResult?.claims || {}) as Record<string, unknown>;

        if (!hasFirebaseAdminAccess(claims)) {
          await authModule.signOut(auth);
          return {
            ok: false,
            message: 'الحساب الحالي لا يملك صلاحية دخول لوحة الأدمن. فعّل صلاحية Super Admin أو Admin أولًا.',
          };
        }

        const email = String(credential.user.email || normalizedIdentifier).trim().toLowerCase();
        const roleId = resolveFirebaseRoleId(claims, state.roles);
        const displayName = pickPreferredText(
          String(credential.user.displayName || '').trim(),
          email.split('@')[0],
          'مدير المنصة',
        );

        applyFirebaseAdminSession({
          uid: credential.user.uid,
          email,
          displayName,
          roleId,
          remember,
        });

        resetFailedLoginAttempts();
        return { ok: true };
      } catch (error) {
        const lockedUntil = registerFailedLoginAttempt();
        writeAudit('محاولة دخول', 'فشل تسجيل الدخول', 'security', SITE_METADATA.name, 'تم رفض محاولة دخول Firebase إلى لوحة الأدمن.', 'danger');
        if (lockedUntil) {
          const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
          return { ok: false, message: `تم إيقاف المحاولات مؤقتًا. جرّب بعد ${minutes} دقيقة.` };
        }
        return { ok: false, message: getFirebaseAdminErrorMessage(error) };
      }
    }

    const activeAdmins = state.admins.filter((admin) => admin.status === 'active');

    for (const admin of activeAdmins) {
      const emailHash = await hashCredential(admin.salt, normalizedIdentifier);
      if (emailHash !== admin.emailHash) continue;

      const passwordHash = await hashCredential(admin.salt, password);
      if (passwordHash !== admin.passwordHash) {
        const lockedUntil = registerFailedLoginAttempt();
        writeAudit('محاولة دخول', 'فشل تسجيل الدخول', 'security', SITE_METADATA.name, 'تم رفض محاولة دخول بسبب كلمة مرور غير صحيحة.', 'danger');
        if (lockedUntil) {
          const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
          return { ok: false, message: `تم إيقاف المحاولات مؤقتًا. جرّب بعد ${minutes} دقيقة.` };
        }
        return { ok: false, message: 'بيانات الدخول غير صحيحة.' };
      }

      const nextSession: AdminSession = {
        adminId: admin.id,
        displayName: admin.displayName,
        identifier: normalizedIdentifier,
        roleId: admin.roleId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        remember,
      };

      resetFailedLoginAttempts();
      saveSession(nextSession);
      setSessionState(nextSession);
      updateState((current) => ({
        ...current,
        admins: current.admins.map((item) => (item.id === admin.id ? { ...item, lastLoginAt: new Date().toISOString() } : item)),
      }));
      writeAudit(admin.displayName, 'تسجيل دخول ناجح', 'security', SITE_METADATA.name, 'تم إنشاء جلسة إدارية جديدة.', 'success');
      return { ok: true };
    }

    const lockedUntil = registerFailedLoginAttempt();
    writeAudit('محاولة دخول', 'فشل تسجيل الدخول', 'security', SITE_METADATA.name, 'تعذر تسجيل الدخول بالبيانات الحالية.', 'danger');
    if (lockedUntil) {
      const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
      return { ok: false, message: `تم إيقاف المحاولات مؤقتًا. جرّب بعد ${minutes} دقيقة.` };
    }
    return { ok: false, message: 'بيانات الدخول غير صحيحة.' };
  };

  const logout = () => {
    if (session?.provider === 'firebase' && hasFirebaseConfig()) {
      void (async () => {
        try {
          const services = await getFirebaseServices();
          await services?.authModule.signOut(services.auth);
        } catch {
          // Ignore Firebase bridge failures and clear the session locally.
        }
      })();
    }
    saveSession(null);
    setSessionState(null);
    writeAudit(actorName, 'تسجيل خروج', 'security', SITE_METADATA.name, 'تم إنهاء الجلسة الإدارية الحالية.', 'info');
  };

  const hasPermission = (permission: string) => {
    if (!currentRole) return false;
    if (currentRole.id === 'super-admin') return true;
    return currentRole.permissions.includes(permission);
  };

  const addNote: AdminContextValue['addNote'] = (entityType, entityId, body) => {
    const noteBody = body.trim();
    if (!noteBody) return;
    const note: NoteRecord = {
      id: createId('note'),
      body: noteBody,
      createdAt: new Date().toISOString(),
      authorName: actorName,
    };

    updateState((current) => {
      const next = { ...current };
      if (entityType === 'users') {
        next.users = current.users.map((user) => (user.id === entityId ? { ...user, notes: [note, ...user.notes] } : user));
      }
      if (entityType === 'companies') {
        next.companies = current.companies.map((company) => (company.id === entityId ? { ...company, notes: [note, ...company.notes] } : company));
      }
      if (entityType === 'jobs') {
        next.jobs = current.jobs.map((job) => (job.id === entityId ? { ...job, notes: [note, ...job.notes] } : job));
      }
      if (entityType === 'applications') {
        next.applications = current.applications.map((application) =>
          application.id === entityId ? { ...application, notes: [note, ...application.notes] } : application,
        );
      }
      if (entityType === 'messages') {
        next.messages = current.messages.map((thread) =>
          thread.id === entityId ? { ...thread, internalNotes: [note, ...thread.internalNotes] } : thread,
        );
      }
      next.auditLogs = [
        createAdminAudit(actorName, 'إضافة ملاحظة إدارية', entityType, entityId, 'تمت إضافة ملاحظة داخلية جديدة.', 'info'),
        ...current.auditLogs,
      ];
      return next;
    });
  };

  const updateUserStatus: AdminContextValue['updateUserStatus'] = (userId, status) => {
    const targetAdmin = state.admins.find((admin) => admin.id === adminId) || null;
    if (
      targetAdmin?.roleId === 'super-admin' &&
      status === 'suspended' &&
      !state.admins.some((admin) => admin.id !== adminId && admin.roleId === 'super-admin' && admin.status === 'active')
    ) {
      writeAudit(actorName, 'حماية صلاحيات الوصول', 'admins', adminId, 'لا يمكن إيقاف آخر Super Admin نشط داخل النظام.', 'warning');
      return;
    }

    updateState((current) => ({
      ...current,
      users: current.users.map((user) => (user.id === userId ? { ...user, status } : user)),
      auditLogs: [
        createAdminAudit(
          actorName,
          'تحديث حالة مستخدم',
          'users',
          userId,
          `تم تغيير حالة الحساب إلى ${getStatusLabel(status)}.`,
          status === 'banned' ? 'warning' : 'success',
        ),
        ...current.auditLogs,
      ],
    }));

    return { ok: true };
  };

  const updateUserRole: AdminContextValue['updateUserRole'] = (userId, role) => {
    const targetAdmin = state.admins.find((admin) => admin.id === adminId) || null;
    if (
      roleId === 'super-admin' &&
      state.admins.some((admin) => admin.id !== adminId && admin.roleId === 'super-admin')
    ) {
      writeAudit(actorName, 'حماية صلاحيات الوصول', 'admins', adminId, 'لا يمكن تعيين أكثر من Super Admin واحد داخل النظام.', 'warning');
      return;
    }

    if (
      targetAdmin?.roleId === 'super-admin' &&
      roleId !== 'super-admin' &&
      !state.admins.some((admin) => admin.id !== adminId && admin.roleId === 'super-admin')
    ) {
      writeAudit(actorName, 'حماية صلاحيات الوصول', 'admins', adminId, 'لا يمكن إزالة دور آخر Super Admin داخل النظام.', 'warning');
      return;
    }

    updateState((current) => ({
      ...current,
      users: current.users.map((user) => (user.id === userId ? { ...user, role } : user)),
      auditLogs: [
        createAdminAudit(actorName, 'تغيير نوع الحساب', 'users', userId, `تم تغيير نوع الحساب إلى ${role}.`, 'warning'),
        ...current.auditLogs,
      ],
    }));
  };

  const toggleUserVerified = (userId: string) => {
    updateState((current) => ({
      ...current,
      users: current.users.map((user) => (user.id === userId ? { ...user, verified: !user.verified } : user)),
      auditLogs: [
        createAdminAudit(actorName, 'تبديل حالة التوثيق', 'users', userId, 'تم تحديث حالة توثيق الحساب.', 'info'),
        ...current.auditLogs,
      ],
    }));
  };

  const softDeleteUser = (userId: string) => {
    updateState((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === userId ? { ...user, deletedAt: new Date().toISOString(), status: 'archived' } : user,
      ),
      auditLogs: [
        createAdminAudit(actorName, 'أرشفة حساب', 'users', userId, 'تمت أرشفة الحساب بدلًا من حذفه نهائيًا.', 'warning'),
        ...current.auditLogs,
      ],
    }));
  };

  const restoreUser = (userId: string) => {
    updateState((current) => ({
      ...current,
      users: current.users.map((user) => (user.id === userId ? { ...user, deletedAt: null, status: 'active' } : user)),
      auditLogs: [
        createAdminAudit(actorName, 'استعادة حساب', 'users', userId, 'تمت استعادة الحساب بعد الأرشفة.', 'success'),
        ...current.auditLogs,
      ],
    }));
  };

  const updateCompanyStatus: AdminContextValue['updateCompanyStatus'] = (companyId, status) => {
    updateState((current) => ({
      ...current,
      companies: current.companies.map((company) => (company.id === companyId ? { ...company, status } : company)),
      auditLogs: [
        createAdminAudit(
          actorName,
          'تحديث حالة شركة',
          'companies',
          companyId,
          `تم تغيير حالة الشركة إلى ${getStatusLabel(status)}.`,
          status === 'restricted' ? 'warning' : 'success',
        ),
        ...current.auditLogs,
      ],
    }));
  };

  const toggleCompanyVerified = (companyId: string) => {
    updateState((current) => ({
      ...current,
      companies: current.companies.map((company) =>
        company.id === companyId ? { ...company, verified: !company.verified } : company,
      ),
      auditLogs: [
        createAdminAudit(actorName, 'تبديل توثيق شركة', 'companies', companyId, 'تم تحديث حالة توثيق الشركة.', 'info'),
        ...current.auditLogs,
      ],
    }));
  };

  const softDeleteCompany = (companyId: string) => {
    const targetCompany = state.companies.find((company) => company.id === companyId) || null;
    if (!targetCompany) return;

    const normalizedCompanyName = normalize(targetCompany.name);
    const relatedJobs = state.jobs.filter((job) => normalize(job.companyName) === normalizedCompanyName);
    const relatedApplications = state.applications.filter(
      (application) =>
        normalize(application.companyName) === normalizedCompanyName ||
        relatedJobs.some(
          (job) =>
            normalize(job.title) === normalize(application.jobTitle) &&
            normalize(job.companyName) === normalize(application.companyName),
        ),
    );

    updateState((current) => ({
      ...current,
      companies: current.companies.filter((company) => company.id !== companyId),
      jobs: current.jobs.filter((job) => normalize(job.companyName) !== normalizedCompanyName),
      applications: current.applications.filter(
        (application) =>
          normalize(application.companyName) !== normalizedCompanyName &&
          !relatedJobs.some(
            (job) =>
              normalize(job.title) === normalize(application.jobTitle) &&
              normalize(job.companyName) === normalize(application.companyName),
          ),
      ),
      auditLogs: [
        createAdminAudit(
          actorName,
          'حذف شركة نهائي',
          'companies',
          companyId,
          'تم حذف الشركة نهائيًا مع إزالة الوظائف والطلبات المرتبطة بها من النظام.',
          'warning',
        ),
        ...current.auditLogs,
      ],
    }));

    if (!hasFirebaseConfig()) return;

    void (async () => {
      try {
        const services = await getFirebaseServices();
        if (!services) return;

        const { db, firestoreModule } = services;
        const batch = firestoreModule.writeBatch(db);

        batch.delete(firestoreModule.doc(db, 'companies', companyId));

        relatedJobs.forEach((job) => {
          batch.delete(firestoreModule.doc(db, 'jobs', job.id));
        });

        relatedApplications.forEach((application) => {
          const requestId = String(application.requestId || application.id || '').trim();
          if (!requestId) return;
          batch.delete(firestoreModule.doc(db, 'applications', requestId));
          batch.delete(firestoreModule.doc(db, 'applicationTracking', requestId));
        });

        await batch.commit();
      } catch {
        writeAudit(
          actorName,
          'فشل حذف شركة نهائي',
          'companies',
          companyId,
          'تم حذف الشركة محليًا لكن تعذر حذفها من Firebase في هذه اللحظة.',
          'danger',
        );
      }
    })();
  };

  const restoreCompany = (companyId: string) => {
    updateState((current) => ({
      ...current,
      companies: current.companies.map((company) =>
        company.id === companyId
          ? {
              ...company,
              deletedAt: null,
              deletedBy: null,
              status: company.deletedStatusSnapshot || 'approved',
              deletedStatusSnapshot: null,
            }
          : company,
      ),
      jobs: current.jobs.map((job) => {
        const company = current.companies.find((item) => item.id === companyId);
        if (!company) return job;
        return normalize(job.companyName) === normalize(company.name) && job.deletedBy === 'admin'
          ? {
              ...job,
              deletedAt: null,
              deletedBy: null,
              status: job.deletedStatusSnapshot || 'approved',
              deletedStatusSnapshot: null,
              restoredByAdminAt: new Date().toISOString(),
            }
          : job;
      }),
      auditLogs: [
        createAdminAudit(actorName, 'استعادة شركة', 'companies', companyId, 'تمت استعادة الشركة والوظائف المرتبطة بها من جديد.', 'success'),
        ...current.auditLogs,
      ],
    }));
  };

  const saveCompany: AdminContextValue['saveCompany'] = (draft, companyId = null) => {
    const trimmedName = draft.name.trim();
    const trimmedEmail = draft.email.trim();
    const trimmedPhone = draft.phone.trim();
    const trimmedLandline = draft.landline.trim();
    const trimmedAddress = draft.address.trim();
    const trimmedSector = draft.sector.trim();
    const trimmedLocation = draft.location.trim();
    const trimmedSummary = draft.summary.trim();
    const trimmedWebsite = draft.website.trim();
    const nextSocialLinks = normalizeCompanySocialLinks(draft.socialLinks);
    const nextSiteMode = draft.siteMode === 'landing' ? 'landing' : 'full';
    const nextRestrictionMessage = draft.restrictionMessage.trim();
    const nextRestrictionAttachmentUrl = String(draft.restrictionAttachmentUrl || '').trim() || null;
    const nextRestrictionAttachmentName = String(draft.restrictionAttachmentName || '').trim();

    if (!trimmedName || !trimmedSector || !trimmedLocation) return null;

    const existingCompany = companyId
      ? state.companies.find((company) => company.id === companyId) || null
      : null;

    const nextCompanyId =
      existingCompany?.id ||
      `company-${normalize(trimmedName).replace(/[^a-z0-9]/g, '-') || createId('company')}`;
    const nextStatus = draft.status || existingCompany?.status || 'pending';
    const nextVerified = draft.verified ?? existingCompany?.verified ?? false;

    updateState((current) => {
      const previousName = existingCompany?.name || '';
      const nextCompanies = current.companies.some((company) => company.id === nextCompanyId)
        ? current.companies.map((company) =>
            company.id === nextCompanyId
              ? {
                  ...company,
                  name: trimmedName,
                  email: trimmedEmail,
                  phone: trimmedPhone,
                  landline: trimmedLandline,
                  address: trimmedAddress,
                  sector: trimmedSector,
                  location: trimmedLocation,
                  summary: trimmedSummary,
                  website: trimmedWebsite,
                  socialLinks: nextSocialLinks,
                  siteMode: nextSiteMode,
                  restrictionMessage: nextRestrictionMessage,
                  restrictionAttachmentUrl: nextRestrictionAttachmentUrl,
                  restrictionAttachmentName: nextRestrictionAttachmentName,
                  imageUrl: draft.imageUrl?.trim() || company.imageUrl || null,
                  logoLetter: pickInitial(trimmedName),
                  status: nextStatus,
                  verified: nextVerified,
                  deletedBy: null,
                  deletedStatusSnapshot: null,
                  deletedAt: null,
                }
              : company,
          )
        : [
            {
              id: nextCompanyId,
              name: trimmedName,
              email: trimmedEmail,
              phone: trimmedPhone,
              landline: trimmedLandline,
              address: trimmedAddress,
              sector: trimmedSector,
              location: trimmedLocation,
              summary: trimmedSummary,
              openings: 0,
              logoLetter: pickInitial(trimmedName),
              website: trimmedWebsite,
              socialLinks: nextSocialLinks,
              siteMode: nextSiteMode,
              restrictionMessage: nextRestrictionMessage,
              restrictionAttachmentUrl: nextRestrictionAttachmentUrl,
              restrictionAttachmentName: nextRestrictionAttachmentName,
              imageUrl: draft.imageUrl?.trim() || null,
              status: nextStatus,
              verified: nextVerified,
              notes: [],
              deletedBy: null,
              deletedStatusSnapshot: null,
              deletedAt: null,
            },
            ...current.companies,
          ];

      const shouldRenameReferences =
        previousName && normalize(previousName) !== normalize(trimmedName);

      return {
        ...current,
        companies: nextCompanies,
        jobs: shouldRenameReferences
          ? current.jobs.map((job) =>
              normalize(job.companyName) === normalize(previousName)
                ? { ...job, companyName: trimmedName }
                : job,
            )
          : current.jobs,
        applications: shouldRenameReferences
          ? current.applications.map((application) =>
              normalize(application.companyName) === normalize(previousName)
                ? { ...application, companyName: trimmedName }
                : application,
            )
          : current.applications,
        messages: shouldRenameReferences
          ? current.messages.map((thread) =>
              normalize(thread.companyName) === normalize(previousName)
                ? { ...thread, companyName: trimmedName }
                : thread,
            )
          : current.messages,
        auditLogs: [
          createAdminAudit(
            actorName,
            existingCompany ? 'تحديث بيانات شركة' : 'إضافة شركة جديدة',
            'companies',
            trimmedName,
            existingCompany
              ? 'تم حفظ التعديلات على بيانات الشركة داخل لوحة التحكم.'
              : 'تم إنشاء سجل شركة جديد داخل لوحة التحكم.',
            'success',
          ),
          ...current.auditLogs,
        ],
      };
    });

    return nextCompanyId;
  };

  const updateJobStatus: AdminContextValue['updateJobStatus'] = (jobId, status) => {
    updateState((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.id === jobId ? { ...job, status } : job)),
      auditLogs: [
        createAdminAudit(
          actorName,
          'مراجعة وظيفة',
          'jobs',
          jobId,
          `تم تغيير حالة الوظيفة إلى ${getStatusLabel(status)}.`,
          status === 'hidden' || status === 'rejected' ? 'warning' : 'success',
        ),
        ...current.auditLogs,
      ],
    }));
  };

  const toggleJobFeatured = (jobId: string) => {
    updateState((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.id === jobId ? { ...job, featured: !job.featured } : job)),
      auditLogs: [
        createAdminAudit(actorName, 'تحديث وظيفة مميزة', 'jobs', jobId, 'تم تحديث حالة الوظيفة المميزة لهذه الوظيفة.', 'info'),
        ...current.auditLogs,
      ],
    }));
  };

  const softDeleteJob = (jobId: string) => {
    const targetJob = state.jobs.find((job) => job.id === jobId) || null;
    if (!targetJob) return;

    const relatedApplications = state.applications.filter(
      (application) =>
        normalize(application.jobTitle) === normalize(targetJob.title) &&
        normalize(application.companyName) === normalize(targetJob.companyName),
    );

    updateState((current) => ({
      ...current,
      jobs: current.jobs.filter((job) => job.id !== jobId),
      applications: current.applications.filter(
        (application) =>
          !(
            normalize(application.jobTitle) === normalize(targetJob.title) &&
            normalize(application.companyName) === normalize(targetJob.companyName)
          ),
      ),
      auditLogs: [
        createAdminAudit(
          actorName,
          'حذف وظيفة نهائي',
          'jobs',
          jobId,
          'تم حذف الوظيفة نهائيًا مع إزالة الطلبات المرتبطة بها من النظام.',
          'warning',
        ),
        ...current.auditLogs,
      ],
    }));

    if (!hasFirebaseConfig()) return;

    void (async () => {
      try {
        const services = await getFirebaseServices();
        if (!services) return;

        const { db, firestoreModule } = services;
        const batch = firestoreModule.writeBatch(db);

        batch.delete(firestoreModule.doc(db, 'jobs', jobId));

        relatedApplications.forEach((application) => {
          const requestId = String(application.requestId || application.id || '').trim();
          if (!requestId) return;
          batch.delete(firestoreModule.doc(db, 'applications', requestId));
          batch.delete(firestoreModule.doc(db, 'applicationTracking', requestId));
        });

        await batch.commit();
      } catch {
        writeAudit(
          actorName,
          'فشل حذف وظيفة نهائي',
          'jobs',
          jobId,
          'تم حذف الوظيفة محليًا لكن تعذر حذفها من Firebase في هذه اللحظة.',
          'danger',
        );
      }
    })();
  };

  const restoreJob = (jobId: string) => {
    updateState((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              deletedAt: null,
              deletedBy: null,
              status: job.deletedStatusSnapshot || 'approved',
              deletedStatusSnapshot: null,
              restoredByAdminAt: new Date().toISOString(),
            }
          : job,
      ),
      auditLogs: [
        createAdminAudit(actorName, 'استعادة وظيفة', 'jobs', jobId, 'تمت استعادة الوظيفة لتظهر مرة أخرى داخل النظام.', 'success'),
        ...current.auditLogs,
      ],
    }));
  };

  const saveJob: AdminContextValue['saveJob'] = (draft, jobId = null) => {
    const trimmedTitle = draft.title.trim();
    const trimmedCompanyName = draft.companyName.trim();
    const trimmedLocation = draft.location.trim();
    const trimmedType = draft.type.trim();
    const trimmedSalary = draft.salary.trim();
    const trimmedSummary = draft.summary.trim();
    const trimmedSector = draft.sector.trim();

    if (!trimmedTitle || !trimmedCompanyName || !trimmedLocation) return null;

    const existingJob = jobId ? state.jobs.find((job) => job.id === jobId) || null : null;
    const nextJobId = existingJob?.id || createId('job');
    const nextApplicationEnabled = draft.applicationEnabled ?? existingJob?.applicationEnabled ?? true;

    updateState((current) => ({
      ...current,
      jobs: current.jobs.some((job) => job.id === nextJobId)
        ? current.jobs.map((job) =>
            job.id === nextJobId
              ? {
                  ...job,
                  title: trimmedTitle,
                  companyName: trimmedCompanyName,
                  location: trimmedLocation,
                  type: trimmedType || job.type,
                  salary: trimmedSalary || job.salary,
                  summary: trimmedSummary,
                  sector: trimmedSector || job.sector,
                  applicationEnabled: nextApplicationEnabled,
                  postedLabel: draft.postedLabel?.trim() || job.postedLabel || 'الآن',
                  status: draft.status || job.status,
                  featured: draft.featured ?? job.featured,
                  deletedBy: null,
                  deletedStatusSnapshot: null,
                  restoredByAdminAt: null,
                  deletedAt: null,
                }
              : job,
          )
        : [
            {
              id: nextJobId,
              title: trimmedTitle,
              companyName: trimmedCompanyName,
              location: trimmedLocation,
              type: trimmedType || 'دوام كامل',
              postedLabel: draft.postedLabel?.trim() || 'الآن',
              salary: trimmedSalary,
              summary: trimmedSummary,
              sector: trimmedSector,
              applicationEnabled: nextApplicationEnabled,
              featured: Boolean(draft.featured),
              status: draft.status || 'approved',
              applicantsCount: 0,
              notes: [],
              deletedBy: null,
              deletedStatusSnapshot: null,
              restoredByAdminAt: null,
              deletedAt: null,
            },
            ...current.jobs,
          ],
      auditLogs: [
        createAdminAudit(
          actorName,
          existingJob ? 'تحديث وظيفة' : 'إضافة وظيفة جديدة',
          'jobs',
          trimmedTitle,
          existingJob
            ? 'تم حفظ التعديلات على الوظيفة داخل لوحة التحكم.'
            : `تم إنشاء وظيفة جديدة مرتبطة بالشركة ${trimmedCompanyName}.`,
          'success',
        ),
        ...current.auditLogs,
      ],
    }));

    return nextJobId;
  };

  const updateApplicationStatus: AdminContextValue['updateApplicationStatus'] = (applicationId, status, rejectionReason = '') => {
    updateState((current) => ({
      ...current,
      applications: current.applications.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              status,
              rejectionReason: status === 'rejected' ? rejectionReason : '',
              respondedAt: ['interview', 'approved', 'accepted', 'rejected', 'hired'].includes(status)
                ? new Date().toISOString()
                : null,
            }
          : application,
      ),
      auditLogs: [
        createAdminAudit(
          actorName,
          'تحديث حالة طلب',
          'applications',
          applicationId,
          `تم تغيير حالة الطلب إلى ${getStatusLabel(status)}.`,
          'info',
        ),
        ...current.auditLogs,
      ],
    }));
  };

  const forwardApplication: AdminContextValue['forwardApplication'] = (applicationId, companyName) => {
    updateState((current) => ({
      ...current,
      applications: current.applications.map((application) =>
        application.id === applicationId ? { ...application, forwardedTo: companyName } : application,
      ),
      auditLogs: [
        createAdminAudit(actorName, 'إعادة توجيه طلب', 'applications', applicationId, `تمت إعادة توجيه الطلب إلى ${companyName}.`, 'warning'),
        ...current.auditLogs,
      ],
    }));
  };

  const updateSettings: AdminContextValue['updateSettings'] = (patch) => {
    updateState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...patch,
      },
      auditLogs: [
        createAdminAudit(actorName, 'تحديث إعدادات النظام', 'settings', SITE_METADATA.name, 'تم حفظ تعديل جديد في إعدادات النظام.', 'success'),
        ...current.auditLogs,
      ],
    }));

  };

  const updateContent: AdminContextValue['updateContent'] = (patch) => {
    updateState((current) => ({
      ...current,
      content: {
        ...current.content,
        ...patch,
      },
      auditLogs: [
        createAdminAudit(actorName, 'تحديث المحتوى', 'content', SITE_METADATA.name, 'تم تحديث جزء من محتوى الموقع الإداري.', 'success'),
        ...current.auditLogs,
      ],
    }));
  };

  const createRole: AdminContextValue['createRole'] = (name, description) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    updateState((current) => ({
      ...current,
      roles: [
        {
          id: `role-${normalize(trimmedName).replace(/[^a-z0-9]/g, '-') || createId('role')}`,
          name: trimmedName,
          description: description.trim() || 'دور مخصص تم إنشاؤه من داخل لوحة الأدمن.',
          locked: false,
          permissions: ['dashboard:view'],
        },
        ...current.roles,
      ],
      auditLogs: [
        createAdminAudit(actorName, 'إنشاء دور جديد', 'security', trimmedName, 'تم إنشاء دور جديد داخل Role Builder.', 'success'),
        ...current.auditLogs,
      ],
    }));
  };

  const toggleRolePermission: AdminContextValue['toggleRolePermission'] = (roleId, permission) => {
    updateState((current) => ({
      ...current,
      roles: current.roles.map((role) => {
        if (role.id !== roleId || role.locked) return role;
        const hasCurrentPermission = role.permissions.includes(permission);
        return {
          ...role,
          permissions: hasCurrentPermission
            ? role.permissions.filter((item) => item !== permission)
            : [...role.permissions, permission],
        };
      }),
      auditLogs: [
        createAdminAudit(actorName, 'تعديل مصفوفة الصلاحيات', 'security', roleId, `تم تحديث الصلاحية ${permission}.`, 'warning'),
        ...current.auditLogs,
      ],
    }));
  };

  const createAdminAccount: AdminContextValue['createAdminAccount'] = async (name, email, password, roleId) => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const passwordStrengthMessage = getPasswordStrengthMessage(password);
    const roleExists = state.roles.some((role) => role.id === roleId);
    const hasAnotherSuperAdmin = state.admins.some((admin) => admin.roleId === 'super-admin');

    if (!trimmedName) {
      return { ok: false, message: 'اكتب اسم المسؤول قبل إنشاء الحساب.' };
    }

    if (!trimmedEmail) {
      return { ok: false, message: 'اكتب البريد الإلكتروني للمسؤول.' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { ok: false, message: 'صيغة البريد الإلكتروني غير صحيحة.' };
    }

    if (passwordStrengthMessage) {
      return { ok: false, message: passwordStrengthMessage };
    }

    if (!roleExists) {
      return { ok: false, message: 'اختر دورًا صالحًا قبل الحفظ.' };
    }

    if (roleId === 'super-admin' && hasAnotherSuperAdmin) {
      return { ok: false, message: 'يوجد بالفعل Super Admin واحد داخل النظام، ويمكن إنشاء الحسابات الجديدة على الأدوار الداخلية فقط.' };
    }

    const alreadyExists = await Promise.all(
      state.admins.map(async (admin) => {
        const emailHash = await hashCredential(admin.salt, trimmedEmail);
        return emailHash === admin.emailHash;
      }),
    );

    if (alreadyExists.some(Boolean)) {
      return { ok: false, message: 'هذا البريد مستخدم بالفعل داخل لوحة التحكم.' };
    }

    const salt = createSalt();
    const emailHash = await hashCredential(salt, trimmedEmail);
    const passwordHash = await hashCredential(salt, password);

    updateState((current) => ({
      ...current,
      admins: [
        {
          id: createId('admin'),
          displayName: trimmedName,
          roleId,
          status: 'active',
          salt,
          emailHash,
          passwordHash,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
        },
        ...current.admins,
      ],
      auditLogs: [
        createAdminAudit(actorName, 'إنشاء أدمن جديد', 'admins', trimmedName, 'تم إنشاء حساب إداري جديد بصلاحيات مخصصة.', 'success'),
        ...current.auditLogs,
      ],
    }));

    return { ok: true };
  };

  const updateAdminStatus: AdminContextValue['updateAdminStatus'] = (adminId, status) => {
    if (currentAdmin?.id === adminId) {
      writeAudit(actorName, 'محاولة تعديل الحساب الذاتي', 'admins', adminId, 'تم منع تغيير حالة الحساب النشط نفسه.', 'warning');
      return;
    }

    const targetAdmin = state.admins.find((admin) => admin.id === adminId) || null;
    if (
      targetAdmin?.roleId === 'super-admin' &&
      status === 'suspended' &&
      !state.admins.some((admin) => admin.id !== adminId && admin.roleId === 'super-admin' && admin.status === 'active')
    ) {
      writeAudit(actorName, 'حماية صلاحيات الوصول', 'admins', adminId, 'لا يمكن إيقاف آخر Super Admin نشط داخل النظام.', 'warning');
      return;
    }

    updateState((current) => ({
      ...current,
      admins: current.admins.map((admin) => (admin.id === adminId ? { ...admin, status } : admin)),
      auditLogs: [
        createAdminAudit(
          actorName,
          'تحديث حالة حساب إداري',
          'admins',
          adminId,
          `تم تغيير حالة حساب الأدمن إلى ${getStatusLabel(status)}.`,
          status === 'suspended' ? 'warning' : 'success',
        ),
        ...current.auditLogs,
      ],
    }));
  };

  const updateAdminRole: AdminContextValue['updateAdminRole'] = (adminId, roleId) => {
    if (currentAdmin?.id === adminId) {
      writeAudit(actorName, 'محاولة تعديل الحساب الذاتي', 'admins', adminId, 'تم منع تغيير دور الحساب النشط نفسه.', 'warning');
      return;
    }

    const targetAdmin = state.admins.find((admin) => admin.id === adminId) || null;
    if (
      roleId === 'super-admin' &&
      state.admins.some((admin) => admin.id !== adminId && admin.roleId === 'super-admin')
    ) {
      writeAudit(actorName, 'حماية صلاحيات الوصول', 'admins', adminId, 'لا يمكن تعيين أكثر من Super Admin واحد داخل النظام.', 'warning');
      return;
    }

    if (
      targetAdmin?.roleId === 'super-admin' &&
      roleId !== 'super-admin' &&
      !state.admins.some((admin) => admin.id !== adminId && admin.roleId === 'super-admin')
    ) {
      writeAudit(actorName, 'حماية صلاحيات الوصول', 'admins', adminId, 'لا يمكن إزالة دور آخر Super Admin داخل النظام.', 'warning');
      return;
    }

    updateState((current) => ({
      ...current,
      admins: current.admins.map((admin) => (admin.id === adminId ? { ...admin, roleId } : admin)),
      auditLogs: [
        createAdminAudit(actorName, 'تحديث دور إداري', 'admins', adminId, `تم تغيير دور حساب الأدمن إلى ${roleId}.`, 'warning'),
        ...current.auditLogs,
      ],
    }));
  };

  const updateCurrentAdminProfile: AdminContextValue['updateCurrentAdminProfile'] = async (patch) => {
    if (!currentAdmin || !session) {
      return { ok: false, message: 'لا يوجد حساب إداري نشط.' };
    }

    const nextDisplayName = patch.displayName.trim();
    const nextEmail = patch.email.trim().toLowerCase();
    const currentPassword = patch.currentPassword;
    const nextPassword = patch.newPassword;
    const confirmPassword = patch.confirmPassword;
    const currentIdentifier = String(session.identifier || '').trim().toLowerCase();
    const hasExistingEmail = Boolean(currentIdentifier);
    const emailChanged = Boolean(nextEmail) && nextEmail !== currentIdentifier;
    const passwordChanged = Boolean(nextPassword.trim()) || Boolean(confirmPassword.trim());

    if (!nextDisplayName) {
      return { ok: false, message: 'اكتب الاسم الظاهر قبل الحفظ.' };
    }

    if (!nextEmail && hasExistingEmail) {
      return { ok: false, message: 'اكتب البريد الإلكتروني المسجل.' };
    }

    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return { ok: false, message: 'اكتب بريدًا إلكترونيًا صحيحًا.' };
    }

    if (emailChanged || passwordChanged) {
      if (!currentPassword.trim()) {
        return { ok: false, message: 'اكتب كلمة المرور الحالية لتأكيد التعديل.' };
      }

      const currentPasswordHash = await hashCredential(currentAdmin.salt, currentPassword);
      if (currentPasswordHash !== currentAdmin.passwordHash) {
        return { ok: false, message: 'كلمة المرور الحالية غير صحيحة.' };
      }
    }

    if (passwordChanged) {
      const passwordStrengthMessage = getPasswordStrengthMessage(nextPassword);
      if (passwordStrengthMessage) {
        return { ok: false, message: passwordStrengthMessage };
      }
      if (nextPassword !== confirmPassword) {
        return { ok: false, message: 'تأكيد كلمة المرور الجديدة غير متطابق.' };
      }
    }

    if (emailChanged) {
      const duplicateEmail = await Promise.all(
        state.admins
          .filter((admin) => admin.id !== currentAdmin.id)
          .map(async (admin) => {
            const emailHash = await hashCredential(admin.salt, nextEmail);
            return emailHash === admin.emailHash;
          }),
      );

      if (duplicateEmail.some(Boolean)) {
        return { ok: false, message: 'هذا البريد مستخدم بالفعل من حساب إداري آخر.' };
      }
    }

    const nextEmailHash = emailChanged ? await hashCredential(currentAdmin.salt, nextEmail) : currentAdmin.emailHash;
    const nextPasswordHash = passwordChanged ? await hashCredential(currentAdmin.salt, nextPassword) : currentAdmin.passwordHash;

    updateState((current) => ({
      ...current,
      admins: current.admins.map((admin) =>
        admin.id === currentAdmin.id
          ? {
              ...admin,
              displayName: nextDisplayName,
              emailHash: nextEmailHash,
              passwordHash: nextPasswordHash,
            }
          : admin,
      ),
      auditLogs: [
        createAdminAudit(
          nextDisplayName,
          'تحديث الحساب الشخصي',
          'admins',
          currentAdmin.id,
          'تم تحديث الاسم أو البريد أو كلمة المرور للحساب الحالي.',
          'success',
        ),
        ...current.auditLogs,
      ],
    }));

    const nextSession: AdminSession = {
      ...session,
      displayName: nextDisplayName,
      identifier: nextEmail,
    };

    saveSession(nextSession);
    setSessionState(nextSession);
    return { ok: true };
  };

  const setupPrimaryAdmin: AdminContextValue['setupPrimaryAdmin'] = async (name, email, password) => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const passwordStrengthMessage = getPasswordStrengthMessage(password);

    if (!trimmedName || !trimmedEmail) {
      return { ok: false, message: 'اكتب الاسم والبريد الإلكتروني قبل المتابعة.' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { ok: false, message: 'اكتب بريدًا إلكترونيًا صحيحًا.' };
    }

    if (passwordStrengthMessage) {
      return { ok: false, message: passwordStrengthMessage };
    }

    if (!isSetupRequired) {
      return { ok: false, message: 'تم إعداد لوحة الأدمن بالفعل.' };
    }

    const salt = createSalt();
    const emailHash = await hashCredential(salt, trimmedEmail);
    const passwordHash = await hashCredential(salt, password);
    const nextAdminId = createId('admin');

    updateState((current) => ({
      ...current,
      admins: [
        {
          id: nextAdminId,
          displayName: trimmedName,
          roleId: 'super-admin',
          status: 'active',
          salt,
          emailHash,
          passwordHash,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
        },
        ...current.admins,
      ],
      auditLogs: [
        createAdminAudit('إعداد أولي', 'إنشاء أول أدمن', 'admins', trimmedName, 'تم تجهيز أول حساب أدمن بصلاحيات Super Admin.', 'success'),
        ...current.auditLogs,
      ],
    }));

    const nextSession: AdminSession = {
      adminId: nextAdminId,
      displayName: trimmedName,
      identifier: trimmedEmail,
      roleId: 'super-admin',
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      remember: true,
    };

    saveSession(nextSession);
    setSessionState(nextSession);
    resetFailedLoginAttempts();
    return { ok: true };
  };

  const assignThread: AdminContextValue['assignThread'] = (threadId, adminId) => {
    updateState((current) => ({
      ...current,
      messages: current.messages.map((thread) => (thread.id === threadId ? { ...thread, assignedAdminId: adminId } : thread)),
      auditLogs: [
        createAdminAudit(actorName, 'تعيين محادثة', 'messages', threadId, adminId ? 'تم تعيين المحادثة لأحد أفراد الفريق.' : 'تم فك تعيين المحادثة.', 'info'),
        ...current.auditLogs,
      ],
    }));
  };

  const updateThreadStatus: AdminContextValue['updateThreadStatus'] = (threadId, status) => {
    updateState((current) => ({
      ...current,
      messages: current.messages.map((thread) => (thread.id === threadId ? { ...thread, status } : thread)),
      auditLogs: [
        createAdminAudit(
          actorName,
          'تحديث حالة محادثة',
          'messages',
          threadId,
          `تم ضبط حالة المحادثة إلى ${getStatusLabel(status)}.`,
          status === 'flagged' ? 'warning' : 'info',
        ),
        ...current.auditLogs,
      ],
    }));
  };

  const sendNotification: AdminContextValue['sendNotification'] = (audience, subject, body) => {
    const nextSubject = subject.trim();
    const nextBody = body.trim();
    if (!nextSubject || !nextBody) return;
    updateState((current) => ({
      ...current,
      sentNotifications: [
        {
          id: createId('notification'),
          audience,
          subject: nextSubject,
          body: nextBody,
          sentAt: new Date().toISOString(),
        },
        ...current.sentNotifications,
      ],
      auditLogs: [
        createAdminAudit(actorName, 'إرسال إشعار', 'notifications', nextSubject, `تم إرسال إشعار إلى فئة ${audience}.`, 'success'),
        ...current.auditLogs,
      ],
    }));
  };

  const saveWidgetPreferences: AdminContextValue['saveWidgetPreferences'] = (ids) => {
    updateState((current) => ({
      ...current,
      widgetPreferences: ids,
      auditLogs: [
        createAdminAudit(actorName, 'تخصيص بطاقات اللوحة', 'dashboard', SITE_METADATA.name, 'تم تغيير البطاقات الظاهرة في اللوحة الرئيسية.', 'info'),
        ...current.auditLogs,
      ],
    }));
  };

  const exportApplicationsCsv = () => {
    downloadCsv(
      'rahma-applications.csv',
      [
        ['الاسم', 'البريد', 'الهاتف', 'المدينة', 'الخبرة', 'الوظيفة', 'الشركة', 'الحالة', 'تاريخ التقديم'],
        ...state.applications.map((application) => [
          application.applicantName,
          application.applicantEmail,
          application.applicantPhone,
          application.city,
          application.experience,
          application.jobTitle,
          application.companyName,
          application.status,
          formatDate(application.submittedAt),
        ]),
      ],
    );
    writeAudit(actorName, 'تصدير الطلبات', 'applications', SITE_METADATA.name, 'تم تصدير ملف CSV لطلبات التوظيف.', 'success');
  };

  const exportAuditCsv = () => {
    downloadCsv(
      'rahma-audit-log.csv',
      [
        ['الفاعل', 'الإجراء', 'النوع', 'العنصر', 'التفاصيل', 'التاريخ'],
        ...state.auditLogs.map((log) => [
          log.actorName,
          log.action,
          log.entityType,
          log.entityLabel,
          log.details,
          formatDate(log.createdAt),
        ]),
      ],
    );
    writeAudit(actorName, 'تصدير السجل', 'security', SITE_METADATA.name, 'تم تصدير Audit Log بصيغة CSV.', 'success');
  };

  const refreshFromSite = () => {
    updateState((current) => syncExternalData(current));
  };

  const searchEverywhere: AdminContextValue['searchEverywhere'] = (query) => {
  const keyword = normalize(query);
  if (!keyword) return [];
  const rows = [
    ...state.users
      .filter((user) => ['company', 'admin'].includes(user.role))
      .map((user) => ({
        id: user.id,
        label: repairAdminUiValue(user.displayName),
        meta: getRoleLabel(user.role) + ' - ' + repairAdminUiValue(user.email || user.city || 'بدون بيانات'),
        path: '/users',
        permission: 'users:view',
      })),
    ...state.companies.map((company) => ({
      id: company.id,
      label: repairAdminUiValue(company.name),
      meta: repairAdminUiValue(company.sector) + ' - ' + repairAdminUiValue(company.location),
      path: '/companies',
      permission: 'companies:view',
    })),
    ...state.jobs.map((job) => ({
      id: job.id,
      label: repairAdminUiValue(job.title),
      meta: repairAdminUiValue(job.companyName) + ' - ' + repairAdminUiValue(job.location),
      path: '/jobs',
      permission: 'jobs:view',
    })),
    ...state.applications.map((application) => ({
      id: application.id,
      label: repairAdminUiValue(application.applicantName),
      meta: repairAdminUiValue(application.jobTitle) + ' - ' + repairAdminUiValue(application.companyName),
      path: '/applications',
      permission: 'applications:view',
    })),
    ...state.messages.map((thread) => ({
      id: thread.id,
      label: repairAdminUiValue(thread.title),
      meta: repairAdminUiValue(thread.participantName) + ' - ' + (thread.status === 'open' ? 'مفتوحة' : thread.status === 'closed' ? 'مغلقة' : 'تحتاج متابعة'),
      path: '/messages',
      permission: 'support:view',
    })),
  ];
  return rows
    .filter((row) => !row.permission || hasPermission(row.permission))
    .filter((row) => normalize(row.label + ' ' + row.meta).includes(keyword))
    .slice(0, 8);
};

  const value = useMemo<AdminContextValue>(
    () => ({
      state,
      session,
      currentAdmin,
      currentRole,
      isAuthenticated: Boolean(session && currentAdmin),
      isSetupRequired,
      login,
      setupPrimaryAdmin,
      logout,
      refreshFromSite,
      hasPermission,
      updateUserStatus,
      updateUserRole,
      toggleUserVerified,
      softDeleteUser,
      restoreUser,
      updateCompanyStatus,
      toggleCompanyVerified,
      softDeleteCompany,
      restoreCompany,
      saveCompany,
      updateJobStatus,
      toggleJobFeatured,
      softDeleteJob,
      restoreJob,
      saveJob,
      updateApplicationStatus,
      forwardApplication,
      addNote,
      updateSettings,
      updateContent,
      createRole,
      toggleRolePermission,
      createAdminAccount,
      updateAdminStatus,
      updateAdminRole,
      updateCurrentAdminProfile,
      assignThread,
      updateThreadStatus,
      sendNotification,
      saveWidgetPreferences,
      exportApplicationsCsv,
      exportAuditCsv,
      searchEverywhere,
    }),
    [state, session, currentAdmin, currentRole, isSetupRequired],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used inside AdminProvider');
  }
  return context;
}

export function getRoleLabel(role: PlatformUser['role']) {
  if (role === 'company') return 'شركة';
  if (role === 'admin') return 'أدمن';
  return 'مستخدم';
}

export function getUserSummary(user: PlatformUser) {
  if (user.role === 'company') return repairAdminUiValue(user.companyName || user.city || 'بدون بيانات');
  return repairAdminUiValue(user.city || user.email || 'لا توجد بيانات');
}

export function getStatusTone(status: string) {
  if (['approved', 'accepted', 'active', 'verified', 'hired'].includes(status)) return 'emerald';
  if (['restricted', 'banned', 'hidden', 'rejected', 'flagged'].includes(status)) return 'red';
  if (['pending', 'review', 'interview', 'archived', 'closed', 'suspended'].includes(status)) return 'amber';
  return 'slate';
}

export function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'نشط',
    suspended: 'موقوف',
    banned: 'محظور',
    archived: 'مؤرشف',
    approved: 'تمت الموافقة',
    pending: 'معلق',
    restricted: 'مقيد',
    hidden: 'مخفي',
    rejected: 'مرفوض',
    review: 'تحت المراجعة',
    interview: 'مقابلة',
    accepted: 'تم القبول',
    hired: 'تم التعيين',
    open: 'مفتوحة',
    closed: 'مغلقة',
    flagged: 'تحتاج متابعة',
  };
  return repairAdminUiValue(labels[status] || status);
}

export function getAuditSeverityLabel(severity: AuditLog['severity']) {
  const labels = {
    info: 'معلومة',
    success: 'نجاح',
    warning: 'تحذير',
    danger: 'خطر',
  };
  return labels[severity];
}

export function getDashboardMetrics(state: AdminState) {
  const activeUsers = state.users.filter(
    (user) => !user.deletedAt && user.status === 'active' && ['company', 'admin'].includes(user.role),
  ).length;
  const activeCompanies = state.companies.filter((company) => !company.deletedAt && company.status === 'approved').length;
  const publishedJobs = state.jobs.filter((job) => !job.deletedAt && job.status === 'approved').length;
  const newApplications = state.applications.filter((application) => ['pending', 'review', 'interview'].includes(application.status) && !application.deletedAt).length;
  const openMessages = state.messages.filter((thread) => thread.status === 'open').length;
  const flaggedMessages = state.messages.filter((thread) => thread.status === 'flagged').length;
  const reviewQueue = [
    ...state.companies.filter((company) => company.status === 'pending' && !company.deletedAt),
    ...state.jobs.filter((job) => job.status === 'pending' && !job.deletedAt),
    ...state.applications.filter((application) => ['pending', 'review', 'interview'].includes(application.status) && !application.deletedAt),
  ].length;

  return {
    activeUsers,
    activeCompanies,
    publishedJobs,
    newApplications,
    openMessages,
    flaggedMessages,
    reviewQueue,
  };
}

export function getReviewQueue(state: AdminState) {
  return [
    ...state.companies
      .filter((company) => company.status === 'pending' && !company.deletedAt)
      .map((company) => ({
        id: company.id,
        type: 'شركة',
        title: repairAdminUiValue(company.name),
        subtitle: repairAdminUiValue(company.sector),
        createdAt: relativeTime(state.auditLogs[0]?.createdAt || new Date().toISOString()),
        path: '/companies',
      })),
    ...state.jobs
      .filter((job) => job.status === 'pending' && !job.deletedAt)
      .map((job) => ({
        id: job.id,
        type: 'وظيفة',
        title: repairAdminUiValue(job.title),
        subtitle: repairAdminUiValue(job.companyName),
        createdAt: repairAdminUiValue(job.postedLabel),
        path: '/jobs',
      })),
    ...state.applications
      .filter((application) => ['pending', 'review', 'interview'].includes(application.status) && !application.deletedAt)
      .map((application) => ({
        id: application.id,
        type: 'طلب',
        title: repairAdminUiValue(application.applicantName),
        subtitle: repairAdminUiValue(application.jobTitle) + ' - ' + repairAdminUiValue(application.companyName),
        createdAt: relativeTime(application.submittedAt),
        path: '/applications',
        status: application.status,
        requestId: application.requestId,
        rejectionReason: repairAdminUiValue(application.rejectionReason),
      })),
    ...state.messages
      .filter((thread) => thread.status === 'flagged')
      .map((thread) => ({
        id: thread.id,
        type: 'رسالة',
        title: repairAdminUiValue(thread.title),
        subtitle: repairAdminUiValue(thread.participantName),
        createdAt: relativeTime(thread.lastMessageAt),
        path: '/messages',
      })),
  ].slice(0, 8);
}

export function getCharts(state: AdminState) {
  const monthly = state.applications.reduce<Record<string, number>>((acc, application) => {
    const date = new Date(application.submittedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const applicationTrend = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, total]) => ({
      name: month,
      applications: total,
      approved: state.applications.filter(
        (application) => application.submittedAt.startsWith(month) && ['approved', 'accepted', 'hired'].includes(application.status),
      ).length,
    }));

  const sectorDemand = state.companies.map((company) => ({
    name: company.sector,
    companies: 1,
    jobs: state.jobs.filter((job) => normalize(job.companyName) === normalize(company.name) && !job.deletedAt).length,
  }));

  return {
    applicationTrend,
    sectorDemand,
  };
}

export function humanDate(dateLike: string) {
  return formatDate(dateLike);
}

export function humanRelative(dateLike: string) {
  return relativeTime(dateLike);
}

