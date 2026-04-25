import { motion } from 'framer-motion';
import {
  Download,
  Filter,
  History,
  Search,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AdminBadge,
  AdminButton,
  AdminDataShell,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  AdminTable,
  AdminTableShell,
  AdminToolbar,
} from '../components/ui/admin-kit';
import {
  cleanAdminText,
  formatDateTime,
  repairAdminUiValue,
} from '../lib/admin-dashboard';
import { useAdmin, type AuditLog } from '../lib/admin-store';

export default function AuditLogs() {
  const { state, exportAuditCsv, refreshFromSite } = useAdmin();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    const keyword = cleanAdminText(query).toLowerCase();
    return state.auditLogs.filter((log) => {
      const searchTarget = cleanAdminText(`${log.action} ${log.actorName} ${log.details} ${log.entityLabel}`).toLowerCase();
      const matchesQuery = !keyword || searchTarget.includes(keyword);
      const matchesType = typeFilter === 'all' || log.entityType === typeFilter;
      const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
      return matchesQuery && matchesType && matchesSeverity;
    });
  }, [query, state.auditLogs, typeFilter, severityFilter]);

  const entityTypes = useMemo(() => {
    const types = new Set(state.auditLogs.map((log) => log.entityType));
    return Array.from(types).sort();
  }, [state.auditLogs]);

  const getSeverityIcon = (severity: AuditLog['severity']) => {
    switch (severity) {
      case 'danger': return <AlertCircle size={14} className="text-[#c94747]" />;
      case 'warning': return <AlertCircle size={14} className="text-[#9c6a12]" />;
      case 'success': return <CheckCircle2 size={14} className="text-[#237a47]" />;
      default: return <Info size={14} className="text-[#275e98]" />;
    }
  };

  const getSeverityLabel = (severity: AuditLog['severity']) => {
    switch (severity) {
      case 'danger': return 'خطر';
      case 'warning': return 'تحذير';
      case 'success': return 'نجاح';
      default: return 'معلومات';
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="الأمان والرقابة"
        title="سجل العمليات الإدارية"
        description="تتبع كامل لجميع النشاطات التي تتم على المنصة، بما في ذلك تعديلات البيانات، قرارات الاعتماد، وعمليات الحذف."
        actions={
          <AdminButton onClick={exportAuditCsv}>
            <Download size={16} />
            تصدير سجل التدقيق (CSV)
          </AdminButton>
        }
      />

      <AdminDataShell
        toolbar={
          <AdminToolbar>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9aa8b8]" size={18} />
              <AdminInput
                placeholder="ابحث في الإجراءات، الموظفين، أو التفاصيل..."
                className="pr-11"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-[#5a708e]" />
                <AdminSelect
                  className="w-40"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">كل الأنواع</option>
                  {entityTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </AdminSelect>
              </div>
              <AdminSelect
                className="w-40"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">كل المستويات</option>
                <option value="info">معلومات</option>
                <option value="success">نجاح</option>
                <option value="warning">تحذير</option>
                <option value="danger">خطر</option>
              </AdminSelect>
              <AdminButton variant="soft" onClick={() => {
                setQuery('');
                setTypeFilter('all');
                setSeverityFilter('all');
              }}>
                إعادة ضبط
              </AdminButton>
            </div>
          </AdminToolbar>
        }
      >
        {filteredLogs.length ? (
          <AdminTable>
            <AdminTableShell>
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-[rgba(17,34,63,0.06)] bg-[#fafbfc]">
                    <th className="px-5 py-4 text-xs font-black text-[#10213c]">الوقت</th>
                    <th className="px-5 py-4 text-xs font-black text-[#10213c]">الموظف</th>
                    <th className="px-5 py-4 text-xs font-black text-[#10213c]">الإجراء</th>
                    <th className="px-5 py-4 text-xs font-black text-[#10213c]">النوع</th>
                    <th className="px-5 py-4 text-xs font-black text-[#10213c]">التفاصيل</th>
                    <th className="px-5 py-4 text-xs font-black text-[#10213c]">المستوى</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(17,34,63,0.04)]">
                  {filteredLogs.map((log, index) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-[#f8fafc]/60 transition"
                    >
                      <td className="px-5 py-4 text-[0.82rem] font-bold text-[#5e7087] whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-[0.82rem] font-black text-[#17355b]">
                        {repairAdminUiValue(log.actorName)}
                      </td>
                      <td className="px-5 py-4 text-[0.82rem] font-bold text-[#10213c]">
                         {repairAdminUiValue(log.action)}
                      </td>
                      <td className="px-5 py-4 text-[0.82rem] text-[#71839b]">
                        <span className="rounded-md bg-[#f3f5f8] px-2 py-0.5 font-bold text-[11px] border border-[rgba(17,34,63,0.06)]">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[0.82rem] leading-6 text-[#63758a] min-w-[240px]">
                        {repairAdminUiValue(log.details)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getSeverityIcon(log.severity)}
                          <span className="text-[0.78rem] font-black" style={{
                            color: log.severity === 'danger' ? '#c94747' : log.severity === 'warning' ? '#9c6a12' : log.severity === 'success' ? '#237a47' : '#275e98'
                          }}>
                            {getSeverityLabel(log.severity)}
                          </span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
          </AdminTable>
        ) : (
          <AdminEmptyState
            title="لا توجد نتائج بحث"
            description="جرب البحث بكلمات مختلفة أو تغيير إعدادات الفلترة."
          />
        )}
      </AdminDataShell>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-[1.4rem] border border-[rgba(24,37,63,0.08)] bg-white p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#eff6ff] text-[#2563eb] flex items-center justify-center">
            <History size={22} />
          </div>
          <div>
            <div className="text-sm font-black text-[#10213c]">إجمالي العمليات</div>
            <div className="mt-1 text-2xl font-black text-[#17355b]">{state.auditLogs.length}</div>
          </div>
        </div>
        <div className="rounded-[1.4rem] border border-[rgba(24,37,63,0.08)] bg-white p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#ecfdf5] text-[#10b981] flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="text-sm font-black text-[#10213c]">عمليات ناجحة</div>
            <div className="mt-1 text-2xl font-black text-[#17355b]">
              {state.auditLogs.filter(l => l.severity === 'success').length}
            </div>
          </div>
        </div>
        <div className="rounded-[1.4rem] border border-[rgba(24,37,63,0.08)] bg-white p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#fffaf0] text-[#f59e0b] flex items-center justify-center">
            <AlertCircle size={22} />
          </div>
          <div>
            <div className="text-sm font-black text-[#10213c]">تنبيهات الأمان</div>
            <div className="mt-1 text-2xl font-black text-[#17355b]">
              {state.auditLogs.filter(l => l.severity === 'warning' || l.severity === 'danger').length}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
