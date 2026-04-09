import { motion } from 'framer-motion';
import {
  Eye,
  FileText,
  NotebookPen,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cleanAdminText,
  formatDateTime,
  formatNumber,
  getApplicationStatusLabel,
  getJobStatusLabel,
  getStatusTone,
} from '../lib/admin-dashboard';
import type { JobDraft, JobRecord } from '../lib/admin-store';
import { useAdmin } from '../lib/admin-store';
import {
  AdminBadge,
  AdminButton,
  AdminDataShell,
  AdminDialog,
  AdminDrawer,
  AdminEmptyState,
  AdminField,
  AdminFormSection,
  AdminInput,
  AdminSelect,
  AdminSwitch,
  AdminTextarea,
} from '../components/ui/admin-kit';

type JobFormState = {
  title: string;
  companyName: string;
  location: string;
  type: string;
  salary: string;
  sector: string;
  summary: string;
  applicationEnabled: boolean;
  featured: boolean;
  status: JobRecord['status'];
};

const EMPTY_FORM: JobFormState = {
  title: '',
  companyName: '',
  location: '',
  type: 'دوام كامل',
  salary: '',
  sector: '',
  summary: '',
  applicationEnabled: true,
  featured: false,
  status: 'pending',
};

function getJobForm(job?: JobRecord | null): JobFormState {
  if (!job) return EMPTY_FORM;
  return {
    title: cleanAdminText(job.title),
    companyName: cleanAdminText(job.companyName),
    location: cleanAdminText(job.location),
    type: cleanAdminText(job.type),
    salary: cleanAdminText(job.salary),
    sector: cleanAdminText(job.sector),
    summary: cleanAdminText(job.summary),
    applicationEnabled: job.applicationEnabled,
    featured: job.featured,
    status: job.status,
  };
}

function getJobDisplayStatus(job: JobRecord) {
  if (job.deletedAt) {
    return {
      tone: job.deletedBy === 'company' ? 'danger' : 'neutral',
      label: job.deletedBy === 'company' ? 'محذوفة من الشركة' : 'محذوفة',
    } as const;
  }

  return {
    tone: getStatusTone(job.status) as 'success' | 'warning' | 'danger' | 'neutral',
    label: getJobStatusLabel(job.status),
  } as const;
}

function getSortableDate(job: JobRecord) {
  return new Date(job.updatedAt || job.createdAt || 0).getTime();
}

