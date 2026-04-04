import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, Clock3, Eye, FileSearch, NotebookPen, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cleanAdminText,
  formatDateTime,
  formatRelativeTime,
  getApplicationStatusLabel,
  getStatusTone,
} from '../lib/admin-dashboard';
import type { ApplicationRecord } from '../lib/admin-store';
import { useAdmin } from '../lib/admin-store';
import {
  AdminBadge,
  AdminButton,
  AdminDataShell,
  AdminDrawer,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from '../components/ui/admin-kit';

const STATUS_OPTIONS: Array<{ value: ApplicationRecord['status']; label: string }> = [
  { value: 'pending', label: 'طلب جديد' },
  { value: 'review', label: 'تحت المراجعة' },
  { value: 'interview', label: 'مقابلة' },
  { value: 'approved', label: 'مقبول مبدئيًا' },
  { value: 'accepted', label: 'مقبول' },
  { value: 'rejected', label: 'مرفوض' },
  { value: 'hired', label: 'تم التعيين' },
];

const TAG_OPTIONS = [
  { value: 'all', label: 'كل التمييزات' },
  { value: 'strong', label: 'مناسب' },
  { value: 'contact', label: 'يحتاج تواصل' },
  { value: 'reserve', label: 'احتياطي' },
  { value: 'not-fit', label: 'غير مناسب' },
] as const;

const COMPANY_TAG_LABELS: Record<string, string> = {
  strong: 'مناسب',
  contact: 'يحتاج تواصل',
  reserve: 'احتياطي',
  'not-fit': 'غير مناسب',
};

const INTERVIEW_MODE_LABELS: Record<string, string> = {
  onsite: 'حضوري',
  phone: 'هاتف',
  online: 'أونلاين',
};

type FeedbackState = {
  tone: 'success' | 'danger';
  text: string;
} | null;

function buildTimeline(application: ApplicationRecord) {
  const items = [
    {
      id: `${application.id}-submitted`,
      label: 'وقت التقديم',
      value: formatDateTime(application.submittedAt),
      helper: 'تم استلام الطلب داخل المنصة.',
      tone: 'info' as const,
    },
    {
      id: `${application.id}-status`,
      label: 'الحالة الحالية',
      value: getApplicationStatusLabel(application.status),
      helper: application.respondedAt ? `آخر تحديث ${formatRelativeTime(application.respondedAt)}` : 'بانتظار القرار النهائي.',
      tone: getStatusTone(application.status) as 'success' | 'warning' | 'danger' | 'neutral' | 'info',
    },
  ];

  if (application.respondedAt) {
    items.push({
      id: `${application.id}-responded`,
      label: 'وقت القرار',
      value: formatDateTime(application.respondedAt),
      helper:
        application.status === 'rejected' && application.rejectionReason
          ? cleanAdminText(application.rejectionReason)
          : 'تم تسجيل القرار النهائي على الطلب.',
      tone: application.status === 'rejected' ? 'danger' : 'success',
    });
  }

  return items;
}

function downloadApplicationsCsvFile(filename: string, applications: ApplicationRecord[]) {
  const rows = [
    ['رقم الطلب', 'الاسم', 'الهاتف', 'البريد', 'المدينة', 'الخبرة', 'الوظيفة', 'الشركة', 'الحالة', 'التمييز', 'موعد المقابلة', 'سبب الرفض'],
    ...applications.map((application) => [
      cleanAdminText(application.requestId),
      cleanAdminText(application.applicantName),
      cleanAdminText(application.applicantPhone),
      cleanAdminText(application.applicantEmail),
      cleanAdminText(application.city),
      cleanAdminText(application.experienceYears || application.experience),
      cleanAdminText(application.jobTitle),
      cleanAdminText(application.companyName),
      getApplicationStatusLabel(application.status),
      cleanAdminText(COMPANY_TAG_LABELS[application.companyTag] || ''),
      cleanAdminText(application.interviewScheduledAt ? formatDateTime(application.interviewScheduledAt) : ''),
      cleanAdminText(application.rejectionReason),
    ]),
  ];

  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 500);
}

function statusTone(status: ApplicationRecord['status']) {
  return getStatusTone(status) as 'success' | 'warning' | 'danger' | 'neutral' | 'info';
}

