import type {
  AdminState,
  ApplicationRecord,
  AuditLog,
  CompanyRecord,
  JobRecord,
  MessageThread,
  RoleDefinition,
} from './admin-store';

const LEGACY_MOJIBAKE_PATTERN =
  /[\u00a1-\u00bf\u0192\u0152\u0153\u0161\u0178\u017e\u02c6\u200c\u201a\u201e\u2020\u2021\u2026\u2030\u2039\u203a\u06af\u06ba\u06be\u0679\u067e\u0686\u0691]/;
const LEGACY_MOJIBAKE_FRAGMENT_PATTERN =
  /(?:(?:ط|ظ)[\u0600-\u06ff]){2,}|[\u00a1-\u00bf\u0192\u0152\u0153\u0161\u0178\u017e\u02c6\u200c\u201a\u201e\u2020\u2021\u2026\u2030\u2039\u203a]{2,}/g;

let cp1256EncodingMap: Map<string, number> | null = null;

function countLegacyMojibakeChars(value: unknown) {
  return Array.from(String(value ?? '')).reduce(
    (total, character) => total + Number(LEGACY_MOJIBAKE_PATTERN.test(character)),
    0,
  );
}

function countLegacyMojibakePairs(value: unknown) {
  return (String(value ?? '').match(/(?:ط[اأإآء-ي]|ظ[اأإآء-ي])/g) || []).length;
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

export function cleanAdminText(value: unknown) {
  const rawValue = String(value ?? '');
  if (!shouldAttemptLegacyDecode(rawValue)) return rawValue;

  const encoderMap = getCp1256EncodingMap();
  if (!encoderMap.size) return rawValue;

  const repairLegacyMojibakeFragments = (text: string) =>
    text.replace(LEGACY_MOJIBAKE_FRAGMENT_PATTERN, (fragment) => decodeLegacyMojibakeCandidate(fragment, encoderMap));

  let bestValue = rawValue;
  let bestScore = getLegacySignalScore(rawValue);

  const considerCandidate = (candidate: string) => {
    if (!candidate || candidate === bestValue) return;

    const candidateScore = getLegacySignalScore(candidate);
    if (candidateScore < bestScore) {
      bestValue = candidate;
      bestScore = candidateScore;
    }
  };

  considerCandidate(decodeLegacyMojibakeCandidate(rawValue, encoderMap));
  considerCandidate(
    rawValue
      .split(/(\s+)/)
      .map((segment) => (/^\s+$/.test(segment) ? segment : decodeLegacyMojibakeCandidate(segment, encoderMap)))
      .join(''),
  );
  considerCandidate(repairLegacyMojibakeFragments(rawValue));

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

export function repairAdminUiValue(value: unknown) {
  return cleanAdminText(value);
}

function normalize(value: unknown) {
  return cleanAdminText(value).trim().toLowerCase();
}

function parseDateLike(value: unknown) {
  const rawValue = cleanAdminText(value);
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasMeaningfulValue(value: unknown) {
  return Boolean(normalize(value));
}

function hasMeaningfulSocialLinks(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some((entry) => hasMeaningfulValue(entry));
}

export function getSectorsSeries(state: AdminState): { key: string; label: string; value: number; color: string }[] {
  const counts: Record<string, number> = {};
  state.companies.forEach((company) => {
    if (company.status !== 'deleted') {
      const sector = company.sector || 'غير محدد';
      counts[sector] = (counts[sector] || 0) + 1;
    }
  });

  const colors = ['#18345c', '#005dac', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
  return Object.entries(counts)
    .map(([label, value], index) => ({
      key: label,
      label,
      value,
      color: colors[index % colors.length],
    }))
    .sort((a, b) => b.value - a.value);
}

export function getApplicationTrendsDetailed(state: AdminState) {
  // Mock logic for creating a 7-day trend if missing real history
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const today = new Date().getDay();
  
  return Array.from({ length: 7 }).map((_, i) => {
    const dayIndex = (today - (6 - i) + 7) % 7;
    return {
      name: days[dayIndex],
      value: Math.floor(Math.random() * 15) + 5, // Replace with real data logic when history is ready
    };
  });
}

function isRealCompanyRecord(company: CompanyRecord) {
  if (company.deletedAt || !hasMeaningfulValue(company.name)) return false;

  return (
    hasMeaningfulValue(company.email) ||
    hasMeaningfulValue(company.phone) ||
    hasMeaningfulValue(company.address) ||
    hasMeaningfulValue(company.location) ||
    hasMeaningfulValue(company.sector) ||
    hasMeaningfulValue(company.summary) ||
    hasMeaningfulValue(company.website) ||
    hasMeaningfulValue(company.imageUrl) ||
    hasMeaningfulSocialLinks(company.socialLinks) ||
    Number(company.openings || 0) > 0 ||
    (Array.isArray(company.notes) && company.notes.length > 0)
  );
}

function isRealJobRecord(job: JobRecord, validCompanyNames: Set<string>) {
  if (job.deletedAt || !hasMeaningfulValue(job.title) || !hasMeaningfulValue(job.companyName)) return false;

  const linkedToRealCompany = validCompanyNames.has(normalize(job.companyName));
  const hasStructuredData =
    hasMeaningfulValue(job.location) ||
    hasMeaningfulValue(job.type) ||
    hasMeaningfulValue(job.summary) ||
    hasMeaningfulValue(job.salary) ||
    hasMeaningfulValue(job.sector) ||
    Number(job.applicantsCount || 0) > 0 ||
    (Array.isArray(job.notes) && job.notes.length > 0);

  return linkedToRealCompany || hasStructuredData;
}

function buildJobIdentity(jobTitle: unknown, companyName: unknown) {
  return `${normalize(jobTitle)}::${normalize(companyName)}`;
}

function isRealApplicationRecord(
  application: ApplicationRecord,
  validCompanyNames: Set<string>,
  validJobKeys: Set<string>,
) {
  if (application.deletedAt || !hasMeaningfulValue(application.requestId || application.id)) return false;

  const hasApplicantIdentity =
    hasMeaningfulValue(application.applicantName) ||
    hasMeaningfulValue(application.applicantEmail) ||
    hasMeaningfulValue(application.applicantPhone);
  const hasLinkedEntity =
    validCompanyNames.has(normalize(application.companyName)) ||
    validJobKeys.has(buildJobIdentity(application.jobTitle, application.companyName));

  return hasApplicantIdentity && hasLinkedEntity;
}

function getRealCollections(state: AdminState) {
  const companies = state.companies.filter((company) => isRealCompanyRecord(company));
  const validCompanyNames = new Set(companies.map((company) => normalize(company.name)));
  const jobs = state.jobs.filter((job) => isRealJobRecord(job, validCompanyNames));
  const validJobKeys = new Set(jobs.map((job) => buildJobIdentity(job.title, job.companyName)));
  const applications = state.applications.filter((application) =>
    isRealApplicationRecord(application, validCompanyNames, validJobKeys),
  );

  return { companies, jobs, applications, validCompanyNames, validJobKeys };
}

export function getRealRecordCounts(state: AdminState) {
  const { companies, jobs, applications } = getRealCollections(state);
  return {
    companies: companies.length,
    jobs: jobs.length,
    applications: applications.length,
  };
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(date);
}

export function formatNumber(value: number | string) {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numericValue)) return cleanAdminText(value);
  return new Intl.NumberFormat('ar-EG').format(numericValue);
}

export function formatDate(value: unknown) {
  const date = parseDateLike(value);
  if (!date) return 'غير متاح';

  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(value: unknown) {
  const date = parseDateLike(value);
  if (!date) return 'غير متاح';

  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeTime(value: unknown) {
  const date = parseDateLike(value);
  if (!date) return 'غير متاح';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `منذ ${formatNumber(diffMinutes)} دقيقة`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `منذ ${formatNumber(diffHours)} ساعة`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `منذ ${formatNumber(diffDays)} يوم`;

  const diffMonths = Math.round(diffDays / 30);
  return `منذ ${formatNumber(diffMonths)} شهر`;
}

export function getJobStatusLabel(status: JobRecord['status'] | string) {
  const map: Record<string, string> = {
    approved: 'نشطة',
    pending: 'قيد المراجعة',
    hidden: 'مخفية',
    archived: 'مؤرشفة',
    rejected: 'مرفوضة',
  };

  return map[status] || cleanAdminText(status);
}

export function getCompanyStatusLabel(status: CompanyRecord['status'] | string) {
  const map: Record<string, string> = {
    approved: 'نشطة',
    pending: 'قيد المراجعة',
    restricted: 'موقوفة',
    archived: 'مؤرشفة',
  };

  return map[status] || cleanAdminText(status);
}

export function getApplicationStatusLabel(status: ApplicationRecord['status'] | string) {
  const map: Record<string, string> = {
    pending: 'جديد',
    review: 'تحت المراجعة',
    interview: 'مقابلة',
    approved: 'مقبول مبدئيًا',
    accepted: 'مقبول',
    rejected: 'مرفوض',
    hired: 'تم التعيين',
  };

  return map[status] || cleanAdminText(status);
}

export function getStatusTone(status: string) {
  if (['approved', 'accepted', 'hired', 'active', 'verified'].includes(status)) return 'success';
  if (['interview'].includes(status)) return 'info';
  if (['pending', 'review', 'restricted', 'archived'].includes(status)) return 'warning';
  if (['rejected', 'hidden', 'banned', 'closed'].includes(status)) return 'danger';
  return 'neutral';
}

export function getRoleName(roleId: string, roles: RoleDefinition[]) {
  return roles.find((role) => role.id === roleId)?.name || roleId;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function localizeAuditText(value: unknown) {
  const replacements: Array<[string, string]> = [
    ['تم ط¥ظ†هاء الجلسة الإدارية الحالية.', 'تم إنهاء الجلسة الإدارية الحالية.'],
    ['إظ†هاء', 'إنهاء'],
    ['ط¥ظ†هاء', 'إنهاء'],
    ['Super Admin', 'مدير النظام الرئيسي'],
    ['super-admin', 'مدير النظام الرئيسي'],
    ['platform-operator', 'مشرف التشغيل'],
    ['content-manager', 'محرر المحتوى'],
    ['support-manager', 'مسؤول الدعم'],
    ['auditor', 'مراجع داخلي'],
    ['approved', 'تمت الموافقة'],
    ['pending', 'قيد المراجعة'],
    ['review', 'تحت المراجعة'],
    ['accepted', 'مقبول'],
    ['rejected', 'مرفوض'],
    ['hired', 'تم التعيين'],
    ['archived', 'مؤرشف'],
    ['hidden', 'مخفي'],
    ['restricted', 'معطل'],
    ['active', 'نشط'],
    ['suspended', 'موقوف'],
    ['open', 'مفتوحة'],
    ['closed', 'مغلقة'],
    ['flagged', 'تحت المراجعة'],
  ];

  return replacements.reduce((text, [source, target]) => {
    const pattern = new RegExp(`(^|[^\\w-])(${escapeRegExp(source)})(?=$|[^\\w-])`, 'gi');
    return text.replace(pattern, (match, prefix) => `${prefix}${target}`);
  }, cleanAdminText(value));
}

function getAverageResponseDays(applications: ApplicationRecord[]) {
  const decided = applications.filter((application) => application.respondedAt && !application.deletedAt);
  if (!decided.length) return null;

  const totalHours = decided.reduce((total, application) => {
    const submittedAt = parseDateLike(application.submittedAt)?.getTime() ?? NaN;
    const respondedAt = parseDateLike(application.respondedAt)?.getTime() ?? NaN;
    if (Number.isNaN(submittedAt) || Number.isNaN(respondedAt) || respondedAt <= submittedAt) return total;
    return total + (respondedAt - submittedAt) / 36e5;
  }, 0);

  if (!totalHours) return null;
  return totalHours / decided.length / 24;
}

export function formatAverageResponse(applications: ApplicationRecord[]) {
  const days = getAverageResponseDays(applications);
  if (days === null) return 'غير متاح';
  return `${formatNumber(Math.max(1, Math.round(days)))} أيام`;
}

export function getDashboardMetrics(state: AdminState) {
  const { companies, jobs, applications } = getRealCollections(state);
  const recentThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const newApplications = applications.filter((application) => {
    const submittedAt = parseDateLike(application.submittedAt)?.getTime() ?? 0;
    return submittedAt >= recentThreshold;
  }).length;

  const acceptedStatuses = new Set<ApplicationRecord['status']>(['approved', 'accepted', 'hired']);

  return {
    companiesCount: companies.length,
    activeJobsCount: jobs.filter((job) => job.status === 'approved').length,
    newApplicationsCount: newApplications,
    reviewCount: applications.filter((application) => ['pending', 'review', 'interview'].includes(application.status)).length,
    acceptedCount: applications.filter((application) => acceptedStatuses.has(application.status)).length,
    rejectedCount: applications.filter((application) => application.status === 'rejected').length,
    averageResponseLabel: formatAverageResponse(applications),
  };
}

export function getTrendsSeries(state: AdminState) {
  const { jobs, applications } = getRealCollections(state);
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: formatMonthLabel(date),
      jobs: 0,
      applications: 0,
    };
  });

  const monthIndex = new Map(months.map((month, index) => [month.key, index]));

  jobs.forEach((job) => {
      const postedAt = parseDateLike(job.postedLabel);
      if (!postedAt) return;
      const key = `${postedAt.getFullYear()}-${postedAt.getMonth()}`;
      const index = monthIndex.get(key);
      if (index === undefined) return;
      months[index].jobs += 1;
    });

  applications.forEach((application) => {
      const submittedAt = parseDateLike(application.submittedAt);
      if (!submittedAt) return;
      const key = `${submittedAt.getFullYear()}-${submittedAt.getMonth()}`;
      const index = monthIndex.get(key);
      if (index === undefined) return;
      months[index].applications += 1;
    });

  return months;
}

export function getApplicationStatusSeries(state: AdminState) {
  const { applications } = getRealCollections(state);
  const statuses: Array<{ key: ApplicationRecord['status']; label: string; color: string }> = [
    { key: 'pending', label: 'جديد', color: '#d9b25f' },
    { key: 'review', label: 'تحت المراجعة', color: '#4d8bb7' },
    { key: 'interview', label: 'مقابلة', color: '#3b82f6' },
    { key: 'approved', label: 'مقبول مبدئيًا', color: '#3d6a7c' },
    { key: 'accepted', label: 'مقبول', color: '#2f9a63' },
    { key: 'rejected', label: 'مرفوض', color: '#d05757' },
    { key: 'hired', label: 'تم التعيين', color: '#1f6f57' },
  ];

  return statuses.map((status) => ({
    ...status,
    value: applications.filter((application) => application.status === status.key).length,
  }));
}

export function getCompaniesStatusSeries(state: AdminState) {
  const { companies } = getRealCollections(state);
  const statuses: Array<{ key: CompanyRecord['status']; label: string; color: string }> = [
    { key: 'approved', label: 'نشطة', color: '#2f9a63' },
    { key: 'pending', label: 'قيد المراجعة', color: '#d9b25f' },
    { key: 'restricted', label: 'موقوفة', color: '#d05757' },
    { key: 'archived', label: 'مؤرشفة', color: '#7f8b96' },
  ];

  return statuses.map((status) => ({
    ...status,
    value: companies.filter((company) => company.status === status.key).length,
  }));
}

export function getActivityFeed(state: AdminState) {
  const auditLogs = state.auditLogs
    .slice()
    .filter((log) => !normalize(log.action).includes('demo'))
    .sort((first, second) => {
      const firstDate = parseDateLike(first.createdAt)?.getTime() ?? 0;
      const secondDate = parseDateLike(second.createdAt)?.getTime() ?? 0;
      return secondDate - firstDate;
    })
    .slice(0, 8)
    .map((log) => {
      const title = localizeAuditText(log.action);
      const description = localizeAuditText(log.details || log.entityLabel);
      const normalizedAction = normalize(log.action);
      const isBootstrapAdminLog =
        normalize(log.entityType) === 'admins' &&
        /super admin/i.test(String(log.details || '')) &&
        (countLegacyMojibakeChars(log.action) > 0 || countLegacyMojibakeChars(log.details || '') > 0);
      const isSuccessfulLoginLog = normalizedAction.includes('تسجيل دخول') && log.severity === 'success';

      return {
        id: log.id,
        title: isBootstrapAdminLog ? 'إنشاء أول أدمن' : isSuccessfulLoginLog ? 'تسجيل دخول ناجح' : title,
        description: isBootstrapAdminLog
          ? 'تم تجهيز أول حساب أدمن بصلاحيات Super Admin.'
          : isSuccessfulLoginLog
            ? 'تم إنشاء جلسة إدارية جديدة.'
            : description,
        meta: formatRelativeTime(log.createdAt),
        tone: log.severity,
      };
    });

  if (auditLogs.length) return auditLogs;

  const { applications } = getRealCollections(state);

  const fallbacks = applications
    .slice()
    .sort((first, second) => {
      const firstDate = parseDateLike(first.submittedAt)?.getTime() ?? 0;
      const secondDate = parseDateLike(second.submittedAt)?.getTime() ?? 0;
      return secondDate - firstDate;
    })
    .slice(0, 8)
    .map((application) => ({
      id: application.id,
      title: `طلب جديد من ${cleanAdminText(application.applicantName || application.requestId)}`,
      description: `${cleanAdminText(application.jobTitle)} لدى ${cleanAdminText(application.companyName)}`,
      meta: formatRelativeTime(application.submittedAt),
      tone: 'info',
    }));

  return fallbacks;
}

export function getNotificationSummary(state: AdminState) {
  const { companies, jobs, applications } = getRealCollections(state);
  const reviewApplications = applications.filter((application) => ['pending', 'review', 'interview'].includes(application.status));
  const pendingCompanies = companies.filter((company) => company.status === 'pending');
  const pendingJobs = jobs.filter((job) => job.status === 'pending');
  const openThreads = state.messages.filter((thread) => thread.status !== 'closed');
  const firstReviewApplication = reviewApplications[0];
  const firstPendingCompany = pendingCompanies[0];
  const firstPendingJob = pendingJobs[0];
  const firstOpenThread = openThreads[0];

  const items = [
    {
      id: 'applications',
      label: 'طلبات تحتاج مراجعة',
      value: reviewApplications.length,
      description: 'تنقلك مباشرة إلى قائمة الطلبات الجديدة وتحت المراجعة.',
      path: firstReviewApplication ? `/applications?applicationId=${encodeURIComponent(firstReviewApplication.id)}` : '/applications',
    },
    {
      id: 'companies',
      label: 'شركات بانتظار التحقق',
      value: pendingCompanies.length,
      description: 'تنقلك إلى الشركات التي ما زالت قيد المراجعة أو التفعيل.',
      path: firstPendingCompany ? `/companies?companyId=${encodeURIComponent(firstPendingCompany.id)}` : '/companies',
    },
    {
      id: 'jobs',
      label: 'وظائف معلقة',
      value: pendingJobs.length,
      description: 'تنقلك إلى الوظائف التي تحتاج قرار نشر أو تعديل.',
      path: firstPendingJob ? `/jobs?jobId=${encodeURIComponent(firstPendingJob.id)}` : '/jobs',
    },
    {
      id: 'threads',
      label: 'محادثات مفتوحة',
      value: openThreads.length,
      description: 'تنقلك إلى صفحة الطلبات لمتابعة الرسائل والطلبات المرتبطة.',
      path: firstOpenThread ? `/applications?applicationId=${encodeURIComponent(firstOpenThread.applicationId)}` : '/applications',
    },
  ].filter((item) => item.value > 0);

  return {
    total: items.reduce((total, item) => total + item.value, 0),
    items,
  };
}

export function getTopCompanies(state: AdminState) {
  const { companies, jobs } = getRealCollections(state);

  return companies
    .map((company) => {
      const companyName = normalize(company.name);
      const liveJobsCount = jobs.filter(
        (job) => normalize(job.companyName) === companyName && job.status === 'approved' && !job.deletedAt,
      ).length;

      return {
        ...company,
        openings: liveJobsCount,
      };
    })
    .filter((company) => company.openings > 0)
    .sort((first, second) => second.openings - first.openings)
    .slice(0, 5);
}

export function getTopJobs(state: AdminState) {
  const { jobs, applications } = getRealCollections(state);

  return jobs
    .map((job) => {
      const liveApplicantsCount = applications.filter(
        (application) =>
          normalize(application.jobTitle) === normalize(job.title) &&
          normalize(application.companyName) === normalize(job.companyName) &&
          !application.deletedAt,
      ).length;

      return {
        ...job,
        applicantsCount: liveApplicantsCount,
      };
    })
    .filter((job) => job.applicantsCount > 0)
    .sort((first, second) => second.applicantsCount - first.applicantsCount)
    .slice(0, 5);
}

export function getThreadStatusLabel(status: MessageThread['status']) {
  const map = {
    open: 'مفتوحة',
    closed: 'مغلقة',
    flagged: 'تحتاج تدخل',
  };

  return map[status] || cleanAdminText(status);
}

export function buildRoleSummary(role: RoleDefinition) {
  return `${formatNumber(role.permissions.length)} صلاحية`;
}

export function getAuditExportRows(auditLogs: AuditLog[]) {
  return auditLogs.map((log) => ({
    الوقت: formatDateTime(log.createdAt),
    المنفذ: cleanAdminText(log.actorName),
    الإجراء: localizeAuditText(log.action),
    النوع: cleanAdminText(log.entityType),
    الكيان: cleanAdminText(log.entityLabel),
    التفاصيل: localizeAuditText(log.details),
  }));
}