export default function JobsPage() {
  const { state, saveJob, updateJobStatus, toggleJobFeatured, softDeleteJob, restoreJob, addNote } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [featuredFilter, setFeaturedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [editingJob, setEditingJob] = useState<JobRecord | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<JobFormState>(EMPTY_FORM);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'restore'; job: JobRecord } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [wideFormLayout, setWideFormLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1180px)').matches : false,
  );

  useEffect(() => {
    if (selectedJob) {
      const nextSelected = state.jobs.find((job) => job.id === selectedJob.id) || null;
      if (nextSelected !== selectedJob) setSelectedJob(nextSelected);
    }

    if (editingJob) {
      const nextEditing = state.jobs.find((job) => job.id === editingJob.id) || null;
      if (nextEditing !== editingJob) setEditingJob(nextEditing);
    }

    if (confirmAction) {
      const nextJob = state.jobs.find((job) => job.id === confirmAction.job.id) || null;
      if (!nextJob) {
        setConfirmAction(null);
      } else if (nextJob !== confirmAction.job) {
        setConfirmAction({ ...confirmAction, job: nextJob });
      }
    }
  }, [confirmAction, editingJob, selectedJob, state.jobs]);

  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (!jobId) return;
    const targetJob = state.jobs.find((job) => job.id === jobId) || null;
    if (targetJob && targetJob !== selectedJob) setSelectedJob(targetJob);
  }, [searchParams, selectedJob, state.jobs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 1180px)');
    const syncLayout = () => setWideFormLayout(mediaQuery.matches);
    syncLayout();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncLayout);
      return () => mediaQuery.removeEventListener('change', syncLayout);
    }

    mediaQuery.addListener(syncLayout);
    return () => mediaQuery.removeListener(syncLayout);
  }, []);

  const companies = useMemo(
    () =>
      Array.from(new Set(state.companies.filter((company) => !company.deletedAt).map((company) => cleanAdminText(company.name)))).sort(
        (first, second) => first.localeCompare(second, 'ar'),
      ),
    [state.companies],
  );

  const relatedApplications = (job: JobRecord) =>
    state.applications.filter(
      (application) =>
        !application.deletedAt &&
        cleanAdminText(application.jobTitle) === cleanAdminText(job.title) &&
        cleanAdminText(application.companyName) === cleanAdminText(job.companyName),
    );

  const visibleJobs = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    const filtered = state.jobs.filter((job) => {
      const searchTarget = [job.title, job.companyName, job.location, job.sector].map(cleanAdminText).join(' ').toLowerCase();
      const matchesQuery = !keyword || searchTarget.includes(keyword);
      const matchesCompany = companyFilter === 'all' ? true : cleanAdminText(job.companyName) === companyFilter;
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'deleted'
            ? Boolean(job.deletedAt)
            : !job.deletedAt && job.status === statusFilter;
      const matchesFeatured =
        featuredFilter === 'all' ? true : featuredFilter === 'featured' ? job.featured : !job.featured;

      return matchesQuery && matchesCompany && matchesStatus && matchesFeatured;
    });

    return filtered.sort((first, second) => {
      if (sortBy === 'applicants') return relatedApplications(second).length - relatedApplications(first).length;
      if (sortBy === 'featured') return Number(second.featured) - Number(first.featured) || getSortableDate(second) - getSortableDate(first);
      if (sortBy === 'name') return cleanAdminText(first.title).localeCompare(cleanAdminText(second.title), 'ar');
      return getSortableDate(second) - getSortableDate(first);
    });
  }, [companyFilter, featuredFilter, query, sortBy, state.applications, state.jobs, statusFilter]);

  const selectedJobApplications = selectedJob ? relatedApplications(selectedJob) : [];

  const openDrawer = (job: JobRecord) => {
    setSelectedJob(job);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('jobId', job.id);
      return next;
    });
  };

  const closeDrawer = () => {
    setSelectedJob(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('jobId');
      return next;
    });
  };

  const openCreateForm = () => {
    setEditingJob(null);
    setFormState(EMPTY_FORM);
    setFeedback('');
    setFormOpen(true);
  };

  const openEditForm = (job: JobRecord) => {
    setEditingJob(job);
    setFormState(getJobForm(job));
    setFeedback('');
    setFormOpen(true);
  };

  const submitForm = () => {
    if (!formState.title.trim()) {
      setFeedback('مسمى الوظيفة مطلوب.');
      return;
    }

    if (!formState.companyName.trim()) {
      setFeedback('اختر الشركة المرتبطة بالوظيفة.');
      return;
    }

    const draft: JobDraft = {
      title: formState.title.trim(),
      companyName: formState.companyName.trim(),
      location: formState.location.trim(),
      type: formState.type.trim(),
      salary: formState.salary.trim(),
      summary: formState.summary.trim(),
      sector: formState.sector.trim(),
      applicationEnabled: formState.applicationEnabled,
      featured: formState.featured,
      status: formState.status,
    };

    saveJob(draft, editingJob?.id || null);
    setFormOpen(false);
    setEditingJob(null);
    setFeedback('');
  };

  const persistJobPatch = (job: JobRecord, patch: Partial<JobDraft>) => {
    saveJob(
      {
        title: cleanAdminText(job.title),
        companyName: cleanAdminText(job.companyName),
        location: cleanAdminText(job.location),
        type: cleanAdminText(job.type),
        salary: cleanAdminText(job.salary),
        summary: cleanAdminText(job.summary),
        sector: cleanAdminText(job.sector),
        applicationEnabled: job.applicationEnabled,
        featured: job.featured,
        status: job.status,
        ...patch,
      },
      job.id,
    );
  };

  const submitNote = () => {
    if (!selectedJob || !noteDraft.trim()) return;
    addNote('jobs', selectedJob.id, noteDraft.trim());
    setNoteDraft('');
    setFeedback('تم حفظ الملاحظة الداخلية.');
  };

  const renderJobActions = (job: JobRecord) => (
    <div className="flex flex-wrap gap-2">
      <AdminButton variant="ghost" onClick={() => openDrawer(job)}>
        <Eye size={15} />
        عرض
      </AdminButton>

      {!job.deletedAt ? (
        <>
          <AdminButton variant="secondary" onClick={() => openEditForm(job)}>
            <PencilLine size={15} />
            تعديل
          </AdminButton>

          <AdminButton variant="ghost" onClick={() => toggleJobFeatured(job.id)}>
            <Sparkles size={15} />
            {job.featured ? 'إلغاء التمييز' : 'تمييز'}
          </AdminButton>

          <AdminButton variant="ghost" onClick={() => persistJobPatch(job, { applicationEnabled: !job.applicationEnabled })}>
            {job.applicationEnabled ? 'إيقاف التقديم' : 'فتح التقديم'}
          </AdminButton>

          <AdminButton
            variant="ghost"
            onClick={() => updateJobStatus(job.id, job.status === 'approved' ? 'hidden' : 'approved')}
          >
            {job.status === 'approved' ? 'إخفاء' : 'تفعيل'}
          </AdminButton>

          <AdminButton variant="danger" onClick={() => setConfirmAction({ type: 'delete', job })}>
            <Trash2 size={15} />
            حذف
          </AdminButton>
        </>
      ) : (
        <AdminButton variant="secondary" onClick={() => setConfirmAction({ type: 'restore', job })}>
          <RotateCcw size={15} />
          استرجاع
        </AdminButton>
      )}
    </div>
  );

  return (
    <>
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#7690ab]">لوحة الإدارة - الوظائف</p>
          <h1 className="mt-1 text-[clamp(1.7rem,2.8vw,2.5rem)] font-black text-[#0f223d]">إدارة الوظائف والنشر والتقديم</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#64768a]">
            من هنا تدير الوظائف، تتابع حالة النشر، وتراجع أثر حذف الشركة للوظيفة مع إمكانية الاسترجاع من داخل الأدمن.
          </p>
        </div>

        <AdminButton onClick={openCreateForm}>
          <Plus size={16} />
          إضافة وظيفة
        </AdminButton>
      </section>

      <AdminDataShell
        toolbar={
          <div className="grid gap-3 xl:grid-cols-[180px_180px_220px_220px_minmax(0,1fr)_auto]">
            <AdminSelect value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="latest">الأحدث أولاً</option>
              <option value="applicants">الأكثر متقدمين</option>
              <option value="featured">المميزة أولاً</option>
              <option value="name">الاسم: أ - ي</option>
            </AdminSelect>

            <AdminSelect value={featuredFilter} onChange={(event) => setFeaturedFilter(event.target.value)}>
              <option value="all">كل الوظائف</option>
              <option value="featured">المميزة فقط</option>
              <option value="normal">العادية فقط</option>
            </AdminSelect>

            <AdminSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">كل الحالات</option>
              <option value="approved">نشطة</option>
              <option value="pending">قيد المراجعة</option>
              <option value="hidden">مخفية</option>
              <option value="rejected">مرفوضة</option>
              <option value="deleted">محذوفة</option>
            </AdminSelect>

            <AdminSelect value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
              <option value="all">كل الشركات</option>
              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </AdminSelect>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8797aa]" size={18} />
              <AdminInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-12"
                placeholder="ابحث في الوظائف أو الشركات..."
              />
            </div>

            <AdminButton onClick={openCreateForm}>
              <Plus size={16} />
              وظيفة جديدة
            </AdminButton>
          </div>
        }
      >
        {visibleJobs.length ? (
          <>
            <div className="grid gap-3 p-4 lg:hidden">
              {visibleJobs.map((job, index) => {
                const applicantsCount = relatedApplications(job).length;
                const displayStatus = getJobDisplayStatus(job);

                return (
                  <motion.article
                    key={`mobile-${job.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
                    className="rounded-[1.15rem] border border-[rgba(24,37,63,0.08)] bg-white p-4 shadow-[0_14px_28px_rgba(18,30,54,0.06)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[1rem] font-black text-[#11213d]">{cleanAdminText(job.title)}</div>
                      <div className="mt-1 text-xs leading-6 text-[#75869a]">
                        {cleanAdminText(job.summary || 'لا يوجد وصف مختصر لهذه الوظيفة حتى الآن.')}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1rem] bg-[#f7f9fc] px-3.5 py-3">
                        <div className="text-[11px] font-bold text-[#7a8b9e]">الشركة</div>
                        <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(job.companyName || 'غير محددة')}</div>
                      </div>

                      <div className="rounded-[1rem] bg-[#f7f9fc] px-3.5 py-3">
                        <div className="text-[11px] font-bold text-[#7a8b9e]">الموقع</div>
                        <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(job.location || 'غير محدد')}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <AdminBadge tone={displayStatus.tone}>{displayStatus.label}</AdminBadge>
                      <AdminBadge tone={job.featured ? 'success' : 'neutral'}>{job.featured ? 'مميزة' : 'عادية'}</AdminBadge>
                      <AdminBadge tone={job.applicationEnabled ? 'success' : 'danger'}>
                        {job.applicationEnabled ? 'التقديم مفتوح' : 'التقديم موقوف'}
                      </AdminBadge>
                    </div>

                    {job.deletedAt && job.deletedBy === 'company' ? (
                      <div className="mt-3 rounded-[1rem] border border-[#f2d2d2] bg-[#fff5f5] px-3.5 py-3 text-[12px] font-bold leading-6 text-[#b14949]">
                        الشركة حذفت هذه الوظيفة من لوحتها، وما زال بإمكان الأدمن استعادتها أو إبقاؤها محذوفة.
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[1rem] border border-[rgba(24,37,63,0.08)] px-3.5 py-3">
                        <div className="text-[11px] font-bold text-[#7a8b9e]">المتقدمون</div>
                        <div className="mt-2 text-base font-black text-[#122341]">{formatNumber(applicantsCount)}</div>
                      </div>

                      <div className="rounded-[1rem] border border-[rgba(24,37,63,0.08)] px-3.5 py-3">
                        <div className="text-[11px] font-bold text-[#7a8b9e]">نوع الوظيفة</div>
                        <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(job.type || 'غير محدد')}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">{renderJobActions(job)}</div>
                  </motion.article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="rm-table min-w-[1180px]">
                <thead>
                  <tr>
                    <th>الوظيفة</th>
                    <th>الشركة</th>
                    <th>الموقع</th>
                    <th>التقديمات</th>
                    <th>الحالة</th>
                    <th>التمييز</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job, index) => {
                    const displayStatus = getJobDisplayStatus(job);
                    return (
                      <motion.tr
                        key={job.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03, duration: 0.2 }}
                      >
                        <td>
                          <div className="min-w-0">
                            <div className="text-[1rem] font-black text-[#11213d]">{cleanAdminText(job.title)}</div>
                            <div className="mt-1 text-xs leading-6 text-[#75869a]">
                              {cleanAdminText(job.summary || 'لا يوجد وصف مختصر لهذه الوظيفة حتى الآن.')}
                            </div>
                            {job.deletedAt && job.deletedBy === 'company' ? (
                              <div className="mt-2 text-[11px] font-bold text-[#b54b4b]">
                                حذفتها الشركة من لوحتها، ويمكنك استعادتها من هنا.
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td>{cleanAdminText(job.companyName || 'غير محددة')}</td>
                        <td>{cleanAdminText(job.location || 'غير محدد')}</td>
                        <td className="font-black text-[#11213d]">{formatNumber(relatedApplications(job).length)} متقدم</td>
                        <td>
                          <AdminBadge tone={displayStatus.tone}>{displayStatus.label}</AdminBadge>
                        </td>
                        <td>
                          <AdminBadge tone={job.featured ? 'success' : 'neutral'}>{job.featured ? 'مميزة' : 'عادية'}</AdminBadge>
                        </td>
                        <td>
                          <div className="flex flex-wrap justify-end gap-2">{renderJobActions(job)}</div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="p-6">
            <AdminEmptyState
              title="لا توجد وظائف مطابقة"
              description="غيّر الفلاتر الحالية أو أضف وظيفة جديدة لتبدأ الإدارة من هنا."
              action={
                <AdminButton onClick={openCreateForm}>
                  <Plus size={16} />
                  إضافة وظيفة
                </AdminButton>
              }
            />
          </div>
        )}
      </AdminDataShell>

      <AdminDrawer
        open={Boolean(selectedJob)}
        onClose={closeDrawer}
        title={selectedJob ? cleanAdminText(selectedJob.title) : ''}
        description="تفاصيل الوظيفة، حالتها الحالية، والمتقدمون المرتبطون بها."
      >
        {selectedJob ? (
          <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-[rgba(24,37,63,0.08)] bg-white px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <AdminBadge tone={getJobDisplayStatus(selectedJob).tone}>{getJobDisplayStatus(selectedJob).label}</AdminBadge>
                <AdminBadge tone={selectedJob.featured ? 'success' : 'neutral'}>
                  {selectedJob.featured ? 'وظيفة مميزة' : 'وظيفة عادية'}
                </AdminBadge>
                <AdminBadge tone={selectedJob.applicationEnabled ? 'success' : 'danger'}>
                  {selectedJob.applicationEnabled ? 'التقديم مفتوح' : 'التقديم موقوف'}
                </AdminBadge>
              </div>

              {selectedJob.deletedAt && selectedJob.deletedBy === 'company' ? (
                <div className="mt-4 rounded-[1rem] border border-[#f2d2d2] bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#b14949]">
                  هذه الوظيفة حذفتها الشركة من لوحتها، وما زال من حق الأدمن استعادتها أو إبقاؤها محذوفة.
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">{renderJobActions(selectedJob)}</div>

              <div className="mt-4 text-sm leading-8 text-[#627487]">
                {cleanAdminText(selectedJob.summary || 'لا يوجد وصف مضاف لهذه الوظيفة بعد.')}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.25rem] bg-[#f7f9fc] px-4 py-4">
                <div className="text-xs font-bold text-[#7a8b9e]">الشركة</div>
                <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(selectedJob.companyName)}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[#f7f9fc] px-4 py-4">
                <div className="text-xs font-bold text-[#7a8b9e]">نوع الوظيفة</div>
                <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(selectedJob.type)}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[#f7f9fc] px-4 py-4">
                <div className="text-xs font-bold text-[#7a8b9e]">الموقع</div>
                <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(selectedJob.location || 'غير محدد')}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[#f7f9fc] px-4 py-4">
                <div className="text-xs font-bold text-[#7a8b9e]">الراتب</div>
                <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(selectedJob.salary || 'غير محدد')}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[#f7f9fc] px-4 py-4">
                <div className="text-xs font-bold text-[#7a8b9e]">القطاع</div>
                <div className="mt-2 text-sm font-black text-[#122341]">{cleanAdminText(selectedJob.sector || 'غير محدد')}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[#f7f9fc] px-4 py-4">
                <div className="text-xs font-bold text-[#7a8b9e]">عدد المتقدمين</div>
                <div className="mt-2 text-sm font-black text-[#122341]">{formatNumber(selectedJobApplications.length)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-black text-[#122341]">
                <FileText size={16} />
                الطلبات المرتبطة بالوظيفة
              </div>

              {selectedJobApplications.length ? (
                <div className="space-y-2">
                  {selectedJobApplications.map((application) => (
                    <div key={application.id} className="rounded-[1rem] bg-[#f7f9fc] px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-[#122341]">
                            {cleanAdminText(application.applicantName || 'متقدم')}
                          </div>
                          <div className="mt-1 text-xs text-[#74859a]">
                            {cleanAdminText(application.companyName)} • رقم الطلب {cleanAdminText(application.requestId)}
                          </div>
                        </div>
                        <AdminBadge tone={getStatusTone(application.status) as 'success' | 'warning' | 'danger' | 'neutral'}>
                          {getApplicationStatusLabel(application.status)}
                        </AdminBadge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState title="لا توجد طلبات مرتبطة" description="أي طلب يصل لهذه الوظيفة سيظهر هنا مباشرة." />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-black text-[#122341]">
                <NotebookPen size={16} />
                ملاحظات الإدارة
              </div>

              <AdminTextarea
                rows={4}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="أضف ملاحظة داخلية عن الوظيفة أو سبب الإيقاف أو أي متابعة مطلوبة..."
              />

              <div className="flex justify-end">
                <AdminButton onClick={submitNote} disabled={!noteDraft.trim()}>
                  <Plus size={16} />
                  حفظ الملاحظة
                </AdminButton>
              </div>

              {selectedJob.notes.length ? (
                <div className="space-y-2">
                  {selectedJob.notes.map((note) => (
                    <div key={note.id} className="rounded-[1rem] border border-[rgba(24,37,63,0.08)] bg-white px-4 py-3.5">
                      <div className="text-sm font-black text-[#122341]">{cleanAdminText(note.body)}</div>
                      <div className="mt-2 text-[11px] font-bold text-[#8291a3]">
                        {cleanAdminText(note.authorName)} • {formatDateTime(note.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState title="لا توجد ملاحظات بعد" description="أول ملاحظة داخلية على الوظيفة ستظهر هنا." />
              )}
            </div>
          </div>
        ) : null}
      </AdminDrawer>

      <AdminDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingJob(null);
        }}
        size="lg"
        title={editingJob ? 'تعديل الوظيفة' : 'إضافة وظيفة جديدة'}
        description="أدخل بيانات الوظيفة بشكل مرتب وواضح حتى تظهر بسهولة داخل لوحة الإدارة وعلى الموقع."
      >
        <div className="space-y-3">
          {feedback ? (
            <div className="rounded-[0.85rem] border border-[#f0c8c8] bg-[#fff5f5] px-3 py-2 text-[0.75rem] font-bold text-[#b94c4c]">
              {feedback}
            </div>
          ) : null}

          <AdminFormSection
            key={`job-basics-${wideFormLayout ? 'wide' : 'compact'}`}
            title="البيانات الأساسية"
            description="اسم الوظيفة، الشركة، الموقع، النوع، القطاع، والراتب."
            defaultOpen
            contentClassName="space-y-3"
          >
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              <AdminField label="مسمى الوظيفة" required>
                <AdminInput value={formState.title} onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))} />
              </AdminField>
              <AdminField label="الشركة" required>
                <AdminSelect
                  value={formState.companyName}
                  onChange={(event) => setFormState((current) => ({ ...current, companyName: event.target.value }))}
                >
                  <option value="">اختر الشركة</option>
                  {companies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
              <AdminField label="الموقع">
                <AdminInput value={formState.location} onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))} />
              </AdminField>
              <AdminField label="نوع الوظيفة">
                <AdminSelect value={formState.type} onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value }))}>
                  {['دوام كامل', 'دوام جزئي', 'عن بعد', 'عقد مؤقت'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
              <AdminField label="القطاع">
                <AdminInput value={formState.sector} onChange={(event) => setFormState((current) => ({ ...current, sector: event.target.value }))} />
              </AdminField>
              <AdminField label="الراتب">
                <AdminInput value={formState.salary} onChange={(event) => setFormState((current) => ({ ...current, salary: event.target.value }))} />
              </AdminField>
            </div>
          </AdminFormSection>

          <AdminFormSection
            key={`job-summary-${wideFormLayout ? 'wide' : 'compact'}`}
            title="الوصف والمحتوى"
            description="ملخص واضح عن المهام والمتطلبات حتى يظهر النص بشكل منظم."
            defaultOpen={wideFormLayout}
          >
            <AdminField label="وصف الوظيفة">
              <AdminTextarea
                rows={4}
                value={formState.summary}
                onChange={(event) => setFormState((current) => ({ ...current, summary: event.target.value }))}
              />
            </AdminField>
          </AdminFormSection>

          <AdminFormSection
            key={`job-controls-${wideFormLayout ? 'wide' : 'compact'}`}
            title="الحالة والتحكم"
            description="إدارة حالة الوظيفة، فتح أو إيقاف التقديم، وتمييز الوظيفة داخل الموقع."
            defaultOpen={wideFormLayout}
            contentClassName="space-y-3"
          >
            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <AdminField label="حالة الوظيفة">
                <AdminSelect
                  value={formState.status}
                  onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as JobRecord['status'] }))}
                >
                  <option value="pending">قيد المراجعة</option>
                  <option value="approved">نشطة</option>
                  <option value="hidden">مخفية</option>
                  <option value="rejected">مرفوضة</option>
                </AdminSelect>
              </AdminField>

              <AdminSwitch
                checked={formState.applicationEnabled}
                onCheckedChange={(applicationEnabled) => setFormState((current) => ({ ...current, applicationEnabled }))}
                label="فتح التقديم على الوظيفة"
                description="يمكنك إيقاف التقديم مؤقتًا من هنا وسيظهر ذلك مباشرة على الموقع."
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-[1rem] border border-[rgba(24,37,63,0.08)] bg-[#f7f9fc] px-3.5 py-3 sm:px-4">
              <div>
                <div className="text-[0.84rem] font-black text-[#122341] sm:text-[0.88rem]">تمييز الوظيفة</div>
                <div className="mt-1 text-[0.72rem] leading-5 text-[#74859a] sm:text-[10px] sm:leading-[1.45]">
                  استخدم التمييز لرفع أولوية الوظيفة وإبرازها داخل الموقع.
                </div>
              </div>

              <input
                checked={formState.featured}
                onChange={(event) => setFormState((current) => ({ ...current, featured: event.target.checked }))}
                type="checkbox"
                className="h-4 w-4 rounded border-[#c4cfda] text-[#24436a] focus:ring-[#24436a]"
              />
            </label>
          </AdminFormSection>

          <div className="flex flex-col-reverse gap-2 pt-0.5 sm:flex-row sm:justify-end">
            <AdminButton
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => {
                setFormOpen(false);
                setEditingJob(null);
              }}
            >
              إلغاء
            </AdminButton>

            <AdminButton className="w-full sm:w-auto" onClick={submitForm}>
              {editingJob ? 'حفظ التعديلات' : 'إضافة الوظيفة'}
            </AdminButton>
          </div>
        </div>
      </AdminDialog>

      <AdminDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'delete' ? 'تأكيد حذف الوظيفة' : 'تأكيد استرجاع الوظيفة'}
        description={
          confirmAction?.type === 'delete'
            ? 'سيتم حذف الوظيفة من الواجهة العامة مع تسجيل جهة الحذف داخل الأدمن.'
            : 'سيتم استعادة الوظيفة وإرجاعها إلى حالتها الأصلية قبل الحذف.'
        }
      >
        <div className="flex justify-end gap-3">
          <AdminButton variant="ghost" onClick={() => setConfirmAction(null)}>
            إلغاء
          </AdminButton>

          <AdminButton
            variant={confirmAction?.type === 'delete' ? 'danger' : 'secondary'}
            onClick={() => {
              if (!confirmAction) return;
              if (confirmAction.type === 'delete') {
                softDeleteJob(confirmAction.job.id);
              } else {
                restoreJob(confirmAction.job.id);
              }
              setConfirmAction(null);
            }}
          >
            {confirmAction?.type === 'delete' ? 'تأكيد الحذف' : 'استرجاع الوظيفة'}
          </AdminButton>
        </div>
      </AdminDialog>
    </>
  );
}