export default function Applications() {
  const { state, updateApplicationStatus, addNote } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState<(typeof TAG_OPTIONS)[number]['value']>('all');
  const [selectedApplication, setSelectedApplication] = useState<ApplicationRecord | null>(null);
  const [statusDraft, setStatusDraft] = useState<ApplicationRecord['status']>('review');
  const [reasonDraft, setReasonDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatusDraft, setBulkStatusDraft] = useState<ApplicationRecord['status']>('review');
  const [bulkReasonDraft, setBulkReasonDraft] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const companies = useMemo(
    () => Array.from(new Set(state.applications.filter((item) => !item.deletedAt).map((item) => cleanAdminText(item.companyName)))).sort(),
    [state.applications],
  );

  const jobs = useMemo(
    () => Array.from(new Set(state.applications.filter((item) => !item.deletedAt).map((item) => cleanAdminText(item.jobTitle)))).sort(),
    [state.applications],
  );

  const visibleApplications = useMemo(() => {
    return state.applications
      .filter((application) => {
        if (application.deletedAt) return false;

        const searchTarget = [
          application.applicantName,
          application.applicantEmail,
          application.applicantPhone,
          application.jobTitle,
          application.companyName,
          application.requestId,
          application.city,
          application.experience,
          COMPANY_TAG_LABELS[application.companyTag] || '',
        ]
          .map(cleanAdminText)
          .join(' ')
          .toLowerCase();

        const matchesQuery = searchTarget.includes(query.trim().toLowerCase());
        const matchesCompany = companyFilter === 'all' ? true : cleanAdminText(application.companyName) === companyFilter;
        const matchesJob = jobFilter === 'all' ? true : cleanAdminText(application.jobTitle) === jobFilter;
        const matchesStatus = statusFilter === 'all' ? true : application.status === statusFilter;
        const matchesTag = tagFilter === 'all' ? true : application.companyTag === tagFilter;

        return matchesQuery && matchesCompany && matchesJob && matchesStatus && matchesTag;
      })
      .sort((first, second) => {
        const firstTime = new Date(first.submittedAt).getTime() || 0;
        const secondTime = new Date(second.submittedAt).getTime() || 0;
        return secondTime - firstTime;
      });
  }, [companyFilter, jobFilter, query, state.applications, statusFilter, tagFilter]);

  useEffect(() => {
    if (!selectedApplication) return;
    const nextSelected = state.applications.find((application) => application.id === selectedApplication.id) || null;
    if (nextSelected !== selectedApplication) {
      setSelectedApplication(nextSelected);
      if (nextSelected) {
        setStatusDraft(nextSelected.status);
        setReasonDraft(cleanAdminText(nextSelected.rejectionReason));
      }
    }
  }, [selectedApplication, state.applications]);

  useEffect(() => {
    const applicationId = searchParams.get('applicationId');
    if (!applicationId) return;

    const targetApplication = state.applications.find((application) => application.id === applicationId) || null;
    if (targetApplication && targetApplication !== selectedApplication) {
      setSelectedApplication(targetApplication);
      setStatusDraft(targetApplication.status);
      setReasonDraft(cleanAdminText(targetApplication.rejectionReason));
      setFeedback(null);
    }
  }, [searchParams, selectedApplication, state.applications]);

  useEffect(() => {
    const visibleIds = new Set(visibleApplications.map((application) => application.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [visibleApplications]);

  const openDrawer = (application: ApplicationRecord) => {
    setSelectedApplication(application);
    setStatusDraft(application.status);
    setReasonDraft(cleanAdminText(application.rejectionReason));
    setNoteDraft('');
    setFeedback(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('applicationId', application.id);
      return next;
    });
  };

  const closeDrawer = () => {
    setSelectedApplication(null);
    setFeedback(null);
    setNoteDraft('');
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('applicationId');
      return next;
    });
  };

  const saveStatus = () => {
    if (!selectedApplication) return;

    if (statusDraft === 'rejected' && !reasonDraft.trim()) {
      setFeedback({ tone: 'danger', text: 'سبب الرفض مطلوب قبل حفظ حالة الرفض.' });
      return;
    }

    updateApplicationStatus(selectedApplication.id, statusDraft, reasonDraft.trim());
    setFeedback({ tone: 'success', text: 'تم تحديث حالة الطلب بنجاح.' });
  };

  const submitNote = () => {
    if (!selectedApplication || !noteDraft.trim()) return;
    addNote('applications', selectedApplication.id, noteDraft.trim());
    setNoteDraft('');
    setFeedback({ tone: 'success', text: 'تمت إضافة الملاحظة الداخلية على الطلب.' });
  };

  const selectedTimeline = selectedApplication ? buildTimeline(selectedApplication) : [];
  const allVisibleSelected = visibleApplications.length > 0 && visibleApplications.every((application) => selectedIds.includes(application.id));

  const toggleSelection = (applicationId: string) => {
    setSelectedIds((current) =>
      current.includes(applicationId) ? current.filter((id) => id !== applicationId) : [...current, applicationId],
    );
  };

  const toggleVisibleSelection = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(visibleApplications.map((application) => application.id));
  };

  const applyBulkStatus = () => {
    if (!selectedIds.length) {
      setFeedback({ tone: 'danger', text: 'اختر طلبًا واحدًا على الأقل قبل تنفيذ الإجراء الجماعي.' });
      return;
    }

    if (bulkStatusDraft === 'rejected' && !bulkReasonDraft.trim()) {
      setFeedback({ tone: 'danger', text: 'سبب الرفض مطلوب عند تطبيق حالة الرفض على مجموعة طلبات.' });
      return;
    }

    selectedIds.forEach((applicationId) => {
      updateApplicationStatus(applicationId, bulkStatusDraft, bulkReasonDraft.trim());
    });

    setFeedback({ tone: 'success', text: `تم تحديث ${selectedIds.length} طلب دفعة واحدة.` });
    setSelectedIds([]);
    setBulkReasonDraft('');
  };

  const exportVisibleApplications = () => {
    if (!visibleApplications.length) {
      setFeedback({ tone: 'danger', text: 'لا توجد طلبات ظاهرة لتصديرها.' });
      return;
    }

    downloadApplicationsCsvFile('rahma-visible-applications.csv', visibleApplications);
    setFeedback({ tone: 'success', text: 'تم تصدير الطلبات الظاهرة بنجاح.' });
  };

  return (
    <>
      <AnimatePresence>
        {feedback ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed left-1/2 top-5 z-[120] -translate-x-1/2"
          >
            <div
              className={
                feedback.tone === 'success'
                  ? 'flex items-center gap-3 rounded-[1rem] border border-[#c9ead7] bg-[#e9faef] px-5 py-3 text-sm font-black text-[#22744c] shadow-[0_18px_36px_rgba(34,116,76,0.14)]'
                  : 'flex items-center gap-3 rounded-[1rem] border border-[#f0cbcb] bg-[#fff5f5] px-5 py-3 text-sm font-black text-[#b14f4f] shadow-[0_18px_36px_rgba(177,79,79,0.12)]'
              }
            >
              {feedback.tone === 'success' ? <CheckCircle2 size={20} /> : <X size={20} />}
              <span>{feedback.text}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#7690ab]">متابعة الطلبات والقرارات</p>
          <h1 className="mt-1 text-[clamp(1.55rem,2.5vw,2.25rem)] font-black text-[#0f223d]">إدارة طلبات التوظيف بخط سير واضح</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#64768a]">
            فلترة سريعة، اختيار جماعي، وتصدير مباشر للطلبات الظاهرة مع الاحتفاظ بكل تفاصيل المرشح داخل الدرج الجانبي.
          </p>
        </div>
      </section>

      <AdminDataShell
        toolbar={
          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[220px_220px_200px_200px_minmax(0,1fr)]">
              <AdminSelect value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
                <option value="all">كل الشركات</option>
                {companies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
                <option value="all">كل الوظائف</option>
                {jobs.map((job) => (
                  <option key={job} value={job}>
                    {job}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">كل الحالات</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect value={tagFilter} onChange={(event) => setTagFilter(event.target.value as (typeof TAG_OPTIONS)[number]['value'])}>
                {TAG_OPTIONS.map((tag) => (
                  <option key={tag.value} value={tag.value}>
                    {tag.label}
                  </option>
                ))}
              </AdminSelect>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8797aa]" size={18} />
                <AdminInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-12"
                  placeholder="ابحث بالاسم أو رقم الطلب أو الهاتف..."
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#61748a]">
                <span className="rounded-full bg-[#eef3fb] px-3 py-2 text-[#17355b]">{visibleApplications.length} طلب ظاهر</span>
                <span className="rounded-full bg-[#f6f8fc] px-3 py-2 text-[#586d84]">{selectedIds.length} محدد</span>
              </div>
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                <AdminButton variant="ghost" onClick={toggleVisibleSelection}>
                  {allVisibleSelected ? 'إلغاء تحديد الظاهر' : 'تحديد الظاهر'}
                </AdminButton>
                <AdminSelect value={bulkStatusDraft} onChange={(event) => setBulkStatusDraft(event.target.value as ApplicationRecord['status'])}>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </AdminSelect>
                <AdminInput value={bulkReasonDraft} onChange={(event) => setBulkReasonDraft(event.target.value)} placeholder="سبب الرفض للجملة المحددة" />
                <AdminButton onClick={applyBulkStatus}>تطبيق على المحدد</AdminButton>
                <AdminButton variant="secondary" onClick={exportVisibleApplications}>تصدير الظاهر</AdminButton>
              </div>
            </div>
          </div>
        }
      >
        {visibleApplications.length ? (
          <>
            <div className="grid gap-3 p-4 lg:hidden">
              {visibleApplications.map((application) => (
                <article key={`mobile-${application.id}`} className="rounded-[1.15rem] border border-[rgba(24,37,63,0.08)] bg-white p-4 shadow-[0_14px_28px_rgba(18,30,54,0.06)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[1rem] font-black text-[#11213d]">{cleanAdminText(application.applicantName || 'متقدم جديد')}</div>
                      <div className="mt-1 text-xs text-[#75869a]">{cleanAdminText(application.applicantPhone || 'بدون هاتف')}</div>
                    </div>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(application.id)}
                        onChange={() => toggleSelection(application.id)}
                        className="mt-1 h-4 w-4 rounded border-[#bfd0e2] text-[#17355b] focus:ring-[#17355b]"
                      />
                      <AdminBadge tone={statusTone(application.status)}>{getApplicationStatusLabel(application.status)}</AdminBadge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminBadge tone="neutral">{cleanAdminText(application.jobTitle || 'بدون وظيفة')}</AdminBadge>
                    {application.companyTag ? <AdminBadge tone="info">{cleanAdminText(COMPANY_TAG_LABELS[application.companyTag] || application.companyTag)}</AdminBadge> : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-[1rem] border border-[rgba(24,37,63,0.08)] px-3.5 py-3">
                    <div>
                      <div className="text-[11px] font-bold text-[#7a8b9e]">رقم الطلب</div>
                      <div className="mt-2 text-sm font-black text-[#122341]">#{cleanAdminText(application.requestId)}</div>
                    </div>
                    <div className="text-left text-[11px] font-bold leading-5 text-[#73849a]">
                      <div>{formatDateTime(application.submittedAt)}</div>
                      <div>{formatRelativeTime(application.submittedAt)}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <AdminButton variant="ghost" onClick={() => openDrawer(application)}>
                      <Eye size={15} />
                      التفاصيل
                    </AdminButton>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="rm-table min-w-[1260px]">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleSelection}
                        className="h-4 w-4 rounded border-[#bfd0e2] text-[#17355b] focus:ring-[#17355b]"
                      />
                    </th>
                    <th>المتقدم</th>
                    <th>الوظيفة</th>
                    <th>الشركة</th>
                    <th>تاريخ التقديم</th>
                    <th>الحالة</th>
                    <th>التمييز</th>
                    <th>رقم الطلب</th>
                    <th>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleApplications.map((application, index) => (
                    <motion.tr
                      key={application.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02, duration: 0.18 }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(application.id)}
                          onChange={() => toggleSelection(application.id)}
                          className="h-4 w-4 rounded border-[#bfd0e2] text-[#17355b] focus:ring-[#17355b]"
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef3fb] text-sm font-black text-[#17325a]">
                            {cleanAdminText(application.applicantName || 'م').slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-[#11213d]">{cleanAdminText(application.applicantName || 'متقدم جديد')}</div>
                            <div className="mt-1 text-xs text-[#75869a]">{cleanAdminText(application.applicantPhone || 'بدون هاتف')}</div>
                          </div>
                        </div>
                      </td>
                      <td>{cleanAdminText(application.jobTitle || 'غير محدد')}</td>
                      <td>{cleanAdminText(application.companyName || 'غير محددة')}</td>
                      <td>{formatDateTime(application.submittedAt)}</td>
                      <td>
                        <AdminBadge tone={statusTone(application.status)}>{getApplicationStatusLabel(application.status)}</AdminBadge>
                      </td>
                      <td>
                        {application.companyTag ? <AdminBadge tone="info">{cleanAdminText(COMPANY_TAG_LABELS[application.companyTag] || application.companyTag)}</AdminBadge> : <span className="text-xs font-bold text-[#90a0b2]">بدون تمييز</span>}
                      </td>
                      <td>
                        <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-black text-[#17335b]">{cleanAdminText(application.requestId)}</span>
                      </td>
                      <td>
                        <AdminButton variant="ghost" onClick={() => openDrawer(application)}>
                          <Eye size={15} />
                          التفاصيل
                        </AdminButton>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="p-6">
            <AdminEmptyState title="لا توجد طلبات مطابقة" description="جرّب تعديل الفلاتر الحالية أو انتظر وصول طلبات جديدة من الموقع." />
          </div>
        )}
      </AdminDataShell>

      <AdminDrawer open={Boolean(selectedApplication)} onClose={closeDrawer} title="ملف المتقدم" description="بيانات الطلب، مسار الحالة، وملاحظات الإدارة في مكان واحد.">
        {selectedApplication ? (
          <div className="space-y-5">
            <div className="space-y-2 text-right">
              <div className="text-[1.35rem] font-black text-[#10213d]">{cleanAdminText(selectedApplication.applicantName || 'متقدم')}</div>
              <div className="flex flex-wrap gap-2">
                <AdminBadge tone={statusTone(selectedApplication.status)}>{getApplicationStatusLabel(selectedApplication.status)}</AdminBadge>
                <AdminBadge tone="info">طلب #{cleanAdminText(selectedApplication.requestId)}</AdminBadge>
                {selectedApplication.companyTag ? <AdminBadge tone="info">{cleanAdminText(COMPANY_TAG_LABELS[selectedApplication.companyTag] || selectedApplication.companyTag)}</AdminBadge> : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['الشركة', selectedApplication.companyName || 'غير محددة'],
                ['الوظيفة', selectedApplication.jobTitle || 'غير محدد'],
                ['الهاتف', selectedApplication.applicantPhone || 'غير متاح'],
                ['البريد الإلكتروني', selectedApplication.applicantEmail || 'غير متاح'],
                ['المدينة', selectedApplication.city || 'غير محدد'],
                ['سنوات الخبرة', selectedApplication.experienceYears || selectedApplication.experience || 'غير محدد'],
                ['الراتب المتوقع', selectedApplication.expectedSalary || 'غير محدد'],
                ['التخصص', selectedApplication.specialization || 'غير محدد'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.1rem] bg-[#f5f8fc] px-4 py-3">
                  <div className="text-xs font-bold text-[#7a8b9e]">{label}</div>
                  <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(value)}</div>
                </div>
              ))}
            </div>

            {selectedApplication.companyTag || selectedApplication.interviewScheduledAt || selectedApplication.interviewLocation ? (
              <section className="rounded-[1.2rem] border border-[rgba(24,37,63,0.08)] bg-white p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-black text-[#10213d]">متابعة الشركة</h3>
                  <p className="mt-1 text-xs leading-6 text-[#718399]">آخر تجهيز أو تصنيف وضعته الشركة على هذا المرشح.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.1rem] bg-[#f5f8fc] px-4 py-3">
                    <div className="text-xs font-bold text-[#7a8b9e]">تمييز الشركة</div>
                    <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(COMPANY_TAG_LABELS[selectedApplication.companyTag] || 'غير محدد')}</div>
                  </div>
                  <div className="rounded-[1.1rem] bg-[#f5f8fc] px-4 py-3">
                    <div className="text-xs font-bold text-[#7a8b9e]">موعد المقابلة</div>
                    <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(selectedApplication.interviewScheduledAt ? formatDateTime(selectedApplication.interviewScheduledAt) : 'غير محدد')}</div>
                  </div>
                  <div className="rounded-[1.1rem] bg-[#f5f8fc] px-4 py-3">
                    <div className="text-xs font-bold text-[#7a8b9e]">نوع المقابلة</div>
                    <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(INTERVIEW_MODE_LABELS[selectedApplication.interviewMode] || 'غير محدد')}</div>
                  </div>
                  <div className="rounded-[1.1rem] bg-[#f5f8fc] px-4 py-3">
                    <div className="text-xs font-bold text-[#7a8b9e]">مكان أو رابط المقابلة</div>
                    <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(selectedApplication.interviewLocation || 'غير محدد')}</div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-[1.2rem] border border-[rgba(24,37,63,0.08)] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-[#10213d]">مسار الحالة</h3>
                  <p className="mt-1 text-xs leading-6 text-[#718399]">من لحظة التقديم وحتى آخر قرار مسجل على الطلب.</p>
                </div>
                <Clock3 size={16} className="text-[#7487a0]" />
              </div>
              <div className="space-y-3">
                {selectedTimeline.map((item) => (
                  <div key={item.id} className="rounded-[1rem] bg-[#f7f9fc] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-black text-[#132442]">{item.label}</div>
                      <AdminBadge tone={item.tone === 'info' ? 'info' : item.tone}>{item.value}</AdminBadge>
                    </div>
                    <div className="mt-2 text-xs leading-6 text-[#73849a]">{item.helper}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.2rem] border border-[rgba(24,37,63,0.08)] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-[#10213d]">التحكم في الحالة</h3>
                  <p className="mt-1 text-xs leading-6 text-[#718399]">يمكنك تغيير الحالة الآن، ومع الرفض يجب كتابة سبب واضح.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(24,37,63,0.08)] bg-[#f7f9fc] px-3 py-2 text-xs font-bold text-[#586d84]">
                  <FileSearch size={15} />
                  <span>{selectedApplication.cvFileName ? cleanAdminText(selectedApplication.cvFileName) : 'لا يوجد CV'}</span>
                </div>
              </div>
              <div className="grid gap-4">
                <AdminField label="تغيير الحالة">
                  <div className="relative">
                    <AdminSelect value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as ApplicationRecord['status'])}>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </AdminSelect>
                    <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6f8298]" size={18} />
                  </div>
                </AdminField>
                <AdminField label="سبب الرفض">
                  <AdminTextarea rows={4} value={reasonDraft} onChange={(event) => setReasonDraft(event.target.value)} placeholder="اكتب سببًا واضحًا يظهر عند الرفض..." />
                </AdminField>
                <AdminButton className="w-full" onClick={saveStatus}>حفظ قرار الطلب</AdminButton>
              </div>
            </section>

            <section className="rounded-[1.2rem] border border-[rgba(24,37,63,0.08)] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-[#10213d]">ملاحظات داخلية</h3>
                  <p className="mt-1 text-xs leading-6 text-[#718399]">تظهر للأدمن فقط ولا تظهر على الموقع أو للمتقدم.</p>
                </div>
                <NotebookPen size={16} className="text-[#7487a0]" />
              </div>
              <div className="grid gap-3">
                <AdminTextarea rows={4} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="أضف ملاحظة إدارية عن هذا الطلب..." />
                <AdminButton variant="secondary" onClick={submitNote}>حفظ الملاحظة</AdminButton>
                {selectedApplication.notes.length ? (
                  <div className="space-y-3">
                    {selectedApplication.notes
                      .slice()
                      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
                      .map((note) => (
                        <div key={note.id} className="rounded-[1rem] bg-[#f7f9fc] px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-black text-[#122341]">{cleanAdminText(note.authorName)}</div>
                            <div className="text-[11px] text-[#74879b]">{formatDateTime(note.createdAt)}</div>
                          </div>
                          <p className="mt-2 text-sm leading-7 text-[#5f7187]">{cleanAdminText(note.body)}</p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-[1rem] bg-[#f7f9fc] px-4 py-4 text-sm text-[#73849a]">لا توجد ملاحظات داخلية على هذا الطلب حتى الآن.</div>
                )}
              </div>
            </section>

            <AdminField label="الرسالة التعريفية">
              <AdminTextarea value={cleanAdminText(selectedApplication.coverLetter || 'لا توجد رسالة مرفقة.')} readOnly rows={6} />
            </AdminField>

            {selectedApplication.rejectionReason ? (
              <div className="rounded-[1.2rem] border border-[#f0d4d4] bg-[#fff7f7] px-4 py-4 text-sm leading-7 text-[#8b4a4a]">
                <strong className="mb-2 block text-[#aa4f4f]">سبب الرفض الحالي</strong>
                {cleanAdminText(selectedApplication.rejectionReason)}
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminDrawer>
    </>
  );
}
