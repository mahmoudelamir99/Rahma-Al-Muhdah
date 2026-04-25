import { motion } from 'framer-motion';
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
  getRealRecordCounts,
  getSectorsSeries,
  getTopCompanies,
  getTopJobs,
  getTrendsSeries,
  getApplicationTrendsDetailed,
} from '../lib/admin-dashboard';
import { useAdmin } from '../lib/admin-store';

export default function Reports() {
  const { state, exportApplicationsCsv, exportAuditCsv, refreshFromSite } = useAdmin();

  useEffect(() => {
    refreshFromSite();
    const intervalId = window.setInterval(() => refreshFromSite(), 20000);
    return () => window.clearInterval(intervalId);
  }, [refreshFromSite]);

  const statusSeries = useMemo(() => getApplicationStatusSeries(state), [state]);
  const activityFeed = useMemo(() => getActivityFeed(state), [state]);
  const topCompanies = useMemo(() => getTopCompanies(state), [state]);
  const topJobs = useMemo(() => getTopJobs(state), [state]);
  const trends = useMemo(() => getTrendsSeries(state), [state]);
  const realCounts = useMemo(() => getRealRecordCounts(state), [state]);
  const sectorsSeries = useMemo(() => getSectorsSeries(state), [state]);
  const detailedTrends = useMemo(() => getApplicationTrendsDetailed(state), [state]);

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
        <AdminStatCard label="كل الشركات" value={formatNumber(realCounts.companies)} helper="إجمالي السجلات الحقيقية" icon={Building2} tone="secondary" />
        <AdminStatCard label="كل الوظائف" value={formatNumber(realCounts.jobs)} helper="وظائف نشطة لشركات حقيقية" icon={BriefcaseBusiness} tone="primary" />
        <AdminStatCard label="كل الطلبات" value={formatNumber(realCounts.applications)} helper="إجمالي التقديمات الصالحة" icon={BarChart3} tone="accent" />
        <AdminStatCard label="سجل التدقيق" value={formatNumber(state.auditLogs.length)} helper="آخر عمليات الإدارة" icon={ShieldCheck} tone="success" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel title="توزيع القطاعات" description="توزيع الشركات حسب النشاط الاقتصادي.">
          {sectorsSeries.length > 0 ? (
            <div className="space-y-4">
              {sectorsSeries.slice(0, 5).map((item) => (
                <div key={item.key} className="relative">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold">
                    <span className="text-[#11213d]">{item.label}</span>
                    <span className="text-[#73849c]">{item.value} شركة</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.value / sectorsSeries[0].value) * 100}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="لا توجد قطاعات" description="أضف تصنيفات للشركات لتظهر هنا." />
          )}
        </AdminPanel>

        <AdminPanel title="توزيع حالات الطلبات" description="الأعداد الحالية حسب نتيجة كل طلب.">
          <div className="space-y-4">
            {statusSeries.map((item) => (
              <div key={item.key} className="flex items-center gap-4">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="flex-1 text-sm font-bold text-[#11213d]">{item.label}</div>
                <div className="text-sm font-black text-[#64748b]">{formatNumber(item.value)}</div>
              </div>
            ))}
          </div>
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel title="اتجاهات التقديم اليومية" description="معدل الطلبات خلال الـ 7 أيام الماضية.">
          <AdminResponsiveChart className="h-[300px]">
            {({ width, height }) => (
              <BarChart width={width} height={height} data={detailedTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(24,37,63,0.05)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#73849a', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#73849a', fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(24,37,63,0.02)' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                />
                <Bar dataKey="value" fill="#005dac" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            )}
          </AdminResponsiveChart>
        </AdminPanel>

        <AdminPanel title="أعلى الشركات نشاطًا" description="الشركات الأكثر نشراً للوظائف.">
          {topCompanies.length ? (
            <div className="space-y-3">
              {topCompanies.slice(0, 4).map((company) => (
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
            <AdminEmptyState title="لا توجد بيانات" description="ستظهر أفضل الشركات هنا بمجرد وجود نشاط فعلي." />
          )}
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel title="اتجاهات عامة" description="ملخص سريع لحركة الوظائف والتقديمات.">
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
            <AdminEmptyState title="لا توجد حركة" description="سيظهر هذا التقرير عند توفر بيانات كافية." />
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
            <AdminEmptyState title="سجل النشاط فارغ" description="عند تنفيذ عمليات من اللوحة سيظهر السجل هنا." />
          )}
        </AdminPanel>
      </section>
    </>
  );
}
