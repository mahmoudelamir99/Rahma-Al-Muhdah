import type {
  AdminState,
  ApplicationRecord,
  CompanyRecord,
  JobRecord,
  PlatformUser,
  RoleDefinition,
} from './admin-store';

export const JOB_STATUS_OPTIONS: Array<{ value: JobRecord['status']; label: string }> = [
  { value: 'approved', label: 'نشطة' },
  { value: 'pending', label: 'قيد المراجعة' },
  { value: 'hidden', label: 'مخفية' },
  { value: 'archived', label: 'مؤرشفة' },
  { value: 'rejected', label: 'مرفوضة' },
];

export const COMPANY_STATUS_OPTIONS: Array<{ value: CompanyRecord['status']; label: string }> = [
  { value: 'approved', label: 'معتمدة' },
  { value: 'pending', label: 'قيد المراجعة' },
  { value: 'restricted', label: 'مقيدة' },
  { value: 'archived', label: 'مؤرشفة' },
];

export const APPLICATION_STATUS_OPTIONS: Array<{ value: ApplicationRecord['status']; label: string }> = [
  { value: 'pending', label: 'جديد' },
  { value: 'review', label: 'تحت المراجعة' },
  { value: 'interview', label: 'مقابلة' },
  { value: 'approved', label: 'تمت الموافقة' },
  { value: 'accepted', label: 'تم القبول' },
  { value: 'rejected', label: 'مرفوض' },
  { value: 'hired', label: 'تم التعيين' },
];

export function formatDate(value: string | null | undefined) {
  if (!value) return 'غير متاح';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'غير متاح';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return 'غير متاح';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  const diffDays = Math.round(diffHours / 24);
  return `منذ ${diffDays} يوم`;
}

export function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    active: 'نشط',
    suspended: 'موقوف',
    banned: 'محظور',
    archived: 'مؤرشف',
    approved: 'معتمد',
    pending: 'جديد',
    restricted: 'مقيد',
    hidden: 'مخفي',
    rejected: 'مرفوض',
    review: 'تحت المراجعة',
    interview: 'مقابلة',
    accepted: 'تم القبول',
    hired: 'تم التعيين',
    open: 'مفتوحة',
    closed: 'مغلقة',
    flagged: 'تحتاج مراجعة',
  };
  return map[status] || status;
}

export function getStatusTone(status: string) {
  if (['approved', 'accepted', 'active', 'verified', 'hired'].includes(status)) return 'success';
  if (['interview'].includes(status)) return 'info';
  if (['restricted', 'banned', 'hidden', 'rejected', 'flagged'].includes(status)) return 'danger';
  if (['pending', 'review', 'archived', 'closed', 'suspended'].includes(status)) return 'warning';
  return 'neutral';
}

export function getRoleName(roleId: string, roles: RoleDefinition[]) {
  return roles.find((role) => role.id === roleId)?.name || roleId;
}

export function getUserRoleLabel(role: PlatformUser['role']) {
  if (role === 'company') return 'شركة';
  if (role === 'admin') return 'إدارة';
  return 'باحث عن عمل';
}

export function truncateText(value: string, max = 110) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export function getAverageResponseLabel(applications: ApplicationRecord[]) {
  const decided = applications.filter((application) => application.respondedAt);
  if (!decided.length) return 'غير متاح';
  const totalHours = decided.reduce((total, application) => {
    const submittedAt = new Date(application.submittedAt).getTime();
    const respondedAt = new Date(application.respondedAt || '').getTime();
    if (Number.isNaN(submittedAt) || Number.isNaN(respondedAt) || respondedAt <= submittedAt) return total;
    return total + (respondedAt - submittedAt) / 36e5;
  }, 0);
  const averageHours = totalHours / decided.length;
  if (averageHours < 24) return `${Math.max(1, Math.round(averageHours))} ساعة`;
  return `${Math.max(1, Math.round(averageHours / 24))} يوم`;
}

export function getDashboardSummary(state: AdminState) {
  const activeJobs = state.jobs.filter((job) => !job.deletedAt && job.status === 'approved').length;
  const pendingJobs = state.jobs.filter((job) => !job.deletedAt && job.status === 'pending').length;
  const activeCompanies = state.companies.filter((company) => !company.deletedAt && company.status === 'approved').length;
  const reviewCompanies = state.companies.filter((company) => !company.deletedAt && company.status === 'pending').length;
  const pendingApplications = state.applications.filter(
    (application) => !application.deletedAt && ['pending', 'review', 'interview'].includes(application.status),
  ).length;
  const rejectedApplications = state.applications.filter(
    (application) => !application.deletedAt && application.status === 'rejected',
  ).length;

  return {
    activeJobs,
    pendingJobs,
    activeCompanies,
    reviewCompanies,
    pendingApplications,
    rejectedApplications,
    averageResponse: getAverageResponseLabel(state.applications),
  };
}

export function getFunnelSteps(applications: ApplicationRecord[]) {
  const steps = [
    {
      key: 'submitted',
      label: 'تقديم الطلب',
      value: applications.filter((application) => !application.deletedAt).length,
    },
    {
      key: 'review',
      label: 'المراجعة الأولية',
      value: applications.filter((application) => !application.deletedAt && ['review', 'interview', 'approved', 'accepted', 'hired'].includes(application.status)).length,
    },
    {
      key: 'approved',
      label: 'المتقدمون الموافق عليهم',
      value: applications.filter((application) => !application.deletedAt && ['approved', 'accepted', 'hired'].includes(application.status)).length,
    },
    {
      key: 'hired',
      label: 'التعيين',
      value: applications.filter((application) => !application.deletedAt && application.status === 'hired').length,
    },
  ];

  const maxValue = Math.max(1, ...steps.map((step) => step.value));
  return steps.map((step) => ({
    ...step,
    width: `${Math.max(14, Math.round((step.value / maxValue) * 100))}%`,
  }));
}

export function getSystemHealth(state: AdminState) {
  return [
    {
      id: 'maintenance',
      label: 'وضع الصيانة',
      status: state.settings.maintenanceMode ? 'تنبيه' : 'مستقر',
      tone: state.settings.maintenanceMode ? 'warning' : 'success',
      details: state.settings.maintenanceMode ? 'الموقع العام في وضع الصيانة' : 'الموقع متاح للمستخدمين',
    },
    {
      id: 'applications',
      label: 'استقبال الطلبات',
      status: state.settings.jobApplications !== false ? 'نشط' : 'مغلق',
      tone: state.settings.jobApplications !== false ? 'success' : 'danger',
      details: state.settings.jobApplications !== false ? 'التقديم متاح حاليًا' : 'التقديم متوقف مؤقتًا',
    },
    {
      id: 'registration',
      label: 'تسجيل الشركات',
      status: state.settings.companyRegistration !== false ? 'نشط' : 'مغلق',
      tone: state.settings.companyRegistration !== false ? 'success' : 'warning',
      details: state.settings.companyRegistration !== false ? 'التسجيل مفتوح للشركات' : 'تم إيقاف التسجيل مؤقتًا',
    },
  ];
}

export function getPendingReviewCompanies(companies: CompanyRecord[]) {
  return companies
    .filter((company) => !company.deletedAt && company.status === 'pending')
    .slice(0, 4);
}

export function getTopCompanySectors(companies: CompanyRecord[]) {
  const counts = new Map<string, number>();
  companies
    .filter((company) => !company.deletedAt)
    .forEach((company) => {
      const sector = company.sector || 'غير محدد';
      counts.set(sector, (counts.get(sector) || 0) + 1);
    });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 4);
}
