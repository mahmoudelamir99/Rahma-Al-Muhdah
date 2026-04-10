import { AnimatePresence, motion } from 'framer-motion';
import {
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Mail,
  NotebookPen,
  PencilLine,
  Phone,
  Plus,
  RefreshCcw,
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
import { deleteApp, initializeApp } from 'firebase/app';
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  setPersistence,
  signOut as signOutSecondaryAuth,
  updateProfile,
} from 'firebase/auth';
import { getFirebaseRuntimeConfig, getFirebaseServices, hasFirebaseConfig } from '../lib/firebase';
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
  loginPassword: string;
  confirmLoginPassword: string;
};

type FeedbackState = { tone: 'success' | 'danger'; text: string } | null;
type CompanyPasswordFormState = {
  password: string;
  confirmPassword: string;
};

const EMPTY_SOCIAL_LINKS: CompanySocialLinks = { facebook: '', instagram: '', linkedin: '', x: '' };
const COMPANY_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const EMPTY_PASSWORD_FORM: CompanyPasswordFormState = {
  password: '',
  confirmPassword: '',
};
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
  loginPassword: '',
  confirmLoginPassword: '',
};

function PasswordInputControl({
  value,
  onChange,
  showPassword,
  onTogglePassword,
  placeholder = '••••••••',
  autoComplete = 'new-password',
}: {
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <AdminInput
        type={showPassword ? 'text' : 'password'}
        dir="ltr"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-[3.4rem]"
        placeholder={placeholder}
      />
      <span className="pointer-events-none absolute bottom-2 left-[2.8rem] top-2 w-px bg-[rgba(131,147,166,0.18)]" />
      <button
        type="button"
        onClick={onTogglePassword}
        className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-[rgba(24,37,63,0.08)] bg-[#f8fafc] text-[#687b91] transition hover:border-[rgba(24,37,63,0.14)] hover:bg-white hover:text-[#10213d]"
        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
      >
        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة المحددة.'));
    reader.readAsDataURL(file);
  });
}

function optimizeImageDataUrl(
  dataUrl: string,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; mimeType?: string } = {},
) {
  const rawDataUrl = String(dataUrl || '').trim();
  if (!/^data:image\//i.test(rawDataUrl)) {
    return Promise.resolve(rawDataUrl);
  }

  const {
    maxWidth = 720,
    maxHeight = 720,
    quality = 0.9,
    mimeType = 'image/png',
  } = options;

  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const originalWidth = Number(image.naturalWidth || image.width || 0);
      const originalHeight = Number(image.naturalHeight || image.height || 0);
      if (!originalWidth || !originalHeight) {
        resolve(rawDataUrl);
        return;
      }

      const scale = Math.min(1, maxWidth / originalWidth, maxHeight / originalHeight);
      const targetWidth = Math.max(1, Math.round(originalWidth * scale));
      const targetHeight = Math.max(1, Math.round(originalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(rawDataUrl);
        return;
      }

      if (mimeType === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, targetWidth, targetHeight);
      }

      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      const optimized = canvas.toDataURL(mimeType, quality);
      resolve(optimized.length < rawDataUrl.length ? optimized : rawDataUrl);
    };
    image.onerror = () => resolve(rawDataUrl);
    image.src = rawDataUrl;
  });
}

async function buildInlineCompanyImage(file: File) {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (String(file.type || '').trim().toLowerCase() === 'image/svg+xml') {
    return rawDataUrl;
  }

  return optimizeImageDataUrl(rawDataUrl, {
    maxWidth: 720,
    maxHeight: 720,
    quality: 0.9,
    mimeType: 'image/png',
  });
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
    siteMode: 'full',
    restrictionMessage: cleanAdminText(company.restrictionMessage),
    restrictionAttachmentUrl: company.restrictionAttachmentUrl || null,
    restrictionAttachmentName: cleanAdminText(company.restrictionAttachmentName),
    imageUrl: cleanAdminText(company.imageUrl || ''),
    loginPassword: '',
    confirmLoginPassword: '',
  };
}

