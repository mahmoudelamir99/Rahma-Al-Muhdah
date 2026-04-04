import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Download,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminResponsiveChart,
  AdminStatCard,
} from '../components/ui/admin-kit';
import {
  cleanAdminText,
  formatNumber,
  getActivityFeed,
  getApplicationStatusSeries,
  getCompaniesStatusSeries,
  getDashboardMetrics,
  getTopCompanies,
  getTopJobs,
  getTrendsSeries,
} from '../lib/admin-dashboard';
import { useAdmin } from '../lib/admin-store';

export default function Reports() {
  const { state, exportApplicationsCsv, exportAuditCsv, refreshFromSite } = useAdmin();

  useEffect(() => {
    refreshFromSite();
    const intervalId = window.setInterval(() => refreshFromSite(), 20000);
    return () => window.clearInterval(intervalId);
  }, [refreshFromSite]);

  const metrics = useMemo(() => getDashboardMetrics(state), [state]);
  const statusSeries = useMemo(() => getApplicationStatusSeries(state), [state]);
  const companiesSeries = useMemo(() => getCompaniesStatusSeries(state), [state]);
  const activityFeed = useMemo(() => getActivityFeed(state), [state]);
  const topCompanies = useMemo(() => getTopCompanies(state), [state]);
  const topJobs = useMemo(() => getTopJobs(state), [state]);
  const trends = useMemo(() => getTrendsSeries(state), [state]);

  return (
    <>
      <AdminPageHeader
        eyebrow="التقارير"
        title="تحليل الأداء وتصدير البيانات"
        description="نظرة مجمعة على توزيع الحالات، اتجاهات التقديم، أفضل الشركات والوظائف، مع تصدير مباشر للتقديمات وسجل التدقيق."
        actions={
          <>
            <AdminButton variant="secondary" onClick={exportApplicationsCsv}>
              <FileSpreadsheet size={16} />
              تصدير التقديمات
            </AdminButton>
            <AdminButton onClick={exportAuditCsv}>
              <Download size={16} />
              تصدير سجل التدقيق
            </AdminButton>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="كل الشركات" value={formatNumber(metrics.companiesCount)} helper="إجمالي السجلات الحالية" icon={Building2} tone="secondary" />
        <AdminStatCard label="كل الوظائف" value={formatNumber(state.jobs.filter((job) => !job.deletedAt).length)} helper="تشمل كل الحالات" icon={BriefcaseBusiness} tone="primary" />
        <AdminStatCard label="كل الطلبات" value={formatNumber(state.applications.filter((item) => !item.deletedAt).length)} helper="مرتبطة بالموقع مباشرة" icon={BarChart3} tone="accent" />
        <AdminStatCard label="سجل التدقيق" value={formatNumber(state.auditLogs.length)} helper="آخر عمليات الإدارة" icon={ShieldCheck} tone="success" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel title="توزيع حالات الطلبات" description="الأعداد الحالية حسب نتيجة أو مرحلة كل طلب.">
          {statusSeries.some((item) => item.value > 0) ? (
            <AdminResponsiveChart className="h-[320px]">
              {({ width, height }) => (
                <BarChart width={width} height={height} data={statusSeries} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(24,37,63,0.08)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#73849a', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#73849a', fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {statusSeries.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </AdminResponsiveChart>
          ) : (
            <AdminEmptyState title="لا توجد طلبات بعد" description="عند وصول طلبات فعلية سيظهر التقرير هنا تلقائيًا." />
          )}
        </AdminPanel>

        <AdminPanel title="توزيع حالات الشركات" description="صورة مباشرة لوضع الشركات داخل النظام.">
          {companiesSeries.some((item) => item.value > 0) ? (
            <div className="space-y-3">
              {companiesSeries.map((item) => (
                <div key={item.key} className="rounded-[1.35rem] bg-[#f8fafc] px-4 py-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-black text-[#11213d]">{item.label}</div>
                    <AdminBadge tone="info">{formatNumber(item.value)}</AdminBadge>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(6, (item.value / Math.max(1, ...companiesSeries.map((entry) => entry.value))) * 100)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="لا توجد شركات بعد" description="أضف شركات أو فعّل بياناتها لتظهر الرسوم هنا." />
          )}
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel title="الشركات الأعلى نشاطًا" description="مرتبة بعدد الوظائف المفتوحة حاليًا.">
          {topCompanies.length ? (
            <div className="space-y-3">
              {topCompanies.map((company) => (
                <div key={company.id} className="rounded-[1.35rem] bg-[#f8fafc] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-[#11213d]">{cleanAdminText(company.name)}</div>
                      <div className="mt-1 text-xs text-[#73849a]">{cleanAdminText(company.location || company.sector || 'بدون تفاصيل')}</div>
                    </div>
                    <AdminBadge tone="success">{formatNumber(company.openings)} وظيفة</AdminBadge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="لا توجد بيانات كافية" description="ستظهر أفضل الشركات هنا بمجرد وجود نشاط فعلي." />
          )}
        </AdminPanel>

        <AdminPanel title="الوظائف الأعلى استقبالًا" description="أعلى الوظائف حسب عدد المتقدمين الحالي.">
          {topJobs.length ? (
            <div className="space-y-3">
              {topJobs.map((job) => (
                <div key={job.id} className="rounded-[1.35rem] bg-[#f8fafc] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-[#11213d]">{cleanAdminText(job.title)}</div>
                      <div className="mt-1 truncate text-xs text-[#73849a]">{cleanAdminText(job.companyName)} · {cleanAdminText(job.location)}</div>
                    </div>
                    <AdminBadge tone="info">{formatNumber(job.applicantsCount)} متقدم</AdminBadge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="لا توجد وظائف نشطة" description="عند نشر وظائف فعلية ستظهر هنا الأعلى تفاعلًا." />
          )}
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel title="نشاط الأشهر الأخيرة" description="ملخص سريع لحركة الوظائف والتقديمات عبر آخر 6 أشهر.">
          {trends.some((item) => item.jobs || item.applications) ? (
            <div className="grid gap-4 md:grid-cols-2">
              {trends.map((item) => (
                <div key={item.key} className="rounded-[1.35rem] border border-[rgba(24,37,63,0.08)] bg-[#fbfcff] px-4 py-4">
                  <div className="text-sm font-black text-[#11213d]">{item.label}</div>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#627487]">
                    <span>وظائف: {formatNumber(item.jobs)}</span>
                    <span>تقديمات: {formatNumber(item.applications)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="لا توجد حركة زمنية بعد" description="سيظهر هذا التقرير عندما تتوفر تواريخ نشر وتقديم فعلية." />
          )}
        </AdminPanel>

        <AdminPanel title="آخر نشاط إداري" description="آخر الحركات المسجلة داخل لوحة التحكم.">
          {activityFeed.length ? (
            <div className="space-y-3">
              {activityFeed.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-[1.3rem] bg-[#f8fafc] px-4 py-4">
                  <div className="text-sm font-black text-[#11213d]">{item.title}</div>
                  <div className="mt-1 text-xs leading-6 text-[#72839a]">{item.description}</div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="سجل النشاط فارغ" description="عند تنفيذ عمليات حقيقية من اللوحة سيظهر السجل هنا." />
          )}
        </AdminPanel>
      </section>
    </>
  );
}
