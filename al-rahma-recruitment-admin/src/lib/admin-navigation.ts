import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  Image as ImageIcon,
  IdCard,
  LayoutDashboard,
  MessageSquare,
  Settings2,
  UsersRound,
} from 'lucide-react';

export type AdminNavItem = {
  id: string;
  name: string;
  path: string;
  icon: LucideIcon;
  permission?: string;
  summary: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: 'dashboard',
    name: 'لوحة التحكم',
    path: '/dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard:view',
    summary: 'نظرة تنفيذية على الشركات والوظائف والطلبات والأنشطة.',
  },
  {
    id: 'companies',
    name: 'الشركات',
    path: '/companies',
    icon: Building2,
    permission: 'companies:view',
    summary: 'إدارة الشركات والتفعيل والتحقق واللوجو.',
  },
  {
    id: 'jobs',
    name: 'الوظائف',
    path: '/jobs',
    icon: BriefcaseBusiness,
    permission: 'jobs:view',
    summary: 'إدارة الوظائف والحالات والتمييز والأرشفة.',
  },
  {
    id: 'applications',
    name: 'طلبات التوظيف',
    path: '/applications',
    icon: UsersRound,
    permission: 'applications:view',
    summary: 'مراجعة الطلبات وتحديث الحالات وأسباب الرفض.',
  },
  {
    id: 'candidates',
    name: 'المرشحون',
    path: '/candidates',
    icon: IdCard,
    permission: 'applications:view',
    summary: 'تعديل بيانات المتقدم أو حذف كل طلباته نهائيًا مع ربط اختياري لـ Supabase Auth.',
  },
  {
    id: 'reports',
    name: 'التقارير',
    path: '/reports',
    icon: BarChart3,
    permission: 'reports:view',
    summary: 'اتجاهات الأداء والتصدير وتحليل المنصة.',
  },
  {
    id: 'messages',
    name: 'الرسائل',
    path: '/messages',
    icon: MessageSquare,
    permission: 'support:view',
    summary: 'مراجعة الدعم والرسائل المفتوحة.',
  },
  {
    id: 'notifications',
    name: 'الإشعارات',
    path: '/notifications',
    icon: Bell,
    permission: 'notifications:send',
    summary: 'الإشعارات المرسلة والتنبيهات السريعة.',
  },
  {
    id: 'site-hero-bg',
    name: 'صورة خلفية الرئيسية',
    path: '/settings?tab=content',
    icon: ImageIcon,
    permission: 'settings:view',
    summary: 'رفع صورة خلفية خفيفة للصفحة الرئيسية (Ken Burns على الموقع العام).',
  },
  {
    id: 'settings',
    name: 'الإعدادات',
    path: '/settings',
    icon: Settings2,
    permission: 'settings:view',
    summary: 'إدارة النظام والمحتوى والصلاحيات.',
  },
];

export const HIDDEN_ROUTE_REDIRECTS: Record<string, string> = {
  '/content': '/settings',
  '/roles': '/settings',
  '/security': '/settings',
  '/users': '/settings',
};

export function getRequiredPermissionForPath(pathname: string) {
  const directMatch = ADMIN_NAV_ITEMS.find((item) => item.path === pathname);
  if (directMatch?.permission) return directMatch.permission;

  const redirectedPath = HIDDEN_ROUTE_REDIRECTS[pathname];
  return ADMIN_NAV_ITEMS.find((item) => item.path === redirectedPath)?.permission ?? null;
}

export function getRouteMeta(pathname: string) {
  const directMatch = ADMIN_NAV_ITEMS.find((item) => item.path === pathname);
  if (directMatch) return directMatch;

  const redirectedPath = HIDDEN_ROUTE_REDIRECTS[pathname];
  return ADMIN_NAV_ITEMS.find((item) => item.path === redirectedPath) || ADMIN_NAV_ITEMS[0];
}