function isCompanyDeletionRequest(company: CompanyRecord | null | undefined) {
  return Boolean(company?.deletedAt && company?.deletedBy === 'company');
}

function getCompanyDisplayStatusLabel(company: CompanyRecord) {
  if (isCompanyDeletionRequest(company)) return 'طلب حذف قيد المراجعة';
  if (company.deletedAt) return 'محذوفة';
  return getCompanyStatusLabel(company.status);
}

export default function Companies() {
  const navigate = useNavigate();
  const {
    state,
    hasPermission,
    saveCompany,
    updateCompanyStatus,
    toggleCompanyVerified,
    softDeleteCompany,
    restoreCompany,
    addNote,
    refreshFromSite,
  } =
    useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(null);
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<CompanyFormState>(EMPTY_FORM);
  const [noteDraft, setNoteDraft] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [passwordDialogCompany, setPasswordDialogCompany] = useState<CompanyRecord | null>(null);
  const [passwordForm, setPasswordForm] = useState<CompanyPasswordFormState>(EMPTY_PASSWORD_FORM);
  const [sendingResetForCompanyId, setSendingResetForCompanyId] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingCompanyPassword, setSavingCompanyPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreatePasswordConfirm, setShowCreatePasswordConfirm] = useState(false);
  const [showPasswordDialogValue, setShowPasswordDialogValue] = useState(false);
  const [showPasswordDialogConfirm, setShowPasswordDialogConfirm] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const canResetCompanyPassword = hasPermission('companies:password_reset') || hasPermission('companies:approve');

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
      return matchesQuery && matchesStatus;
    });
  }, [query, state.companies, statusFilter]);

  const companyDeletionRequests = useMemo(
    () => state.companies.filter((company) => isCompanyDeletionRequest(company)),
    [state.companies],
  );

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

  const resetCompanyPasswordDialog = () => {
    setPasswordDialogCompany(null);
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setShowPasswordDialogValue(false);
    setShowPasswordDialogConfirm(false);
    setSavingCompanyPassword(false);
  };

  const openCompanyPasswordDialog = (company: CompanyRecord) => {
    setPasswordDialogCompany(company);
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setShowPasswordDialogValue(false);
    setShowPasswordDialogConfirm(false);
  };

  const uploadAsset = async (file: File, folder: 'logo' | 'restriction', companyName: string) => {
    const canInlineLogo = folder === 'logo' && String(file.type || '').startsWith('image/');
    const buildInlineLogoResult = async () => ({
      ok: true as const,
      url: await buildInlineCompanyImage(file),
      name: file.name,
      source: 'inline' as const,
    });

    if (canInlineLogo) {
      return buildInlineLogoResult();
    }

    if (!hasFirebaseConfig()) {
      return { ok: false as const, message: 'رفع الملفات يحتاج Firebase.' };
    }

    try {
      const services = await getFirebaseServices();
      if (!services) {
        return { ok: false as const, message: 'تعذر تهيئة خدمة الرفع.' };
      }
      const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `admin/company-assets/${folder}/${buildUploadSlug(companyName)}-${Date.now()}.${extension}`;
      const storageRef = services.storageModule.ref(services.storage, path);
      const uploaded = await services.storageModule.uploadBytes(storageRef, file, { contentType: file.type || undefined });
      const url = await services.storageModule.getDownloadURL(uploaded.ref);
      return { ok: true as const, url, name: file.name, source: 'storage' as const };
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
    if (result.ok === false) {
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
    if (!String(file.type || '').startsWith('image/')) {
      event.target.value = '';
      setFeedback({ tone: 'danger', text: 'اختر ملف صورة صالحًا للشعار.' });
      return;
    }
    if (file.size > COMPANY_IMAGE_MAX_BYTES) {
      event.target.value = '';
      setFeedback({ tone: 'danger', text: 'حجم الشعار أكبر من 2MB. اختر صورة أصغر.' });
      return;
    }
    setUploadingLogo(true);
    const result = await uploadAsset(file, 'logo', formState.name || editingCompany?.name || 'company');
    setUploadingLogo(false);
    event.target.value = '';
    if (result.ok === false) {
      setFeedback({ tone: 'danger', text: result.message });
      return;
    }
    setFormState((current) => ({ ...current, imageUrl: result.url }));
    setFeedback({
      tone: 'success',
      text:
        result.source === 'inline'
          ? 'تم تجهيز شعار الشركة وحفظه داخل الملف مباشرة.'
          : 'تم رفع شعار الشركة.',
    });
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

  const getAuthenticatedAdminToken = async () => {
    if (!hasFirebaseConfig()) {
      throw new Error('تغيير كلمة المرور المباشر يحتاج تفعيل Firebase للأدمن.');
    }

    const services = await getFirebaseServices();
    const currentUser = services?.auth.currentUser;
    if (!services || !currentUser) {
      throw new Error('سجّل دخول الأدمن من جديد ثم أعد المحاولة.');
    }

    return currentUser.getIdToken();
  };

  const updateCompanyLoginPassword = async () => {
    const company = passwordDialogCompany;
    if (!company) return;

    const nextPassword = passwordForm.password.trim();
    const nextConfirmPassword = passwordForm.confirmPassword.trim();
    if (!nextPassword) {
      setFeedback({ tone: 'danger', text: 'اكتب كلمة المرور الجديدة أولًا.' });
      return;
    }

    if (nextPassword.length < 8) {
      setFeedback({ tone: 'danger', text: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' });
      return;
    }

    if (nextPassword !== nextConfirmPassword) {
      setFeedback({ tone: 'danger', text: 'تأكيد كلمة المرور غير مطابق.' });
      return;
    }

    setSavingCompanyPassword(true);

    try {
      const adminToken = await getAuthenticatedAdminToken();
      const response = await fetch(new URL('/api/admin/set-company-password', window.location.origin).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          companyId: company.id,
          companyName: company.name,
          email: company.email,
          password: nextPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(cleanAdminText(payload?.message || 'تعذر تحديث كلمة مرور الشركة الآن.'));
      }

      addNote('companies', company.id, `تم تعيين / تحديث كلمة مرور دخول الشركة بواسطة الأدمن للبريد ${company.email}.`);
      setFeedback({
        tone: 'success',
        text: cleanAdminText(payload.message || 'تم تحديث كلمة مرور الشركة بنجاح.'),
      });
      resetCompanyPasswordDialog();
    } catch (error) {
      setFeedback({
        tone: 'danger',
        text: getActionErrorText(error, 'تعذر تحديث كلمة مرور الشركة الآن.'),
      });
    } finally {
      setSavingCompanyPassword(false);
    }
  };

  const provisionCompanyLoginAccount = async (payload: {
    companyName: string;
    email: string;
    password: string;
  }) => {
    if (!hasFirebaseConfig()) {
      return {
        ok: false as const,
        message: 'إنشاء دخول الشركة يحتاج إعداد Firebase صحيح أولًا.',
      };
    }
    const firebaseConfig = getFirebaseRuntimeConfig();
    const secondaryApp = initializeApp(firebaseConfig, `rahma-company-provision-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      await setPersistence(secondaryAuth, browserSessionPersistence);
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        payload.email.trim().toLowerCase(),
        payload.password,
      );
      await updateProfile(credential.user, {
        displayName: payload.companyName.trim(),
      });

      return {
        ok: true as const,
        uid: credential.user.uid,
        message: 'تم تجهيز دخول الشركة بنجاح.',
      };
    } catch (error) {
      const code = cleanAdminText((error as { code?: string } | null)?.code || '').trim().toLowerCase();
      if (code === 'auth/email-already-in-use' || code.includes('email-already-in-use')) {
        return {
          ok: false as const,
          message: 'هذا البريد الإلكتروني مستخدم بالفعل في حساب شركة آخر.',
        };
      }

      if (code === 'auth/weak-password' || code.includes('weak-password')) {
        return {
          ok: false as const,
          message: 'كلمة المرور ضعيفة جدًا. استخدم 8 أحرف أو أكثر.',
        };
      }

      return {
        ok: false as const,
        message: getActionErrorText(error, 'تعذر إنشاء حساب دخول الشركة الآن.'),
      };
    } finally {
      try {
        await signOutSecondaryAuth(secondaryAuth);
      } catch {
        // Ignore secondary auth cleanup failures.
      }

      try {
        await deleteApp(secondaryApp);
      } catch {
        // Ignore secondary app cleanup failures.
      }
    }
  };

  const submitForm = async () => {
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
    const nextPassword = formState.loginPassword;
    const nextConfirmPassword = formState.confirmLoginPassword;
    const nextCompanyEmail = formState.email.trim().toLowerCase();
    const isCreatingCompany = !editingCompany;
    const shouldProvisionLogin = isCreatingCompany && Boolean(nextPassword.trim());

    if (isCreatingCompany && !nextPassword.trim()) {
      setFeedback({ tone: 'danger', text: 'أدخل كلمة مرور الشركة حتى يصبح تسجيل الدخول متاحًا لها.' });
      return;
    }

    if (shouldProvisionLogin && nextPassword.trim().length < 8) {
      setFeedback({ tone: 'danger', text: 'كلمة مرور الشركة لازم تكون 8 أحرف على الأقل.' });
      return;
    }

    if (shouldProvisionLogin && nextPassword !== nextConfirmPassword) {
      setFeedback({ tone: 'danger', text: 'تأكيد كلمة مرور الشركة غير مطابق.' });
      return;
    }

    setSavingCompany(true);

    let preferredCompanyId: string | null = editingCompany?.id || null;
    if (shouldProvisionLogin) {
      const loginProvisionResult = await provisionCompanyLoginAccount({
        companyName: formState.name.trim(),
        email: nextCompanyEmail,
        password: nextPassword,
      });

      if (!loginProvisionResult.ok) {
        setSavingCompany(false);
        setFeedback({
          tone: 'danger',
          text: `تعذر تجهيز دخول الشركة: ${loginProvisionResult.message}`,
        });
        return;
      }

      preferredCompanyId = loginProvisionResult.uid;
    }

    const companyId = saveCompany(
      {
        name: formState.name.trim(),
        email: nextCompanyEmail,
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
        siteMode: 'full',
        restrictionMessage: formState.restrictionMessage.trim(),
        restrictionAttachmentUrl: formState.restrictionAttachmentUrl || null,
        restrictionAttachmentName: formState.restrictionAttachmentName.trim(),
        imageUrl: formState.imageUrl.trim(),
      },
      preferredCompanyId,
    );

    if (!companyId) {
      setSavingCompany(false);
      setFeedback({ tone: 'danger', text: 'تعذر حفظ ملف الشركة الآن.' });
      return;
    }

    if (shouldProvisionLogin) {
      setFeedback({
        tone: 'success',
        text: 'تم إنشاء الشركة وتجهيز دخولها بنجاح.',
      });
    } else {
      setFeedback({ tone: 'success', text: editingCompany ? 'تم تحديث ملف الشركة.' : 'تم إنشاء ملف الشركة.' });
    }

    setSavingCompany(false);
    setFormOpen(false);
    setEditingCompany(null);
    setFormState(EMPTY_FORM);
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
          title="ملفات الشركات والتحكم فيها"
          description="بيانات الشركة، وسائل التواصل، وحالة الاعتماد كلها من شاشة واحدة مباشرة وواضحة."
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
                  setShowCreatePassword(false);
                  setShowCreatePasswordConfirm(false);
                  setFormOpen(true);
                }}
              >
                <Plus size={16} />
                إضافة شركة
              </AdminButton>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard label="نشطة" value={formatNumber(state.companies.filter((item) => !item.deletedAt && item.status === 'approved').length)} helper="ظاهرة على الموقع" icon={Building2} tone="primary" />
          <AdminStatCard label="مراجعة" value={formatNumber(state.companies.filter((item) => !item.deletedAt && item.status === 'pending').length)} helper="بانتظار الاعتماد" icon={ShieldCheck} tone="secondary" />
          <AdminStatCard label="موقوفة" value={formatNumber(state.companies.filter((item) => !item.deletedAt && item.status === 'restricted').length)} helper="تحتاج متابعة أو إعادة تفعيل" icon={ShieldCheck} tone="accent" />
          <AdminStatCard label="طلبات حذف" value={formatNumber(companyDeletionRequests.length)} helper="بانتظار قرار الأدمن" icon={Trash2} tone="accent" />
        </div>

        {companyDeletionRequests.length ? (
          <section className="rounded-[1.6rem] border border-[rgba(177,79,79,0.14)] bg-[linear-gradient(180deg,#fff9f8_0%,#fff3f1_100%)] p-5 shadow-[0_18px_36px_rgba(177,79,79,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black tracking-[0.18em] text-[#b14f4f]">صندوق طلبات حذف الشركات</div>
                <h2 className="mt-2 text-[1.1rem] font-black text-[#10213c]">شركات اختفت من الموقع وتنتظر قرار الأدمن</h2>
                <p className="mt-2 text-sm leading-7 text-[#6b7280]">
                  كل شركة هنا طلبت حذف حسابها من لوحتها. يمكنك استعادتها فورًا، أو حذفها نهائيًا بدون رجعة.
                </p>
              </div>
              <AdminStatusBadge status="rejected" label={`${formatNumber(companyDeletionRequests.length)} طلب مفتوح`} />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {companyDeletionRequests.map((company) => {
                const jobsCount = (companyJobsMap.get(company.id) || []).length;
                const applicationsCount = companyApplicationsMap.get(company.id)?.length || 0;

                return (
                  <article
                    key={`delete-request-${company.id}`}
                    className="rounded-[1.2rem] border border-[rgba(177,79,79,0.12)] bg-white/90 p-4 shadow-[0_14px_26px_rgba(177,79,79,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[1rem] font-black text-[#10213c]">{cleanAdminText(company.name)}</h3>
                        <p className="mt-1 text-xs leading-6 text-[#7a5d5d]">
                          {cleanAdminText(company.sector || 'بدون قطاع')} - {cleanAdminText(company.location || 'بدون موقع')}
                        </p>
                      </div>
                      <AdminStatusBadge status="rejected" label="بانتظار قرار الحذف" />
                    </div>

                    <div className="mt-3 rounded-[1rem] border border-[rgba(177,79,79,0.08)] bg-[#fff8f7] px-3 py-2 text-sm leading-7 text-[#7a5d5d]">
                      <div className="font-black text-[#9b4343]">سبب الطلب</div>
                      <p className="mt-1">{cleanAdminText(company.deletionReason || 'لم تضف الشركة سببًا واضحًا.')}</p>
                      <p className="mt-2 text-[12px] font-bold text-[#aa6a6a]">
                        وقت الإرسال: {formatDateTime(company.deletedAt) || 'غير محدد'}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-[1rem] bg-[#fdf1ee] px-3 py-2 text-center">
                        <div className="text-xs font-bold text-[#8d6767]">الوظائف المرتبطة</div>
                        <div className="mt-1 text-lg font-black text-[#10213c]">{formatNumber(jobsCount)}</div>
                      </div>
                      <div className="rounded-[1rem] bg-[#fdf1ee] px-3 py-2 text-center">
                        <div className="text-xs font-bold text-[#8d6767]">الطلبات المرتبطة</div>
                        <div className="mt-1 text-lg font-black text-[#10213c]">{formatNumber(applicationsCount)}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminButton
                        variant="secondary"
                        onClick={() => {
                          restoreCompany(company.id);
                          setFeedback({ tone: 'success', text: 'تمت استعادة الشركة وعودتها إلى الموقع.' });
                        }}
                      >
                        <RefreshCcw size={15} />
                        استعادة الشركة
                      </AdminButton>
                      <AdminButton
                        variant="danger"
                        onClick={() => {
                          softDeleteCompany(company.id);
                          setFeedback({ tone: 'success', text: 'تم حذف الشركة نهائيًا من النظام.' });
                        }}
                      >
                        <Trash2 size={15} />
                        حذف نهائي
                      </AdminButton>
                      <AdminButton variant="ghost" onClick={() => openDrawer(company)}>
                        <Eye size={15} />
                        عرض التفاصيل
                      </AdminButton>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <AdminDataShell
          toolbar={
            <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                <option value="deleted">طلبات حذف / محذوفة</option>
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
                            label={getCompanyDisplayStatusLabel(company)}
                          />
                          {company.verified ? <AdminStatusBadge status="approved" label="موثقة" /> : null}
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

                    {isCompanyDeletionRequest(company) ? (
                      <div className="mt-3 rounded-[1rem] border border-[rgba(177,79,79,0.12)] bg-[#fff6f4] px-3 py-2 text-sm leading-7 text-[#8f5555]">
                        <div className="font-black text-[#a63f3f]">طلب حذف من الشركة</div>
                        <p className="mt-1 line-clamp-2">{cleanAdminText(company.deletionReason || 'لا يوجد سبب مكتوب.')}</p>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminButton variant="ghost" onClick={() => openDrawer(company)}>
                        <Eye size={15} />
                        عرض
                      </AdminButton>
                      {isCompanyDeletionRequest(company) ? (
                        <AdminButton
                          variant="secondary"
                          onClick={() => {
                            restoreCompany(company.id);
                            setFeedback({ tone: 'success', text: 'تمت استعادة الشركة وعودتها إلى الموقع.' });
                          }}
                        >
                          <RefreshCcw size={15} />
                          استعادة
                        </AdminButton>
                      ) : (
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
                      )}
                      <AdminButton
                        variant="danger"
                        onClick={() => {
                          softDeleteCompany(company.id);
                          setFeedback({ tone: 'success', text: 'تم حذف الشركة نهائيًا من النظام.' });
                        }}
                      >
                        <Trash2 size={15} />
                        حذف نهائي
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
          setFormState(EMPTY_FORM);
          setShowCreatePassword(false);
          setShowCreatePasswordConfirm(false);
        }}
        title={editingCompany ? 'تعديل ملف الشركة' : 'إضافة شركة جديدة'}
        description="بيانات الشركة هنا تظهر مباشرة في صفحة الشركة العامة، مع ملاحظات صاحب الشركة وحالة الاعتماد."
        size="lg"
        footer={
          <>
            <AdminButton
              type="button"
              variant="ghost"
              onClick={() => {
                setFormOpen(false);
                setEditingCompany(null);
                setFormState(EMPTY_FORM);
              }}
            >
              إلغاء
            </AdminButton>
            <AdminButton type="button" onClick={() => void submitForm()} disabled={savingCompany}>
              {savingCompany ? 'جارٍ الحفظ...' : 'حفظ'}
            </AdminButton>
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
            {!editingCompany ? (
              <>
                <AdminField
                  label="كلمة مرور دخول الشركة"
                  required
                  hint="هذه هي الكلمة التي ستستخدمها الشركة عند تسجيل الدخول لأول مرة."
                >
                  <PasswordInputControl
                    value={formState.loginPassword}
                    onChange={(value) => setFormState((current) => ({ ...current, loginPassword: value }))}
                    showPassword={showCreatePassword}
                    onTogglePassword={() => setShowCreatePassword((current) => !current)}
                  />
                </AdminField>
                <AdminField label="تأكيد كلمة المرور" required>
                  <PasswordInputControl
                    value={formState.confirmLoginPassword}
                    onChange={(value) => setFormState((current) => ({ ...current, confirmLoginPassword: value }))}
                    showPassword={showCreatePasswordConfirm}
                    onTogglePassword={() => setShowCreatePasswordConfirm((current) => !current)}
                  />
                </AdminField>
              </>
            ) : null}
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

        <AdminFormSection title="الحالة والتحكم" description="حالة الشركة وملاحظات صاحب الشركة." defaultOpen>
          <div className="grid gap-3 md:grid-cols-2">
            <AdminField label="حالة الشركة">
              <AdminSelect value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as CompanyRecord['status'] }))}>
                <option value="approved">نشطة</option>
                <option value="pending">قيد المراجعة</option>
                <option value="restricted">موقوفة</option>
                <option value="archived">مؤرشفة</option>
              </AdminSelect>
            </AdminField>
            <label className="md:col-span-2 flex items-center gap-3 rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] px-4 py-3 text-sm font-bold text-[#17355b]">
              <input type="checkbox" checked={formState.verified} onChange={(event) => setFormState((current) => ({ ...current, verified: event.target.checked }))} className="h-4 w-4" />
              الشركة موثقة
            </label>
            {formState.status === 'restricted' ? (
              <>
                <AdminField label="سبب الإيقاف وتعليمات صاحب الشركة" className="md:col-span-2">
                  <AdminTextarea value={formState.restrictionMessage} onChange={(event) => setFormState((current) => ({ ...current, restrictionMessage: event.target.value }))} />
                </AdminField>
                <AdminField label="ملف مرفق لصاحب الشركة" className="md:col-span-2">
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

      <AdminDialog
        open={Boolean(passwordDialogCompany)}
        onClose={resetCompanyPasswordDialog}
        title={passwordDialogCompany ? `تغيير كلمة مرور ${cleanAdminText(passwordDialogCompany.name)}` : 'تغيير كلمة المرور'}
        description="يمكنك من هنا تعيين كلمة مرور جديدة لدخول الشركة. إذا لم يكن للشركة حساب دخول بعد فسيتم إنشاؤه بنفس البريد الحالي."
        footer={
          <>
            <AdminButton type="button" variant="ghost" onClick={resetCompanyPasswordDialog}>
              إلغاء
            </AdminButton>
            <AdminButton type="button" onClick={() => void updateCompanyLoginPassword()} disabled={savingCompanyPassword}>
              {savingCompanyPassword ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}
            </AdminButton>
          </>
        }
      >
        <div className="grid gap-4">
          <AdminField label="بريد الشركة الحالي">
            <AdminInput value={passwordDialogCompany?.email || ''} type="email" dir="ltr" readOnly />
          </AdminField>
          <AdminField label="كلمة المرور الجديدة" required>
            <PasswordInputControl
              value={passwordForm.password}
              onChange={(value) => setPasswordForm((current) => ({ ...current, password: value }))}
              showPassword={showPasswordDialogValue}
              onTogglePassword={() => setShowPasswordDialogValue((current) => !current)}
            />
          </AdminField>
          <AdminField label="تأكيد كلمة المرور" required>
            <PasswordInputControl
              value={passwordForm.confirmPassword}
              onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
              showPassword={showPasswordDialogConfirm}
              onTogglePassword={() => setShowPasswordDialogConfirm((current) => !current)}
            />
          </AdminField>
        </div>
      </AdminDialog>

      <AdminDrawer
        open={Boolean(selectedCompany)}
        onClose={closeDrawer}
        title={cleanAdminText(selectedCompany?.name || 'ملف الشركة')}
        description={selectedCompany ? `${cleanAdminText(selectedCompany.sector || 'بدون قطاع')} - ${cleanAdminText(selectedCompany.location || 'بدون موقع')}` : undefined}
        footer={
          selectedCompany ? (
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
              <div className="mb-2 font-black text-[#17355b]">الحالة</div>
              <div>الحالة: {getCompanyDisplayStatusLabel(selectedCompany)}</div>
              <div>التوثيق: {selectedCompany.verified ? 'موثقة' : 'غير موثقة'}</div>
              <div>الموقع: {selectedCompany.website ? cleanAdminText(selectedCompany.website) : 'غير مضاف'}</div>
            </div>
            </div>

            {isCompanyDeletionRequest(selectedCompany) ? (
              <div className="rounded-[1rem] border border-[#efc7c7] bg-[#fff7f6] p-3 text-sm leading-7 text-[#7a5252]">
                <div className="font-black text-[#a63f3f]">طلب حذف قيد المراجعة</div>
                <p className="mt-2">{cleanAdminText(selectedCompany.deletionReason || 'لم تضف الشركة سببًا مكتوبًا.')}</p>
                <p className="mt-2 text-[12px] font-bold text-[#a56b6b]">
                  أُرسل الطلب في: {formatDateTime(selectedCompany.deletedAt) || 'غير محدد'}
                </p>
              </div>
            ) : null}

            <div className="rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] p-3 text-sm leading-7 text-[#5e7087]">
              <div className="mb-2 font-black text-[#17355b]">صلاحيات الأدمن الجديدة</div>
              <ul className="space-y-1.5">
                <li>تعديل حالة الشركة بين نشطة أو قيد المراجعة، مع صندوق واضح لطلبات الحذف القادمة من الشركات.</li>
                <li>تعيين كلمة مرور دخول الشركة أثناء الإنشاء أو تغييرها لاحقًا مباشرة من لوحة الأدمن.</li>
                <li>استعادة الشركة ووظائفها إذا قرر الأدمن إرجاع الطلب بدل الحذف النهائي.</li>
              </ul>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {isCompanyDeletionRequest(selectedCompany) ? (
                <AdminButton
                  variant="secondary"
                  onClick={() => {
                    restoreCompany(selectedCompany.id);
                    setFeedback({ tone: 'success', text: 'تمت استعادة الشركة بنجاح.' });
                  }}
                >
                  <RefreshCcw size={15} />
                  استعادة الشركة
                </AdminButton>
              ) : null}
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
              <AdminButton variant="danger" onClick={() => {
                  softDeleteCompany(selectedCompany.id);
                  setFeedback({ tone: 'success', text: 'تم حذف الشركة نهائيًا من النظام.' });
              }}>
                <Trash2 size={15} />
                حذف الشركة نهائيًا
              </AdminButton>
              <AdminButton
                variant="soft"
                onClick={() => void sendCompanyPasswordReset(selectedCompany)}
                disabled={!canResetCompanyPassword || sendingResetForCompanyId === selectedCompany.id}
              >
                <RefreshCcw size={15} />
                {sendingResetForCompanyId === selectedCompany.id ? 'جارٍ الإرسال...' : 'إرسال رابط إعادة تعيين'}
              </AdminButton>
              <AdminButton
                variant="secondary"
                onClick={() => openCompanyPasswordDialog(selectedCompany)}
                disabled={!canResetCompanyPassword}
              >
                <PencilLine size={15} />
                تعيين / تغيير كلمة المرور
              </AdminButton>
              <a href={`/jobs.html?keyword=${encodeURIComponent(selectedCompany.name)}`} target="_blank" rel="noreferrer" className="contents">
                <AdminButton variant="ghost">
                  <BriefcaseBusiness size={15} />
                  فتح الوظائف العامة
                </AdminButton>
              </a>
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

