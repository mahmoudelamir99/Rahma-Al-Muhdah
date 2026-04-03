import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  UserCog,
  UsersRound,
} from 'lucide-react';
import type {
  ApplicationRecord,
  CompanyRecord,
  JobRecord,
  MessageThread,
  SystemSettings,
} from './admin-store';
import {
  cleanAdminText,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  getApplicationStatusLabel,
  getCompanyStatusLabel,
  getJobStatusLabel,
  getStatusTone,
  getThreadStatusLabel,
} from './admin-dashboard';

export const ADMIN_BRAND = {
  name: 'الرحمة المهداه للتوظيف',
  subtitle: 'نظام الإدارة التنفيذي',
  tagline: 'لوحة تحكم احترافية لإدارة الشركات والوظائف والطلبات',
  logoPath: '/logo-mark.png',
} as const;

export type AdminMainNavItem = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  permission?: string;
  description: string;
};

export const ADMIN_MAIN_NAV: AdminMainNavItem[] = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    path: '/dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard:view',
    description: 'نظرة تنفيذية شاملة على المنصة',
  },
  {
    id: 'companies',
    label: 'الشركات',
    path: '/companies',
    icon: Building2,
    permission: 'companies:view',
    description: 'إدارة الحسابات المؤسسية والتحقق',
  },
  {
    id: 'jobs',
    label: 'الوظائف',
    path: '/jobs',
    icon: BriefcaseBusiness,
    permission: 'jobs:view',
    description: 'الوظائف والحالات والتمييز والأرشفة',
  },
  {
    id: 'applications',
    label: 'المرشحون',
    path: '/applications',
    icon: UsersRound,
    permission: 'applications:view',
    description: 'مراجعة الطلبات وتحديث حالتها',
  },
  {
    id: 'reports',
    label: 'التقارير',
    path: '/reports',
    icon: BarChart3,
    permission: 'reports:view',
    description: 'الرسوم والتوجهات والتصدير',
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    path: '/settings',
    icon: Settings2,
    permission: 'settings:view',
    description: 'المحتوى، التشغيل، الصلاحيات، والإشعارات',
  },
];

export type SettingsSectionId =
  | 'general'
  | 'content'
  | 'roles'
  | 'admins'
  | 'notifications'
  | 'messages'
  | 'users';

export const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  route: string;
}> = [
  { id: 'general', label: 'إعدادات النظام', icon: Settings2, route: '/settings' },
  { id: 'content', label: 'إدارة المحتوى', icon: FileText, route: '/content' },
  { id: 'roles', label: 'الصلاحيات والأدوار', icon: ShieldCheck, route: '/roles' },
  { id: 'admins', label: 'فريق الإدارة', icon: UserCog, route: '/security' },
  { id: 'notifications', label: 'الإشعارات', icon: Bell, route: '/notifications' },
  { id: 'messages', label: 'الدعم والرسائل', icon: MessageSquareText, route: '/messages' },
  { id: 'users', label: 'المستخدمون', icon: UsersRound, route: '/users' },
];

export function text(value: unknown, fallback = 'غير متاح') {
  const cleaned = cleanAdminText(value);
  return cleaned.trim() || fallback;
}

export function companyStatusMeta(status: CompanyRecord['status']) {
  return {
    label: text(getCompanyStatusLabel(status)),
    tone: getStatusTone(status),
  };
}

export function jobStatusMeta(status: JobRecord['status']) {
  return {
    label: text(getJobStatusLabel(status)),
    tone: getStatusTone(status),
  };
}

export function applicationStatusMeta(status: ApplicationRecord['status']) {
  return {
    label: text(getApplicationStatusLabel(status)),
    tone: getStatusTone(status),
  };
}

export function threadStatusMeta(status: MessageThread['status']) {
  return {
    label: text(getThreadStatusLabel(status)),
    tone: getStatusTone(status),
  };
}

export function settingsToggleItems(settings: SystemSettings) {
  return [
    {
      key: 'companyRegistration',
      label: 'تسجيل الشركات',
      description: 'السماح بإنشاء حسابات شركات جديدة على المنصة.',
      value: settings.companyRegistration,
    },
    {
      key: 'jobApplications',
      label: 'استقبال الطلبات',
      description: 'تشغيل أو إيقاف التقديم على الوظائف من الموقع العام.',
      value: settings.jobApplications,
    },
    {
      key: 'fileUploads',
      label: 'رفع الملفات',
      description: 'السماح برفع السيرة الذاتية والمرفقات أثناء التقديم.',
      value: settings.fileUploads,
    },
    {
      key: 'maintenanceMode',
      label: 'وضع الصيانة',
      description: 'إظهار تنبيه الصيانة وإيقاف بعض التدفقات العامة لحين الانتهاء.',
      value: settings.maintenanceMode,
    },
  ] as const;
}

export const COMPANY_STATUS_FILTERS: Array<{ value: CompanyRecord['status'] | 'all'; label: string }> = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'approved', label: 'مفعلة' },
  { value: 'pending', label: 'قيد المراجعة' },
  { value: 'restricted', label: 'معطلة' },
  { value: 'archived', label: 'مؤرشفة' },
];

export const JOB_STATUS_FILTERS: Array<{ value: JobRecord['status'] | 'all'; label: string }> = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'approved', label: 'نشطة' },
  { value: 'pending', label: 'قيد المراجعة' },
  { value: 'hidden', label: 'مخفية' },
  { value: 'archived', label: 'مؤرشفة' },
  { value: 'rejected', label: 'مرفوضة' },
];

export const APPLICATION_STATUS_FILTERS: Array<{ value: ApplicationRecord['status'] | 'all'; label: string }> = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'pending', label: 'جديد' },
  { value: 'review', label: 'تحت المراجعة' },
  { value: 'interview', label: 'مقابلة' },
  { value: 'approved', label: 'مقبول مبدئيًا' },
  { value: 'accepted', label: 'مقبول' },
  { value: 'rejected', label: 'مرفوض' },
  { value: 'hired', label: 'تم التعيين' },
];

export const JOB_TYPE_OPTIONS = ['دوام كامل', 'دوام جزئي', 'هجين', 'عن بعد', 'عقد مؤقت'];

export function matchesQuery(haystack: Array<unknown>, query: string) {
  const keyword = text(query, '').trim().toLowerCase();
  if (!keyword) return true;
  return haystack.some((value) => text(value, '').toLowerCase().includes(keyword));
}

export function formatOpeningsLabel(value: number) {
  return `${formatNumber(value)} وظيفة`;
}

export function formatDateLabel(value: unknown) {
  return text(formatDate(value));
}

export function formatDateTimeLabel(value: unknown) {
  return text(formatDateTime(value));
}

export function formatRelativeLabel(value: unknown) {
  return text(formatRelativeTime(value));
}
