import { AnimatePresence, motion } from 'framer-motion';
import {
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  Eye,
  Globe,
  Mail,
  NotebookPen,
  PencilLine,
  Phone,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  cleanAdminText,
  formatDateTime,
  formatNumber,
  getApplicationStatusLabel,
  getCompanyStatusLabel,
  getJobStatusLabel,
} from '../lib/admin-dashboard';
import { getFirebaseServices, hasFirebaseConfig } from '../lib/firebase';
import type { CompanyDraft, CompanyRecord, CompanySocialLinks } from '../lib/admin-store';
import { useAdmin } from '../lib/admin-store';
import {
  AdminButton,
  AdminDataShell,
  AdminDialog,
  AdminDrawer,
  AdminEmptyState,
  AdminField,
  AdminFormSection,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  AdminStatCard,
  AdminStatusBadge,
  AdminTextarea,
} from '../components/ui/admin-kit';

type CompanyFormState = {
  name: string;
  email: string;
  phone: string;
  landline: string;
  address: string;
  sector: string;
  location: string;
  summary: string;
  website: string;
  socialLinks: CompanySocialLinks;
  status: CompanyRecord['status'];
  verified: boolean;
  siteMode: CompanyRecord['siteMode'];
  restrictionMessage: string;
  restrictionAttachmentUrl: string | null;
  restrictionAttachmentName: string;
  imageUrl: string;
};

type FeedbackState = { tone: 'success' | 'danger'; text: string } | null;

const EMPTY_SOCIAL_LINKS: CompanySocialLinks = { facebook: '', instagram: '', linkedin: '', x: '' };
const EMPTY_FORM: CompanyFormState = {
  name: '',
  email: '',
  phone: '',
  landline: '',
  address: '',
  sector: '',
  location: '',
  summary: '',
  website: '',
  socialLinks: EMPTY_SOCIAL_LINKS,
  status: 'pending',
  verified: false,
  siteMode: 'full',
  restrictionMessage: '',
  restrictionAttachmentUrl: null,
  restrictionAttachmentName: '',
  imageUrl: '',
};

function normalizeText(value: string) {
  return cleanAdminText(value).trim().toLowerCase();
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function countActiveSocialLinks(links: CompanySocialLinks | null | undefined) {
  if (!links) return 0;
  return [links.facebook, links.instagram, links.linkedin, links.x]
    .map((item) => cleanAdminText(item || '').trim())
    .filter(Boolean).length;
}

function buildUploadSlug(value: string) {
  const slug = cleanAdminText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `company-${Date.now()}`;
}

function getActionErrorText(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = cleanAdminText(error.message || '').trim();
    if (message) return message;
  }

  if (typeof error === 'string') {
    const message = cleanAdminText(error).trim();
    if (message) return message;
  }

  return fallback;
}

function getFormState(company?: CompanyRecord | null): CompanyFormState {
  if (!company) return EMPTY_FORM;
  return {
    name: cleanAdminText(company.name),
    email: cleanAdminText(company.email),
    phone: cleanAdminText(company.phone),
    landline: cleanAdminText(company.landline),
    address: cleanAdminText(company.address),
    sector: cleanAdminText(company.sector),
    location: cleanAdminText(company.location),
    summary: cleanAdminText(company.summary),
    website: cleanAdminText(company.website),
    socialLinks: {
      facebook: cleanAdminText(company.socialLinks?.facebook || ''),
      instagram: cleanAdminText(company.socialLinks?.instagram || ''),
      linkedin: cleanAdminText(company.socialLinks?.linkedin || ''),
      x: cleanAdminText(company.socialLinks?.x || ''),
    },
    status: company.status,
    verified: company.verified,
    siteMode: company.siteMode === 'landing' ? 'landing' : 'full',
    restrictionMessage: cleanAdminText(company.restrictionMessage),
    restrictionAttachmentUrl: company.restrictionAttachmentUrl || null,
    restrictionAttachmentName: cleanAdminText(company.restrictionAttachmentName),
    imageUrl: cleanAdminText(company.imageUrl || ''),
  };
}

