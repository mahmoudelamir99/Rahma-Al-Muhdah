import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Clock3,
  FileCheck2,
  FileText,
  RefreshCcw,
  UserCheck2,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminPanel,
  AdminResponsiveChart,
} from '../components/ui/admin-kit';
import {
  cleanAdminText,
  formatNumber,
  formatRelativeTime,
  getActivityFeed,
  getApplicationStatusSeries,
  getCompaniesStatusSeries,
  getDashboardMetrics,
  getTopCompanies,
  getTrendsSeries,
} from '../lib/admin-dashboard';
import { useAdmin } from '../lib/admin-store';

const STATUS_CARDS = [
  {
    key: 'review',
    label: 'تحت المراجعة',
    color: 'warning' as const,
  },
  {
    key: 'accepted',
    label: 'المقبولة',
    color: 'success' as const,
  },
  {
    key: 'rejected',
    label: 'المرفوضة',
    color: 'danger' as const,
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { state, refreshFromSite, hasPermission } = useAdmin();

  useEffect(() => {
    refreshFromSite();
    const intervalId = window.setInterval(() => refreshFromSite(), 20000);
    return () => window.clearInterval(intervalId);
  }, [refreshFromSite]);

  const metrics = useMemo(() => getDashboardMetrics(state), [state]);
  const trends = useMemo(() => getTrendsSeries(state), [state]);
  const applicationsStatus = useMemo(() => getApplicationStatusSeries(state), [state]);
  const companiesStatus = useMemo(() => getCompaniesStatusSeries(state), [state]);
  const activityFeed = useMemo(() => getActivityFeed(state).slice(0, 5), [state]);
  const topCompanies = useMemo(() => getTopCompanies(state).slice(0, 4), [state]);

  const quickActions = [
    {
      id: 'new-job',
      label: 'نشر وظيفة جديدة',
      path: '/jobs',
      allowed: hasPermission('jobs:view'),
    },
    {
      id: 'review-applications',
      label: 'مراجعة الطلبات المعلقة',
      path: '/applications',
      allowed: hasPermission('applications:view'),
    },
    {
      id: 'new-company',
      label: 'دعوة شركة جديدة',
      path: '/companies',
      allowed: hasPermission('companies:view'),
    },
    {
      id: 'monthly-report',
      label: 'إعداد تقرير شهري',
      path: '/reports',
      allowed: hasPermission('reports:view'),
    },
  ].filter((action) => action.allowed);

  return (
    <div className="space-y-5">
      <section className="rm-dashboard-hero">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[clamp(1.9rem,3vw,2.6rem)] font-black text-white">لوحة التحكم التنفيذية</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[rgba(231,239,248,0.82)] md:text-[0.98rem]">
              رؤية تشغيلية مباشرة لحركة الشركات والوظائف والطلبات وآخر الأنشطة داخل منصة الرحمة المهداه للتوظيف.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminButton variant="secondary" onClick={refreshFromSite}>
              <RefreshCcw size={16} />
              تحديث البيانات
            </AdminButton>
            <AdminButton variant="ghost" className="border-white/15 bg-white/10 text-white hover:bg-white/16" onClick={() => navigate('/applications')}>
              <ArrowLeft size={16} />
              فتح الطلبات الجديدة
            </AdminButton>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'إجمالي الشركات',
            value: formatNumber(metrics.companiesCount),
            icon: Building2,
          },
          {
            label: 'الوظائف النشطة',
            value: formatNumber(metrics.activeJobsCount),
            icon: BriefcaseBusiness,
          },
          {
            label: 'الطلبات الجديدة',
            value: formatNumber(metrics.newApplicationsCount),
            icon: FileText,
          },
          {
            label: 'متوسط وقت الاستجابة',
            value: metrics.averageResponseLabel,
            icon: Clock3,
          },
        ].map((item, index) => (
          <motion.article
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.26 }}
            className="rm-executive-stat"
          >
            <div className="space-y-2">
              <div className="text-[1.02rem] font-black text-[#132746]">{item.label}</div>
              <div className="text-[clamp(2rem,3vw,2.8rem)] font-black leading-none text-[#11213d]">{item.value}</div>
            </div>
            <div className="rm-executive-stat__icon">
              <item.icon size={22} />
            </div>
          </motion.article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.6fr_0.9fr]">
        <AdminPanel title="إجراءات سريعة" description="اختصارات سريعة للوصول إلى أهم العمليات اليومية.">
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <motion.button
                key={action.id}
                type="button"
                onClick={() => navigate(action.path)}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + index * 0.05, duration: 0.22 }}
                className="rm-dashboard-action"
              >
                {action.label}
              </motion.button>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="اتجاهات التوظيف (آخر 6 أشهر)" description="متابعة حركة الوظائف المنشورة والتقديمات الواردة عبر المنصة.">
          {trends.some((item) => item.jobs || item.applications) ? (
            <AdminResponsiveChart className="h-[380px]">
              {({ width, height }) => (
                <LineChart width={width} height={height} data={trends} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(24,37,63,0.08)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#596f88', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#596f88', fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatNumber(value), name === 'jobs' ? 'الوظائف' : 'التقديمات']}
                    contentStyle={{
                      borderRadius: 18,
                      border: '1px solid rgba(24,37,63,0.08)',
                      boxShadow: '0 20px 40px rgba(18,30,54,0.12)',
                    }}
                  />
                  <Line type="monotone" dataKey="jobs" stroke="#16284c" strokeWidth={3.4} dot={{ r: 4.5, fill: '#16284c' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="applications" stroke="#3f9a9a" strokeWidth={3.4} dot={{ r: 4.5, fill: '#3f9a9a' }} activeDot={{ r: 6 }} />
                </LineChart>
              )}
            </AdminResponsiveChart>
          ) : (
            <AdminEmptyState
              title="لا توجد بيانات اتجاهات كافية"
              description="بمجرد وجود وظائف أو طلبات فعلية بتاريخ واضح، سيظهر الرسم البياني هنا تلقائيًا."
            />
          )}
        </AdminPanel>

        <AdminPanel title="الأنشطة الأخيرة" description="آخر العمليات المؤثرة داخل لوحة التحكم والموقع.">
          {activityFeed.length ? (
            <div className="space-y-4">
              {activityFeed.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + index * 0.04, duration: 0.2 }}
                  className="border-b border-[rgba(24,37,63,0.08)] pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[#6aa8b0]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-[#122341]">{item.title}</div>
                      <p className="mt-1 text-sm leading-7 text-[#6a7c91]">{item.description}</p>
                      <div className="mt-2 text-xs text-[#8a98aa]">{item.meta}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="لا توجد أنشطة بعد" description="ستظهر أحدث العمليات هنا بمجرد بدء الإدارة الفعلية من اللوحة." />
          )}
        </AdminPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel title="حالات الطلبات" description="توزيع الطلبات بين تحت المراجعة والمقبولة والمرفوضة.">
          {applicationsStatus.some((item) => item.value > 0) ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.92fr]">
              <AdminResponsiveChart className="h-[250px]">
                {({ width, height }) => (
                  <PieChart width={width} height={height}>
                    <Pie data={applicationsStatus} dataKey="value" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={2}>
                      {applicationsStatus.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                  </PieChart>
                )}
              </AdminResponsiveChart>
              <div className="space-y-3">
                {STATUS_CARDS.map((status) => {
                  const match = applicationsStatus.find((item) => item.key === status.key);
                  return (
                    <div key={status.key} className="flex items-center justify-between rounded-[1.15rem] border border-[rgba(24,37,63,0.08)] bg-[#fafcff] px-4 py-3">
                      <span className="text-sm font-bold text-[#17304f]">{status.label}</span>
                      <AdminBadge tone={status.color}>{formatNumber(match?.value || 0)}</AdminBadge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <AdminEmptyState title="لا توجد طلبات بعد" description="عند استقبال أول طلب حقيقي ستظهر الحالات هنا بشكل بصري واضح." />
          )}
        </AdminPanel>

        <div className="grid gap-5">
          <AdminPanel title="أفضل الشركات نشاطًا" description="مرتبة بعدد الوظائف المفتوحة الحالية لكل شركة.">
            {topCompanies.length ? (
              <div className="space-y-3">
                {topCompanies.map((company) => (
                  <div key={company.id} className="flex items-center justify-between rounded-[1.15rem] bg-[#f8fafc] px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-[#10213d]">{cleanAdminText(company.name)}</div>
                      <div className="mt-1 text-xs text-[#73849a]">{cleanAdminText(company.location || company.sector || 'بدون تفاصيل')}</div>
                    </div>
                    <AdminBadge tone="info">{formatNumber(company.openings)} وظيفة</AdminBadge>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState title="لا توجد شركات مضافة" description="أضف أو فعّل الشركات لتظهر هنا الشركات الأكثر نشاطًا." />
            )}
          </AdminPanel>

          <AdminPanel title="حالة الشركات" description="التوزيع الحالي لحالات الشركات داخل المنصة.">
          {companiesStatus.some((item) => item.value > 0) ? (
              <AdminResponsiveChart className="h-[250px]">
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={companiesStatus} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(24,37,63,0.08)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#73849a', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#73849a', fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {companiesStatus.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </AdminResponsiveChart>
            ) : (
              <AdminEmptyState title="لا توجد حالات معروضة" description="أضف شركات أو فعّل بياناتها لتظهر هنا." />
            )}
          </AdminPanel>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'تحت المراجعة', value: metrics.reviewCount, tone: 'warning' as const },
          { label: 'المقبولة', value: metrics.acceptedCount, tone: 'success' as const },
          { label: 'المرفوضة', value: metrics.rejectedCount, tone: 'danger' as const },
        ].map((metric) => (
          <div key={metric.label} className="flex items-center justify-between rounded-[1.4rem] border border-[rgba(24,37,63,0.08)] bg-white px-4 py-4 shadow-[0_16px_30px_rgba(18,30,54,0.05)]">
            <div>
              <div className="text-sm font-black text-[#10213d]">{metric.label}</div>
              <div className="mt-1 text-xs text-[#74859a]">محدثة لحظيًا من بيانات المنصة</div>
            </div>
            <AdminBadge tone={metric.tone}>{formatNumber(metric.value)}</AdminBadge>
          </div>
        ))}
      </section>
    </div>
  );
}