export default function Companies() {
  const navigate = useNavigate();
  const { state, saveCompany, updateCompanyStatus, toggleCompanyVerified, softDeleteCompany, restoreCompany, addNote, refreshFromSite } =
    useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(null);
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<CompanyFormState>(EMPTY_FORM);
  const [noteDraft, setNoteDraft] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [sendingResetForCompanyId, setSendingResetForCompanyId] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const companyId = searchParams.get('companyId');
    if (!companyId) return;
    const target = state.companies.find((item) => item.id === companyId) || null;
    if (target && target !== selectedCompany) setSelectedCompany(target);
  }, [searchParams, selectedCompany, state.companies]);

  useEffect(() => {
    if (selectedCompany) {
      const nextSelected = state.companies.find((item) => item.id === selectedCompany.id) || null;
      if (nextSelected !== selectedCompany) setSelectedCompany(nextSelected);
    }
    if (editingCompany) {
      const nextEditing = state.companies.find((item) => item.id === editingCompany.id) || null;
      if (nextEditing !== editingCompany) setEditingCompany(nextEditing);
    }
  }, [editingCompany, selectedCompany, state.companies]);

  const companyJobsMap = useMemo(
    () =>
      new Map(
        state.companies.map((company) => [
          company.id,
          state.jobs.filter((job) => normalizeText(job.companyName) === normalizeText(company.name)),
        ]),
      ),
    [state.companies, state.jobs],
  );

  const companyApplicationsMap = useMemo(
    () =>
      new Map(
        state.companies.map((company) => [
          company.id,
          state.applications.filter(
            (application) => !application.deletedAt && normalizeText(application.companyName) === normalizeText(company.name),
          ),
        ]),
      ),
    [state.applications, state.companies],
  );

  const visibleCompanies = useMemo(() => {
    const keyword = normalizeText(query);
    return state.companies.filter((company) => {
      const searchTarget = [
        company.name,
        company.email,
        company.phone,
        company.landline,
        company.sector,
        company.location,
        company.website,
      ]
        .map(normalizeText)
        .join(' ');
      const matchesQuery = !keyword || searchTarget.includes(keyword);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'deleted'
            ? Boolean(company.deletedAt)
            : !company.deletedAt && company.status === statusFilter;
      const matchesMode = modeFilter === 'all' ? true : company.siteMode === modeFilter;
      return matchesQuery && matchesStatus && matchesMode;
    });
  }, [modeFilter, query, state.companies, statusFilter]);

  const selectedJobs = selectedCompany ? companyJobsMap.get(selectedCompany.id) || [] : [];
  const selectedApplications = selectedCompany ? companyApplicationsMap.get(selectedCompany.id) || [] : [];
  const selectedAuditLogs = selectedCompany
    ? state.auditLogs.filter((log) => log.entityType === 'companies' && log.entityLabel === selectedCompany.id).slice(0, 8)
    : [];

  const openDrawer = (company: CompanyRecord) => {
    setSelectedCompany(company);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('companyId', company.id);
      return next;
    });
  };

  const closeDrawer = () => {
    setSelectedCompany(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('companyId');
      return next;
    });
  };

  const persistCompanyPatch = (company: CompanyRecord, patch: Partial<CompanyDraft>) => {
    saveCompany(
      {
        name: cleanAdminText(company.name),
        email: cleanAdminText(company.email),
        phone: cleanAdminText(company.phone),
        landline: cleanAdminText(company.landline),
        address: cleanAdminText(company.address),
        sector: cleanAdminText(company.sector),
        location: cleanAdminText(company.location),
        summary: cleanAdminText(company.summary),
        website: cleanAdminText(company.website),
        socialLinks: {
          facebook: cleanAdminText(company.socialLinks?.facebook || ''),
          instagram: cleanAdminText(company.socialLinks?.instagram || ''),
          linkedin: cleanAdminText(company.socialLinks?.linkedin || ''),
          x: cleanAdminText(company.socialLinks?.x || ''),
        },
        status: company.status,
        verified: company.verified,
        siteMode: company.siteMode,
        restrictionMessage: cleanAdminText(company.restrictionMessage),
        restrictionAttachmentUrl: company.restrictionAttachmentUrl || null,
        restrictionAttachmentName: cleanAdminText(company.restrictionAttachmentName),
        imageUrl: cleanAdminText(company.imageUrl || ''),
        ...patch,
      },
      company.id,
    );
  };

  const uploadAsset = async (file: File, folder: 'logo' | 'restriction', companyName: string) => {
    if (!hasFirebaseConfig()) return { ok: false as const, message: 'رفع الملفات يحتاج Firebase.' };
    try {
      const services = await getFirebaseServices();
      if (!services) return { ok: false as const, message: 'تعذر تهيئة خدمة الرفع.' };
      const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `admin/company-assets/${folder}/${buildUploadSlug(companyName)}-${Date.now()}.${extension}`;
      const storageRef = services.storageModule.ref(services.storage, path);
      const uploaded = await services.storageModule.uploadBytes(storageRef, file, { contentType: file.type || undefined });
      const url = await services.storageModule.getDownloadURL(uploaded.ref);
      return { ok: true as const, url, name: file.name };
    } catch {
      return { ok: false as const, message: 'فشل رفع الملف.' };
    }
  };

  const handleAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    const result = await uploadAsset(file, 'restriction', formState.name || editingCompany?.name || 'company');
    setUploadingAttachment(false);
    event.target.value = '';
    if (!result.ok) {
      setFeedback({ tone: 'danger', text: result.message });
      return;
    }
    setFormState((current) => ({
      ...current,
      restrictionAttachmentUrl: result.url,
      restrictionAttachmentName: result.name,
    }));
    setFeedback({ tone: 'success', text: 'تم رفع المرفق.' });
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const result = await uploadAsset(file, 'logo', formState.name || editingCompany?.name || 'company');
    setUploadingLogo(false);
    event.target.value = '';
    if (!result.ok) {
      setFeedback({ tone: 'danger', text: result.message });
      return;
    }
    setFormState((current) => ({ ...current, imageUrl: result.url }));
    setFeedback({ tone: 'success', text: 'تم رفع شعار الشركة.' });
  };

  const sendCompanyPasswordReset = async (company: CompanyRecord) => {
    const companyEmail = cleanAdminText(company.email || '').trim();
    if (!companyEmail) {
      setFeedback({ tone: 'danger', text: 'لا يوجد بريد إلكتروني مسجل لهذه الشركة.' });
      return;
    }

    if (!hasFirebaseConfig()) {
      setFeedback({ tone: 'danger', text: 'إرسال رابط إعادة التعيين يحتاج إعداد Firebase صحيح.' });
      return;
    }

    setSendingResetForCompanyId(company.id);
    try {
      const services = await getFirebaseServices();
      if (!services) {
        throw new Error('تعذر تهيئة Firebase حاليًا.');
      }

      await services.authModule.sendPasswordResetEmail(services.auth, companyEmail);
      addNote('companies', company.id, `تم إرسال رابط إعادة تعيين كلمة السر إلى البريد: ${companyEmail}`);
      setFeedback({
        tone: 'success',
        text: `تم إرسال رابط إعادة تعيين كلمة السر إلى ${companyEmail}.`,
      });
    } catch (error) {
      setFeedback({
        tone: 'danger',
        text: getActionErrorText(error, 'تعذر إرسال رابط إعادة التعيين الآن.'),
      });
    } finally {
      setSendingResetForCompanyId(null);
    }
  };

  const submitForm = () => {
    if (!formState.name.trim() || !formState.email.trim() || !formState.phone.trim()) {
      setFeedback({ tone: 'danger', text: 'اسم الشركة والبريد والموبايل حقول أساسية.' });
      return;
    }
    if (!formState.sector.trim() || !formState.location.trim()) {
      setFeedback({ tone: 'danger', text: 'أكمل القطاع والموقع قبل الحفظ.' });
      return;
    }
    if (formState.status === 'restricted' && !formState.restrictionMessage.trim()) {
      setFeedback({ tone: 'danger', text: 'قبل إيقاف الشركة أضف سبب الإيقاف وتعليمات صاحب الموقع.' });
      return;
    }
    saveCompany(
      {
        name: formState.name.trim(),
        email: formState.email.trim(),
        phone: formState.phone.trim(),
        landline: formState.landline.trim(),
        address: formState.address.trim(),
        sector: formState.sector.trim(),
        location: formState.location.trim(),
        summary: formState.summary.trim(),
        website: normalizeUrl(formState.website),
        socialLinks: {
          facebook: normalizeUrl(formState.socialLinks.facebook),
          instagram: normalizeUrl(formState.socialLinks.instagram),
          linkedin: normalizeUrl(formState.socialLinks.linkedin),
          x: normalizeUrl(formState.socialLinks.x),
        },
        status: formState.status,
        verified: formState.verified,
        siteMode: formState.siteMode,
        restrictionMessage: formState.restrictionMessage.trim(),
        restrictionAttachmentUrl: formState.restrictionAttachmentUrl || null,
        restrictionAttachmentName: formState.restrictionAttachmentName.trim(),
        imageUrl: formState.imageUrl.trim(),
      },
      editingCompany?.id || null,
    );
    setFormOpen(false);
    setEditingCompany(null);
    setFeedback({ tone: 'success', text: editingCompany ? 'تم تحديث ملف الشركة.' : 'تم إنشاء ملف الشركة.' });
  };

  const submitNote = () => {
    if (!selectedCompany || !noteDraft.trim()) return;
    addNote('companies', selectedCompany.id, noteDraft.trim());
    setNoteDraft('');
    setFeedback({ tone: 'success', text: 'تمت إضافة الملاحظة الداخلية.' });
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
                  ? 'rounded-[1rem] border border-[#c9ead7] bg-[#e9faef] px-5 py-3 text-sm font-black text-[#22744c] shadow-[0_18px_36px_rgba(34,116,76,0.14)]'
                  : 'rounded-[1rem] border border-[#f0cbcb] bg-[#fff5f5] px-5 py-3 text-sm font-black text-[#b14f4f] shadow-[0_18px_36px_rgba(177,79,79,0.12)]'
              }
            >
              {feedback.text}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="space-y-5">
        <AdminPageHeader
          eyebrow="إدارة الشركات"
          title="ملفات الشركات والتحكم في ظهورها"
          description="بيانات الشركة، وضع ظهورها على الموقع، وروابط التواصل كلها من شاشة واحدة أخف وأسهل."
          actions={
            <>
              <AdminButton variant="soft" onClick={refreshFromSite}>
                <RefreshCcw size={16} />
                تحديث
              </AdminButton>
              <AdminButton
                onClick={() => {
                  setEditingCompany(null);
                  setFormState(EMPTY_FORM);
                  setFormOpen(true);
                }}
              >
                <Plus size={16} />
                إضافة شركة
              </AdminButton>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <AdminStatCard label="نشطة" value={formatNumber(state.companies.filter((item) => !item.deletedAt && item.status === 'approved').length)} helper="ظاهرة على الموقع" icon={Building2} tone="primary" />
          <AdminStatCard label="مراجعة" value={formatNumber(state.companies.filter((item) => !item.deletedAt && item.status === 'pending').length)} helper="بانتظار الاعتماد" icon={ShieldCheck} tone="secondary" />
          <AdminStatCard label="موقوفة" value={formatNumber(state.companies.filter((item) => !item.deletedAt && item.status === 'restricted').length)} helper="محجوبة من الظهور والدخول" icon={ShieldCheck} tone="accent" />
          <AdminStatCard label="محذوفة" value={formatNumber(state.companies.filter((item) => item.deletedAt).length)} helper="محذوفة بقرار نهائي مع إمكانية الاستعادة" icon={Trash2} tone="accent" />
          <AdminStatCard label="واجهة فقط" value={formatNumber(state.companies.filter((item) => !item.deletedAt && item.siteMode === 'landing').length)} helper="ملف تعريفي بدون وظائف عامة" icon={Globe} tone="success" />
        </div>

        <AdminDataShell
          toolbar={
            <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8a99ab]" size={16} />
                <AdminInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث باسم الشركة أو البريد أو الهاتف..."
                  className="pl-11"
                />
              </div>

              <AdminSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">كل الحالات</option>
                <option value="approved">نشطة</option>
                <option value="pending">قيد المراجعة</option>
                <option value="restricted">موقوفة</option>
                <option value="deleted">محذوفة</option>
              </AdminSelect>

              <AdminSelect value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
                <option value="all">كل الأوضاع</option>
                <option value="full">موقع كامل</option>
                <option value="landing">واجهة تعريفية فقط</option>
              </AdminSelect>
            </div>
          }
        >
          {visibleCompanies.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleCompanies.map((company) => {
                const jobsCount = (companyJobsMap.get(company.id) || []).filter((job) => !job.deletedAt).length;
                const applicationsCount = companyApplicationsMap.get(company.id)?.length || 0;
                return (
                  <motion.article
                    key={company.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[1.35rem] border border-[rgba(17,34,63,0.08)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-4 shadow-[0_16px_34px_rgba(17,34,63,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-[1.02rem] font-black text-[#10213c]">{cleanAdminText(company.name)}</h2>
                          <AdminStatusBadge
                            status={company.deletedAt ? 'rejected' : company.status}
                            label={company.deletedAt ? 'محذوفة' : getCompanyStatusLabel(company.status)}
                          />
                          {company.verified ? <AdminStatusBadge status="approved" label="موثقة" /> : null}
                          {company.siteMode === 'landing' ? <AdminStatusBadge status="hidden" label="واجهة تعريفية" /> : null}
                        </div>
                        <p className="mt-1 text-xs leading-6 text-[#6a7d92]">
                          {cleanAdminText(company.sector || 'بدون قطاع')} - {cleanAdminText(company.location || 'بدون موقع')}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[1rem] border border-[rgba(17,34,63,0.08)] bg-[#f4f7fb]">
                        {company.imageUrl ? (
                          <img src={company.imageUrl} alt={cleanAdminText(company.name)} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-black text-[#17355b]">{cleanAdminText(company.logoLetter || 'ش')}</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-[0.78rem] text-[#4d6177] sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-[#7f90a4]" />
                        <span className="truncate">{cleanAdminText(company.email || 'بدون بريد')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-[#7f90a4]" />
                        <span className="truncate">{cleanAdminText(company.phone || 'بدون موبايل')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-[#7f90a4]" />
                        <span className="truncate">{company.website ? cleanAdminText(company.website) : 'لا يوجد موقع رسمي'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <NotebookPen size={14} className="text-[#7f90a4]" />
                        <span className="truncate">{countActiveSocialLinks(company.socialLinks)} روابط اجتماعية</span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-[1rem] bg-[#f6f8fc] px-3 py-2 text-center">
                        <div className="text-xs font-bold text-[#6c7f95]">الوظائف</div>
                        <div className="mt-1 text-lg font-black text-[#10213c]">{formatNumber(jobsCount)}</div>
                      </div>
                      <div className="rounded-[1rem] bg-[#f6f8fc] px-3 py-2 text-center">
                        <div className="text-xs font-bold text-[#6c7f95]">الطلبات</div>
                        <div className="mt-1 text-lg font-black text-[#10213c]">{formatNumber(applicationsCount)}</div>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-7 text-[#667a92]">
                      {cleanAdminText(company.summary || 'لا توجد نبذة مضافة حتى الآن.')}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminButton variant="ghost" onClick={() => openDrawer(company)}>
                        <Eye size={15} />
                        عرض
                      </AdminButton>
                      <AdminButton
                        variant="soft"
                        onClick={() => {
                          setEditingCompany(company);
                          setFormState(getFormState(company));
                          setFormOpen(true);
                        }}
                      >
                        <PencilLine size={15} />
                        تعديل
                      </AdminButton>
                      <AdminButton
                        variant={company.deletedAt ? 'secondary' : 'danger'}
                        onClick={() => {
                          if (company.deletedAt) {
                            restoreCompany(company.id);
                            setFeedback({ tone: 'success', text: 'تمت استعادة الشركة.' });
                            return;
                          }
                          softDeleteCompany(company.id);
                          setFeedback({ tone: 'success', text: 'تم حذف الشركة وإخفاء وظائفها.' });
                        }}
                      >
                        {company.deletedAt ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                        {company.deletedAt ? 'استعادة' : 'حذف'}
                      </AdminButton>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState title="لا توجد شركات مطابقة" description="جرّب تعديل كلمات البحث أو الفلاتر، أو أضف شركة جديدة من الزر العلوي." />
          )}
        </AdminDataShell>
      </div>
      
      <AdminDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingCompany(null);
        }}
        title={editingCompany ? 'تعديل ملف الشركة' : 'إضافة شركة جديدة'}
        description="بيانات الشركة هنا مرتبطة بملفها العام، ووضع الظهور، وملاحظات صاحب الشركة."
        size="lg"
        footer={
          <>
            <AdminButton
              variant="ghost"
              onClick={() => {
                setFormOpen(false);
                setEditingCompany(null);
              }}
            >
              إلغاء
            </AdminButton>
            <AdminButton onClick={submitForm}>حفظ</AdminButton>
          </>
        }
      >
        <AdminFormSection title="البيانات الأساسية" description="الاسم والبريد وأرقام التواصل والموقع." defaultOpen>
          <div className="grid gap-3 md:grid-cols-2">
            <AdminField label="اسم الشركة" required>
              <AdminInput value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
            </AdminField>
            <AdminField label="البريد الإلكتروني" required>
              <AdminInput type="email" value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} />
            </AdminField>
            <AdminField label="رقم الموبايل" required>
              <AdminInput value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} />
            </AdminField>
            <AdminField label="الرقم الأرضي">
              <AdminInput value={formState.landline} onChange={(event) => setFormState((current) => ({ ...current, landline: event.target.value }))} />
            </AdminField>
            <AdminField label="القطاع" required>
              <AdminInput value={formState.sector} onChange={(event) => setFormState((current) => ({ ...current, sector: event.target.value }))} />
            </AdminField>
            <AdminField label="المدينة / الموقع" required>
              <AdminInput value={formState.location} onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))} />
            </AdminField>
            <AdminField label="العنوان" className="md:col-span-2">
              <AdminInput value={formState.address} onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))} />
            </AdminField>
          </div>
        </AdminFormSection>

        <AdminFormSection title="الحضور الرقمي" description="الموقع وروابط التواصل الاجتماعي." defaultOpen>
          <div className="grid gap-3 md:grid-cols-2">
            <AdminField label="الموقع الرسمي">
              <AdminInput value={formState.website} onChange={(event) => setFormState((current) => ({ ...current, website: event.target.value }))} placeholder="https://company.com" />
            </AdminField>
            <AdminField label="فيسبوك">
              <AdminInput value={formState.socialLinks.facebook} onChange={(event) => setFormState((current) => ({ ...current, socialLinks: { ...current.socialLinks, facebook: event.target.value } }))} />
            </AdminField>
            <AdminField label="إنستجرام">
              <AdminInput value={formState.socialLinks.instagram} onChange={(event) => setFormState((current) => ({ ...current, socialLinks: { ...current.socialLinks, instagram: event.target.value } }))} />
            </AdminField>
            <AdminField label="لينكدإن">
              <AdminInput value={formState.socialLinks.linkedin} onChange={(event) => setFormState((current) => ({ ...current, socialLinks: { ...current.socialLinks, linkedin: event.target.value } }))} />
            </AdminField>
            <AdminField label="X / تويتر">
              <AdminInput value={formState.socialLinks.x} onChange={(event) => setFormState((current) => ({ ...current, socialLinks: { ...current.socialLinks, x: event.target.value } }))} />
            </AdminField>
          </div>
        </AdminFormSection>

        <AdminFormSection title="الظهور والتحكم" description="حالة الشركة ووضع الموقع وملاحظات صاحب الشركة." defaultOpen>
          <div className="grid gap-3 md:grid-cols-2">
            <AdminField label="حالة الشركة">
              <AdminSelect value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as CompanyRecord['status'] }))}>
                <option value="approved">نشطة</option>
                <option value="pending">قيد المراجعة</option>
                <option value="restricted">موقوفة</option>
                <option value="archived">مؤرشفة</option>
              </AdminSelect>
            </AdminField>
            <AdminField label="وضع الموقع">
              <AdminSelect value={formState.siteMode} onChange={(event) => setFormState((current) => ({ ...current, siteMode: event.target.value as CompanyRecord['siteMode'] }))}>
                <option value="full">موقع كامل</option>
                <option value="landing">واجهة تعريفية فقط</option>
              </AdminSelect>
            </AdminField>
            <label className="md:col-span-2 flex items-center gap-3 rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] px-4 py-3 text-sm font-bold text-[#17355b]">
              <input type="checkbox" checked={formState.verified} onChange={(event) => setFormState((current) => ({ ...current, verified: event.target.checked }))} className="h-4 w-4" />
              الشركة موثقة
            </label>
            {formState.siteMode === 'landing' || formState.status === 'restricted' ? (
              <>
                <AdminField label={formState.status === 'restricted' ? 'سبب الإيقاف وتعليمات صاحب الشركة' : 'ملاحظات صاحب الشركة'} className="md:col-span-2">
                  <AdminTextarea value={formState.restrictionMessage} onChange={(event) => setFormState((current) => ({ ...current, restrictionMessage: event.target.value }))} />
                </AdminField>
                <AdminField label={formState.status === 'restricted' ? 'ملف مرفق لصاحب الشركة' : 'مرفق توضيحي'} className="md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input ref={attachmentInputRef} type="file" className="hidden" onChange={(event) => void handleAttachmentUpload(event)} />
                    <AdminButton type="button" variant="ghost" onClick={() => attachmentInputRef.current?.click()} disabled={uploadingAttachment}>
                      <Upload size={15} />
                      {uploadingAttachment ? 'جارٍ الرفع...' : 'رفع ملف'}
                    </AdminButton>
                    <AdminInput value={formState.restrictionAttachmentUrl || ''} onChange={(event) => setFormState((current) => ({ ...current, restrictionAttachmentUrl: event.target.value.trim() || null }))} placeholder="أو ضع رابط الملف مباشرة" />
                  </div>
                </AdminField>
              </>
            ) : null}
          </div>
        </AdminFormSection>

        <AdminFormSection title="الشعار والنبذة" description="رابط الشعار أو رفعه مباشرة مع نبذة مختصرة." defaultOpen>
          <div className="grid gap-3">
            <AdminField label="نبذة الشركة">
              <AdminTextarea value={formState.summary} onChange={(event) => setFormState((current) => ({ ...current, summary: event.target.value }))} />
            </AdminField>
            <AdminField label="رابط الشعار">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={(event) => void handleLogoUpload(event)} />
                <AdminButton type="button" variant="ghost" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                  <Upload size={15} />
                  {uploadingLogo ? 'جارٍ رفع الشعار...' : 'رفع شعار'}
                </AdminButton>
                <AdminInput value={formState.imageUrl} onChange={(event) => setFormState((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="أو ضع رابط الصورة مباشرة" />
              </div>
            </AdminField>
          </div>
        </AdminFormSection>
      </AdminDialog>

      <AdminDrawer
        open={Boolean(selectedCompany)}
        onClose={closeDrawer}
        title={cleanAdminText(selectedCompany?.name || 'ملف الشركة')}
        description={selectedCompany ? `${cleanAdminText(selectedCompany.sector || 'بدون قطاع')} - ${cleanAdminText(selectedCompany.location || 'بدون موقع')}` : undefined}
        footer={
          selectedCompany ? (
            <>
              <AdminButton
                variant="soft"
                onClick={() => {
                  setEditingCompany(selectedCompany);
                  setFormState(getFormState(selectedCompany));
                  setFormOpen(true);
                }}
              >
                <PencilLine size={15} />
                تعديل
              </AdminButton>
              <AdminButton
                variant={selectedCompany.siteMode === 'landing' ? 'secondary' : 'ghost'}
                onClick={() => {
                  persistCompanyPatch(selectedCompany, {
                    siteMode: selectedCompany.siteMode === 'landing' ? 'full' : 'landing',
                  });
                  setFeedback({
                    tone: 'success',
                    text: selectedCompany.siteMode === 'landing' ? 'تم تحويل الشركة إلى موقع كامل.' : 'تم تحويل الشركة إلى واجهة تعريفية فقط.',
                  });
                }}
              >
                <Globe size={15} />
                {selectedCompany.siteMode === 'landing' ? 'تحويل لموقع كامل' : 'تحويل لواجهة فقط'}
              </AdminButton>
            </>
          ) : null
        }
      >
        {selectedCompany ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] p-3 text-sm leading-7 text-[#5e7087]">
                <div className="mb-2 font-black text-[#17355b]">التواصل</div>
                <div>{cleanAdminText(selectedCompany.email || 'بدون بريد')}</div>
                <div>{cleanAdminText(selectedCompany.phone || 'بدون موبايل')}</div>
                <div>{cleanAdminText(selectedCompany.landline || 'لا يوجد رقم أرضي')}</div>
                <div>{cleanAdminText(selectedCompany.address || 'لا يوجد عنوان')}</div>
              </div>
            <div className="rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] p-3 text-sm leading-7 text-[#5e7087]">
              <div className="mb-2 font-black text-[#17355b]">الظهور</div>
              <div>الحالة: {selectedCompany.deletedAt ? 'محذوفة' : getCompanyStatusLabel(selectedCompany.status)}</div>
              <div>الوضع: {selectedCompany.siteMode === 'landing' ? 'واجهة تعريفية فقط' : 'موقع كامل'}</div>
              <div>التوثيق: {selectedCompany.verified ? 'موثقة' : 'غير موثقة'}</div>
              <div>الموقع: {selectedCompany.website ? cleanAdminText(selectedCompany.website) : 'غير مضاف'}</div>
            </div>
            </div>

            <div className="rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] p-3 text-sm leading-7 text-[#5e7087]">
              <div className="mb-2 font-black text-[#17355b]">صلاحيات الأدمن الجديدة</div>
              <ul className="space-y-1.5">
                <li>تعديل حالة الشركة بين نشطة أو قيد المراجعة، مع حذف واضح ونهائي من لوحة الأدمن.</li>
                <li>تحويل الشركة إلى واجهة تعريفية فقط بدون وظائف عامة.</li>
                <li>إرسال رابط إعادة تعيين كلمة السر لبريد الشركة من داخل لوحة الأدمن.</li>
                <li>استعادة الوظائف التي حذفتها الشركة إذا قرر الأدمن إرجاعها.</li>
              </ul>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <AdminButton
                variant="secondary"
                onClick={() => {
                  toggleCompanyVerified(selectedCompany.id);
                  setFeedback({ tone: 'success', text: selectedCompany.verified ? 'تم إلغاء التوثيق.' : 'تم توثيق الشركة.' });
                }}
              >
                <ShieldCheck size={15} />
                {selectedCompany.verified ? 'إلغاء التوثيق' : 'توثيق'}
              </AdminButton>
              <AdminButton
                variant="ghost"
                onClick={() => {
                  updateCompanyStatus(selectedCompany.id, selectedCompany.status === 'approved' ? 'pending' : 'approved');
                  setFeedback({ tone: 'success', text: selectedCompany.status === 'approved' ? 'تم تحويل الشركة إلى قيد المراجعة.' : 'تم اعتماد الشركة.' });
                }}
              >
                <RefreshCcw size={15} />
                {selectedCompany.status === 'approved' ? 'إرجاع للمراجعة' : 'اعتماد الشركة'}
              </AdminButton>
              <AdminButton
                variant={selectedCompany.status === 'restricted' ? 'secondary' : 'danger'}
                onClick={() => {
                  if (selectedCompany.status !== 'restricted' && !selectedCompany.restrictionMessage.trim()) {
                    setEditingCompany(selectedCompany);
                    setFormState(getFormState(selectedCompany));
                    setFormOpen(true);
                    setFeedback({ tone: 'danger', text: 'أضف سبب الإيقاف وتعليمات صاحب الموقع أولًا ثم احفظ الملف.' });
                    return;
                  }
                  updateCompanyStatus(selectedCompany.id, selectedCompany.status === 'restricted' ? 'approved' : 'restricted');
                  setFeedback({
                    tone: 'success',
                    text: selectedCompany.status === 'restricted' ? 'تمت إعادة تفعيل الشركة.' : 'تم إيقاف الشركة وإخفاؤها من الواجهة العامة.',
                  });
                }}
              >
                <ShieldCheck size={15} />
                {selectedCompany.status === 'restricted' ? 'إعادة تفعيل الشركة' : 'إيقاف الشركة'}
              </AdminButton>
              <AdminButton variant={selectedCompany.deletedAt ? 'secondary' : 'danger'} onClick={() => {
                if (selectedCompany.deletedAt) {
                  restoreCompany(selectedCompany.id);
                  setFeedback({ tone: 'success', text: 'تمت استعادة الشركة.' });
                } else {
                  softDeleteCompany(selectedCompany.id);
                  setFeedback({ tone: 'success', text: 'تم حذف الشركة وإخفاء وظائفها.' });
                }
              }}>
                {selectedCompany.deletedAt ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                {selectedCompany.deletedAt ? 'استعادة الشركة' : 'حذف الشركة'}
              </AdminButton>
              <AdminButton
                variant="soft"
                onClick={() => void sendCompanyPasswordReset(selectedCompany)}
                disabled={sendingResetForCompanyId === selectedCompany.id}
              >
                <RefreshCcw size={15} />
                {sendingResetForCompanyId === selectedCompany.id ? 'جارٍ الإرسال...' : 'إرسال رابط إعادة تعيين'}
              </AdminButton>
              <a href={`/company-details.html?id=${encodeURIComponent(selectedCompany.id)}`} target="_blank" rel="noreferrer" className="contents">
                <AdminButton variant="ghost">
                  <ExternalLink size={15} />
                  فتح الملف العام
                </AdminButton>
              </a>
              {selectedCompany.siteMode === 'landing' ? (
                <div className="flex min-h-[46px] items-center justify-center gap-2 rounded-[1rem] border border-dashed border-[rgba(19,53,91,0.16)] bg-[#f7f9fc] px-3 text-sm font-bold text-[#6b7d92]">
                  <BriefcaseBusiness size={15} />
                  الوظائف العامة غير متاحة
                </div>
              ) : (
                <a href={`/jobs.html?keyword=${encodeURIComponent(selectedCompany.name)}`} target="_blank" rel="noreferrer" className="contents">
                  <AdminButton variant="ghost">
                    <BriefcaseBusiness size={15} />
                    فتح الوظائف العامة
                  </AdminButton>
                </a>
              )}
            </div>

            {selectedCompany.restrictionMessage ? (
              <div className="rounded-[1rem] border border-[#f0d9b3] bg-[#fff8ed] p-3 text-sm leading-7 text-[#73572a]">
                <div className="font-black text-[#8b6420]">ملاحظات لصاحب الشركة</div>
                <p className="mt-2">{cleanAdminText(selectedCompany.restrictionMessage)}</p>
                {selectedCompany.restrictionAttachmentUrl ? (
                  <a href={selectedCompany.restrictionAttachmentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 font-bold text-[#8b6420]">
                    <ExternalLink size={15} />
                    {cleanAdminText(selectedCompany.restrictionAttachmentName || 'فتح المرفق')}
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] p-3">
              <div className="mb-3 font-black text-[#17355b]">الوظائف المرتبطة ({formatNumber(selectedJobs.length)})</div>
              {selectedJobs.length ? (
                <div className="space-y-2">
                  {selectedJobs.slice(0, 5).map((job) => (
                    <button key={job.id} type="button" onClick={() => navigate({ pathname: '/jobs', search: `?jobId=${encodeURIComponent(job.id)}` })} className="flex w-full items-center justify-between gap-3 rounded-[0.95rem] border border-[rgba(19,53,91,0.08)] bg-white px-3 py-2.5 text-right transition hover:border-[rgba(19,53,91,0.18)]">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#10213c]">{cleanAdminText(job.title)}</div>
                        <div className="mt-1 text-[11px] text-[#74869a]">{cleanAdminText(job.location)} - {cleanAdminText(job.type)}</div>
                      </div>
                      <AdminStatusBadge
                        status={job.deletedAt ? (job.deletedBy === 'company' ? 'rejected' : 'hidden') : job.status}
                        label={
                          job.deletedAt
                            ? job.deletedBy === 'company'
                              ? 'محذوفة من الشركة'
                              : 'محذوفة'
                            : getJobStatusLabel(job.status)
                        }
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#74869a]">لا توجد وظائف مرتبطة بهذه الشركة.</div>
              )}
            </div>

            <div className="rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] p-3">
              <div className="mb-3 font-black text-[#17355b]">الطلبات المرتبطة ({formatNumber(selectedApplications.length)})</div>
              {selectedApplications.length ? (
                <div className="space-y-2">
                  {selectedApplications.slice(0, 5).map((application) => (
                    <button key={application.id} type="button" onClick={() => navigate({ pathname: '/applications', search: `?applicationId=${encodeURIComponent(application.id)}` })} className="flex w-full items-center justify-between gap-3 rounded-[0.95rem] border border-[rgba(19,53,91,0.08)] bg-white px-3 py-2.5 text-right transition hover:border-[rgba(19,53,91,0.18)]">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#10213c]">{cleanAdminText(application.applicantName)} - {cleanAdminText(application.requestId)}</div>
                        <div className="mt-1 text-[11px] text-[#74869a]">{cleanAdminText(application.jobTitle)} - {formatDateTime(application.submittedAt)}</div>
                      </div>
                      <AdminStatusBadge status={application.status} label={getApplicationStatusLabel(application.status)} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#74869a]">لا توجد طلبات مرتبطة بهذه الشركة.</div>
              )}
            </div>

            <div className="rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] p-3">
              <div className="mb-3 font-black text-[#17355b]">ملاحظات داخلية</div>
              <div className="space-y-3">
                <AdminTextarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="اكتب ملاحظة داخلية تخص الشركة." />
                <AdminButton variant="secondary" onClick={submitNote}>
                  حفظ الملاحظة
                </AdminButton>
              </div>
              <div className="mt-4 space-y-2">
                {selectedCompany.notes.length ? (
                  selectedCompany.notes.slice(0, 6).map((note) => (
                    <div key={note.id} className="rounded-[0.95rem] border border-[rgba(19,53,91,0.08)] bg-white px-3 py-2.5">
                      <div className="text-sm leading-7 text-[#10213c]">{cleanAdminText(note.body)}</div>
                      <div className="mt-1 text-[11px] text-[#74869a]">{cleanAdminText(note.authorName)} - {formatDateTime(note.createdAt)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-[#74869a]">لا توجد ملاحظات مضافة بعد.</div>
                )}
              </div>
            </div>

            <div className="rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] p-3">
              <div className="mb-3 font-black text-[#17355b]">آخر النشاط</div>
              {selectedAuditLogs.length ? (
                <div className="space-y-2">
                  {selectedAuditLogs.map((log) => (
                    <div key={log.id} className="rounded-[0.95rem] border border-[rgba(19,53,91,0.08)] bg-white px-3 py-2.5">
                      <div className="text-sm font-bold text-[#10213c]">{cleanAdminText(log.action)}</div>
                      <div className="mt-1 text-[11px] leading-6 text-[#74869a]">{cleanAdminText(log.details)}</div>
                      <div className="mt-1 text-[11px] text-[#74869a]">{cleanAdminText(log.actorName)} - {formatDateTime(log.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#74869a]">لا توجد أنشطة مسجلة على هذا الملف حتى الآن.</div>
              )}
            </div>
          </>
        ) : null}
      </AdminDrawer>
    </>
  );
}

