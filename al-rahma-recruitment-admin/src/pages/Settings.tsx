import { motion } from 'framer-motion';
import { BellRing, CheckCheck, Clock3, Film, Mail, Plus, Save, ShieldCheck, UserCog, Users2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminPanel,
  AdminSectionTabs,
  AdminSelect,
  AdminSwitch,
  AdminTextarea,
} from '../components/ui/admin-kit';
import { PERMISSION_CATALOG } from '../lib/admin-data';
import { buildRoleSummary, cleanAdminText, formatDateTime, formatNumber } from '../lib/admin-dashboard';
import { useAdmin } from '../lib/admin-store';
import { getFirebaseServices, hasFirebaseConfig } from '../lib/firebase';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function getDefaultDelegatedRoleId(roleIds: string[]) {
  return roleIds.find((roleId) => roleId !== 'super-admin') || 'platform-operator';
}

function parseMaintenanceUntil(value: string) {
  if (!value) return { date: '', hour: '12', minute: '00', period: 'PM' as const };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', hour: '12', minute: '00', period: 'PM' as const };
  const localHour = date.getHours();
  const period = localHour >= 12 ? 'PM' : 'AM';
  const hour12 = localHour % 12 || 12;
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    hour: pad2(hour12),
    minute: pad2(date.getMinutes()),
    period,
  };
}

function buildMaintenanceUntil(date: string, hour: string, minute: string, period: 'AM' | 'PM') {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return '';
  let hourValue = Number(hour) || 0;
  const minuteValue = Math.max(0, Math.min(59, Number(minute) || 0));
  if (period === 'PM' && hourValue < 12) hourValue += 12;
  if (period === 'AM' && hourValue === 12) hourValue = 0;
  const nextDate = new Date(year, month - 1, day, hourValue, minuteValue, 0, 0);
  return Number.isNaN(nextDate.getTime()) ? '' : nextDate.toISOString();
}

const SETTINGS_TABS = ['platform', 'content', 'access', 'profile'] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function resolveSettingsTab(search: string): SettingsTab {
  const query = new URLSearchParams(search || '');
  const tab = String(query.get('tab') || '').trim().toLowerCase();
  return SETTINGS_TABS.includes(tab as SettingsTab) ? (tab as SettingsTab) : 'platform';
}

export default function Settings() {
  const location = useLocation();
  const {
    state,
    session,
    currentAdmin,
    updateSettings,
    updateContent,
    createRole,
    toggleRolePermission,
    createAdminAccount,
    updateAdminStatus,
    updateAdminRole,
    updateCurrentAdminProfile,
    sendNotification,
  } = useAdmin();

  const delegatedRoleId = useMemo(() => getDefaultDelegatedRoleId(state.roles.map((role) => role.id)), [state.roles]);
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => resolveSettingsTab(location.search));
  const [settingsDraft, setSettingsDraft] = useState(state.settings);
  const [contentDraft, setContentDraft] = useState(state.content);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [adminForm, setAdminForm] = useState({ displayName: '', email: '', password: '', roleId: delegatedRoleId });
  const [profileForm, setProfileForm] = useState({
    displayName: currentAdmin?.displayName || '',
    email: session?.identifier || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [messageForm, setMessageForm] = useState({ audience: 'الجميع', subject: '', body: '' });
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);
  const maintenanceParts = useMemo(() => parseMaintenanceUntil(settingsDraft.maintenanceUntil), [settingsDraft.maintenanceUntil]);
  const [maintenanceDate, setMaintenanceDate] = useState(maintenanceParts.date);
  const [maintenanceHour, setMaintenanceHour] = useState(maintenanceParts.hour);
  const [maintenanceMinute, setMaintenanceMinute] = useState(maintenanceParts.minute);
  const [maintenancePeriod, setMaintenancePeriod] = useState<'AM' | 'PM'>(maintenanceParts.period);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);

  useEffect(() => setSettingsDraft(state.settings), [state.settings]);
  useEffect(() => setContentDraft(state.content), [state.content]);
  useEffect(() => {
    const nextTab = resolveSettingsTab(location.search);
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [location.search]);
  useEffect(() => {
    setProfileForm({
      displayName: currentAdmin?.displayName || '',
      email: session?.identifier || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  }, [currentAdmin?.displayName, session?.identifier]);
  useEffect(() => {
    const next = parseMaintenanceUntil(state.settings.maintenanceUntil);
    setMaintenanceDate(next.date);
    setMaintenanceHour(next.hour);
    setMaintenanceMinute(next.minute);
    setMaintenancePeriod(next.period);
  }, [state.settings.maintenanceUntil]);
  useEffect(() => {
    setAdminForm((current) =>
      current.roleId === 'super-admin' || !state.roles.some((role) => role.id === current.roleId)
        ? { ...current, roleId: delegatedRoleId }
        : current,
    );
  }, [delegatedRoleId, state.roles]);

  const tabs: { value: SettingsTab; label: string }[] = [
    { value: 'platform', label: 'المنصة' },
    { value: 'content', label: 'المحتوى' },
    { value: 'access', label: 'الصلاحيات' },
    { value: 'profile', label: 'الحساب' },
  ];
  const roleOptions = state.roles.filter((role) => role.id !== 'super-admin');
  const superAdmin = state.admins.find((admin) => admin.roleId === 'super-admin') || null;
  const activeAdmins = state.admins.filter((admin) => admin.status === 'active').length;
  const suspendedAdmins = state.admins.filter((admin) => admin.status === 'suspended').length;

  const contentSections = [
    { title: 'الصفحة الرئيسية', fields: [{ key: 'heroTitle', label: 'العنوان الرئيسي', type: 'textarea' }, { key: 'heroSubtitle', label: 'الوصف المختصر', type: 'textarea' }, { key: 'siteAnnouncement', label: 'رسالة التنبيه العامة', type: 'textarea' }] },
    { title: 'من نحن', fields: [{ key: 'aboutHeroTitle', label: 'عنوان الصفحة' }, { key: 'aboutHeroSubtitle', label: 'وصف الصفحة', type: 'textarea' }, { key: 'aboutOverviewTitle', label: 'عنوان النظرة العامة' }, { key: 'aboutOverviewText', label: 'نص النظرة العامة', type: 'textarea' }, { key: 'aboutProcessTitle', label: 'عنوان آلية العمل' }, { key: 'aboutProcessText', label: 'نص آلية العمل', type: 'textarea' }, { key: 'aboutCTAHeading', label: 'عنوان الدعوة للإجراء' }, { key: 'aboutCTAText', label: 'نص الدعوة للإجراء', type: 'textarea' }] },
    { title: 'تواصل معنا', fields: [{ key: 'contactHeroTitle', label: 'عنوان الصفحة' }, { key: 'contactHeroSubtitle', label: 'الوصف العلوي', type: 'textarea' }, { key: 'contactIntroText', label: 'النص التمهيدي', type: 'textarea' }, { key: 'contactPhone', label: 'رقم الهاتف' }, { key: 'contactEmail', label: 'البريد الإلكتروني' }, { key: 'contactLocation', label: 'العنوان' }, { key: 'contactHours', label: 'مواعيد العمل' }] },
    { title: 'السياسات', fields: [{ key: 'privacyHeroTitle', label: 'عنوان الخصوصية' }, { key: 'privacyHeroSubtitle', label: 'وصف الخصوصية', type: 'textarea' }, { key: 'privacyIntroText', label: 'نص الخصوصية', type: 'textarea' }, { key: 'termsHeroTitle', label: 'عنوان الشروط' }, { key: 'termsHeroSubtitle', label: 'وصف الشروط', type: 'textarea' }, { key: 'termsIntroText', label: 'نص الشروط', type: 'textarea' }] },
  ] as const;

  const savePlatformSettings = () => {
    updateSettings({ ...settingsDraft, maintenanceUntil: buildMaintenanceUntil(maintenanceDate, maintenanceHour, maintenanceMinute, maintenancePeriod) });
    setFeedback({ tone: 'success', text: 'تم حفظ إعدادات المنصة وربطها بالحالة الحالية للموقع.' });
  };
  const saveContentSettings = () => {
    updateContent(contentDraft);
    setFeedback({ tone: 'success', text: 'تم تحديث محتوى الموقع وربطه بالصفحات العامة.' });
  };
  const handleCreateRole = () => {
    if (!roleName.trim()) return setFeedback({ tone: 'danger', text: 'اكتب اسم الدور أولًا.' });
    createRole(roleName, roleDescription);
    setRoleName('');
    setRoleDescription('');
    setFeedback({ tone: 'success', text: 'تم إنشاء الدور الجديد ويمكنك الآن توزيع صلاحياته.' });
  };
  const handleCreateAdmin = async () => {
    const result = await createAdminAccount(adminForm.displayName, adminForm.email, adminForm.password, adminForm.roleId);
    if (!result.ok) return setFeedback({ tone: 'danger', text: cleanAdminText(result.message) });
    setAdminForm({ displayName: '', email: '', password: '', roleId: delegatedRoleId });
    setFeedback({ tone: 'success', text: 'تم إنشاء الحساب الإداري الجديد بنجاح.' });
  };
  const handleProfileSave = async () => {
    const result = await updateCurrentAdminProfile(profileForm);
    if (!result.ok) return setFeedback({ tone: 'danger', text: cleanAdminText(result.message) });
    setProfileForm((current) => ({ ...current, currentPassword: '', newPassword: '', confirmPassword: '' }));
    setFeedback({ tone: 'success', text: 'تم تحديث بيانات الحساب الحالي بنجاح.' });
  };
  const handleSendNotification = () => {
    if (!messageForm.subject.trim() || !messageForm.body.trim()) return setFeedback({ tone: 'danger', text: 'اكتب عنوان الرسالة ومحتواها قبل الإرسال.' });
    sendNotification(messageForm.audience, messageForm.subject.trim(), messageForm.body.trim());
    setMessageForm({ audience: 'الجميع', subject: '', body: '' });
    setFeedback({ tone: 'success', text: 'تم إرسال الرسالة وحفظها ضمن سجل الإشعارات.' });
  };

  const handleHeroVideoUpload = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const maxVideoBytes = 35 * 1024 * 1024;
    if (!String(file.type || '').startsWith('video/')) {
      setFeedback({ tone: 'danger', text: 'الملف المختار ليس فيديو صالحًا. استخدم MP4/WebM مضغوط.' });
      return;
    }
    if (file.size > maxVideoBytes) {
      setFeedback({
        tone: 'warning',
        text: 'حجم الفيديو كبير وقد يسبب بطء. اضغطه إلى أقل من 35MB (يفضل MP4 H.264 بدقة 720p) ثم أعد الرفع.',
      });
      return;
    }
    if (!hasFirebaseConfig()) {
      setFeedback({ tone: 'danger', text: 'فعّل إعدادات Firebase أو الصق رابط فيديو مباشر بدل الرفع.' });
      return;
    }
    setVideoBusy(true);
    setVideoUploadProgress(0);
    try {
      const services = await getFirebaseServices();
      if (!services) throw new Error('firebase');
      const safeName = file.name.replace(/[^\w.-]+/g, '-');
      const path = `site/home-hero/${Date.now()}-${safeName}`;
      const storageRef = services.storageModule.ref(services.storage, path);
      const metadata = {
        contentType: file.type || 'video/mp4',
        cacheControl: 'public,max-age=3600,s-maxage=3600',
      };
      const storageModule = services.storageModule as unknown as {
        uploadBytes: (ref: unknown, data: File, meta: Record<string, string>) => Promise<unknown>;
        uploadBytesResumable?: (
          ref: unknown,
          data: File,
          meta: Record<string, string>,
        ) => {
          on: (
            event: 'state_changed',
            next: (snapshot: { bytesTransferred: number; totalBytes: number }) => void,
            error: (error: unknown) => void,
            complete: () => void,
          ) => void;
        };
      };

      if (typeof storageModule.uploadBytesResumable === 'function') {
        await new Promise<void>((resolve, reject) => {
          const task = storageModule.uploadBytesResumable!(storageRef, file, metadata);
          task.on(
            'state_changed',
            (snapshot) => {
              const ratio = snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
              setVideoUploadProgress(Math.max(0, Math.min(100, Math.round(ratio * 100))));
            },
            reject,
            resolve,
          );
        });
      } else {
        await storageModule.uploadBytes(storageRef, file, metadata);
        setVideoUploadProgress(100);
      }
      const url = await services.storageModule.getDownloadURL(storageRef);
      setContentDraft((current) => ({ ...current, homeHeroVideoUrl: url }));
      setFeedback({ tone: 'success', text: 'تم رفع الفيديو. اضغط «حفظ المحتوى» لنشره على الموقع العام.' });
    } catch {
      setFeedback({ tone: 'danger', text: 'تعذر الرفع. راجع قواعد التخزين أو جرّب رابط URL عام.' });
    } finally {
      setVideoBusy(false);
      setVideoUploadProgress(0);
    }
  };

  const videoUploadLabel = videoBusy ? `جارٍ الرفع… ${videoUploadProgress}%` : 'رفع فيديو من الجهاز';

  return (
    <>
      <AdminPageHeader
        eyebrow="الإعدادات والتحكم"
        title="مركز الضبط والمحتوى والصلاحيات"
        description="من هنا نتحكم في تشغيل المنصة، النصوص العامة، الحسابات الإدارية، والأدوار الداخلية بدون أي طبقة وهمية أو إعدادات شكلية."
        actions={
          <>
            <AdminSectionTabs items={tabs} value={activeTab} onChange={(nextTab) => setActiveTab(resolveSettingsTab(`tab=${nextTab}`))} />
            <AdminButton type="button" variant="soft" onClick={() => setActiveTab('content')}>
              <Film size={16} />
              فيديو الواجهة الرئيسية
            </AdminButton>
            {activeTab === 'platform' ? (
              <AdminButton onClick={savePlatformSettings}>
                <Save size={16} />
                حفظ إعدادات المنصة
              </AdminButton>
            ) : null}
            {activeTab === 'content' ? (
              <AdminButton onClick={saveContentSettings}>
                <Save size={16} />
                حفظ المحتوى
              </AdminButton>
            ) : null}
          </>
        }
      />

      {feedback ? <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.5rem] border border-[rgba(24,37,63,0.08)] bg-white px-5 py-4 shadow-[0_18px_36px_rgba(18,30,54,0.06)]"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[#eef3ff] text-[#17325a]"><CheckCheck size={18} /></div><div><div className="text-sm font-black text-[#10213d]">آخر تحديث</div><div className="mt-1 text-sm text-[#65768a]">{feedback.text}</div></div></div><AdminBadge tone={feedback.tone === 'danger' ? 'danger' : feedback.tone === 'warning' ? 'warning' : 'success'}>{feedback.tone === 'danger' ? 'مشكلة' : feedback.tone === 'warning' ? 'تنبيه' : 'تم'}</AdminBadge></div></motion.div> : null}

      {activeTab === 'platform' ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6">
            <AdminPanel title="تشغيل المنصة" description="التحكم الفعلي في التسجيل والتقديم والرفع ورسائل النظام.">
              <div className="grid gap-3">
                <AdminSwitch checked={settingsDraft.userRegistration} onCheckedChange={(nextValue) => setSettingsDraft((current) => ({ ...current, userRegistration: nextValue }))} label="تفعيل تسجيل المستخدمين" description="يظهر ويعمل نموذج تسجيل الباحثين عن عمل على الموقع." />
                <AdminSwitch checked={settingsDraft.companyRegistration} onCheckedChange={(nextValue) => setSettingsDraft((current) => ({ ...current, companyRegistration: nextValue }))} label="تفعيل تسجيل الشركات" description="يحدد إذا كان إنشاء حسابات الشركات متاحًا حاليًا." />
                <AdminSwitch checked={settingsDraft.jobApplications} onCheckedChange={(nextValue) => setSettingsDraft((current) => ({ ...current, jobApplications: nextValue }))} label="تفعيل استقبال الطلبات" description="إيقافه يمنع التقديم على كل الوظائف من الموقع." />
                <AdminSwitch checked={settingsDraft.fileUploads} onCheckedChange={(nextValue) => setSettingsDraft((current) => ({ ...current, fileUploads: nextValue }))} label="تفعيل رفع الملفات" description="يعطل رفع السيرة الذاتية والملفات المرفقة عند الحاجة." />
                <AdminSwitch checked={settingsDraft.maintenanceMode} onCheckedChange={(nextValue) => setSettingsDraft((current) => ({ ...current, maintenanceMode: nextValue }))} label="وضع الصيانة" description="يوقف تشغيل المنصة مؤقتًا مع رسالة ووقت انتهاء واضحين." />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <AdminField label="حجم الملف الأقصى بالميجابايت">
                  <AdminInput type="number" min={1} max={25} value={settingsDraft.maxFileSizeMb} onChange={(event) => setSettingsDraft((current) => ({ ...current, maxFileSizeMb: Math.max(1, Number(event.target.value) || 1) }))} />
                </AdminField>
                <AdminField label="امتدادات الملفات المسموحة" hint="افصل بين كل امتداد وآخر بفاصلة.">
                  <AdminInput value={settingsDraft.allowedFileTypes.join(', ')} onChange={(event) => setSettingsDraft((current) => ({ ...current, allowedFileTypes: event.target.value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) }))} />
                </AdminField>
              </div>

              <div className="mt-4 grid gap-4">
                <AdminField label="رسالة النظام العامة" hint="تظهر على الموقع عند الحاجة لتنبيه شامل.">
                  <AdminTextarea rows={4} value={settingsDraft.systemMessage} onChange={(event) => setSettingsDraft((current) => ({ ...current, systemMessage: event.target.value }))} placeholder="اكتب رسالة عامة تظهر للزوار عند الحاجة..." />
                </AdminField>

                {settingsDraft.maintenanceMode ? (
                  <>
                    <AdminField label="سبب الصيانة">
                      <AdminTextarea rows={3} value={settingsDraft.maintenanceReason} onChange={(event) => setSettingsDraft((current) => ({ ...current, maintenanceReason: event.target.value }))} placeholder="اكتب سبب إيقاف المنصة مؤقتًا..." />
                    </AdminField>

                    <div className="grid gap-4 md:grid-cols-[1.1fr_0.45fr_0.45fr_0.45fr]">
                      <AdminField label="تاريخ انتهاء الصيانة">
                        <AdminInput type="date" value={maintenanceDate} onChange={(event) => { setMaintenanceDate(event.target.value); setSettingsDraft((current) => ({ ...current, maintenanceUntil: buildMaintenanceUntil(event.target.value, maintenanceHour, maintenanceMinute, maintenancePeriod) })); }} />
                      </AdminField>
                      <AdminField label="الساعة">
                        <AdminInput value={maintenanceHour} onChange={(event) => { setMaintenanceHour(event.target.value); setSettingsDraft((current) => ({ ...current, maintenanceUntil: buildMaintenanceUntil(maintenanceDate, event.target.value, maintenanceMinute, maintenancePeriod) })); }} />
                      </AdminField>
                      <AdminField label="الدقيقة">
                        <AdminInput value={maintenanceMinute} onChange={(event) => { setMaintenanceMinute(event.target.value); setSettingsDraft((current) => ({ ...current, maintenanceUntil: buildMaintenanceUntil(maintenanceDate, maintenanceHour, event.target.value, maintenancePeriod) })); }} />
                      </AdminField>
                      <AdminField label="AM / PM">
                        <AdminSelect value={maintenancePeriod} onChange={(event) => { const nextPeriod = event.target.value as 'AM' | 'PM'; setMaintenancePeriod(nextPeriod); setSettingsDraft((current) => ({ ...current, maintenanceUntil: buildMaintenanceUntil(maintenanceDate, maintenanceHour, maintenanceMinute, nextPeriod) })); }}>
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </AdminSelect>
                      </AdminField>
                    </div>
                  </>
                ) : null}
              </div>
            </AdminPanel>

            <AdminPanel
              title="تحكم فيديو خلفية الموقع (ظاهر هنا مباشرة)"
              description="لو كنت في تبويب المنصة فقط، تقدر من هنا تغيير فيديو الهيرو بدون التنقل لتبويب المحتوى."
            >
              <div className="grid gap-4">
                <AdminField label="رابط الفيديو (mp4 / webm)">
                  <AdminInput
                    dir="ltr"
                    value={contentDraft.homeHeroVideoUrl}
                    onChange={(event) =>
                      setContentDraft((current) => ({ ...current, homeHeroVideoUrl: event.target.value }))
                    }
                    placeholder="https://example.com/hero.mp4"
                  />
                </AdminField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[1rem] border border-dashed border-[rgba(24,37,63,0.14)] bg-[#f8fafc] px-4 py-3 text-sm font-bold text-[#4d5f6d] transition hover:border-[#005dac]/40">
                    <Film size={18} className="text-[#005dac]" />
                    <span>{videoUploadLabel}</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      className="hidden"
                      disabled={!hasFirebaseConfig() || videoBusy}
                      onChange={(event) => void handleHeroVideoUpload(event.target.files)}
                    />
                  </label>
                  <AdminButton type="button" variant="secondary" onClick={saveContentSettings}>
                    <Save size={16} />
                    حفظ إعدادات الفيديو
                  </AdminButton>
                </div>
                <div className="rounded-[1.1rem] border border-[rgba(24,37,63,0.1)] bg-[#f8fbff] p-3">
                  <div className="mb-2 text-xs font-black text-[#1a3458]">معاينة الفيديو ومكان ظهوره على الموقع</div>
                  <div className="relative overflow-hidden rounded-[0.95rem] border border-[rgba(24,37,63,0.08)] bg-[#dfe9f5]">
                    {contentDraft.homeHeroVideoUrl ? (
                      <video
                        key={contentDraft.homeHeroVideoUrl}
                        src={contentDraft.homeHeroVideoUrl}
                        className="h-44 w-full object-cover"
                        muted
                        loop
                        playsInline
                        autoPlay
                        controls
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center text-xs font-bold text-[#4b6281]">
                        لا يوجد فيديو مرفوع حاليًا — هذا هو المكان الذي سيظهر فيه فيديو خلفية الرئيسية.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </AdminPanel>

            <AdminPanel title="مراسلات المنصة" description="إرسال رسالة أو إشعار عام وحفظه ضمن سجل الإشعارات.">
              <div className="grid gap-4">
                <AdminField label="الفئة المستهدفة">
                  <AdminSelect value={messageForm.audience} onChange={(event) => setMessageForm((current) => ({ ...current, audience: event.target.value }))}>
                    <option value="الجميع">الجميع</option>
                    <option value="الشركات">الشركات</option>
                    <option value="المتقدمون">المتقدمون</option>
                    <option value="الإدارة">الإدارة</option>
                  </AdminSelect>
                </AdminField>
                <AdminField label="عنوان الرسالة">
                  <AdminInput value={messageForm.subject} onChange={(event) => setMessageForm((current) => ({ ...current, subject: event.target.value }))} />
                </AdminField>
                <AdminField label="محتوى الرسالة">
                  <AdminTextarea rows={5} value={messageForm.body} onChange={(event) => setMessageForm((current) => ({ ...current, body: event.target.value }))} placeholder="اكتب الرسالة أو الإشعار الذي تريد حفظه وإرساله..." />
                </AdminField>
                <AdminButton onClick={handleSendNotification}><BellRing size={16} />إرسال الرسالة</AdminButton>
              </div>
            </AdminPanel>
          </div>

          <div className="grid gap-6">
            <AdminPanel title="حالة التشغيل الحالية" description="ملخص مباشر لما هو مفعل الآن على المنصة.">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['تسجيل المستخدمين', settingsDraft.userRegistration ? 'مفعل' : 'متوقف'],
                  ['تسجيل الشركات', settingsDraft.companyRegistration ? 'مفعل' : 'متوقف'],
                  ['استقبال الطلبات', settingsDraft.jobApplications ? 'مفعل' : 'متوقف'],
                  ['رفع الملفات', settingsDraft.fileUploads ? 'مفعل' : 'متوقف'],
                  ['وضع الصيانة', settingsDraft.maintenanceMode ? 'مفعل' : 'غير مفعل'],
                  ['أنواع الملفات', settingsDraft.allowedFileTypes.join(' - ') || 'غير محدد'],
                ].map(([label, value]) => <div key={label} className="rounded-[1.2rem] bg-[#f7f9fc] px-4 py-4"><div className="text-xs font-bold text-[#7a8b9e]">{label}</div><div className="mt-2 text-sm font-black text-[#10213d]">{cleanAdminText(value)}</div></div>)}
              </div>
              {settingsDraft.maintenanceMode && settingsDraft.maintenanceUntil ? <div className="mt-4 rounded-[1.1rem] border border-[#f2dfb6] bg-[#fffaf0] px-4 py-4 text-sm leading-7 text-[#846938]">تنتهي الصيانة في: {formatDateTime(settingsDraft.maintenanceUntil)}</div> : null}
            </AdminPanel>

            <AdminPanel title="مؤشرات الإدارة" description="نظرة سريعة على الحسابات والأدوار داخل النظام.">
              <div className="grid gap-3">
                <div className="flex items-center gap-3 rounded-[1.2rem] bg-[#f7f9fc] px-4 py-4"><div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white text-[#18345c] shadow-[0_12px_24px_rgba(18,30,54,0.06)]"><ShieldCheck size={18} /></div><div><div className="text-xs font-bold text-[#7a8a9c]">Super Admin الحالي</div><div className="mt-1 text-sm font-black text-[#10213d]">{superAdmin?.displayName || 'غير متاح'}</div></div></div>
                <div className="flex items-center gap-3 rounded-[1.2rem] bg-[#f7f9fc] px-4 py-4"><div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white text-[#18345c] shadow-[0_12px_24px_rgba(18,30,54,0.06)]"><Users2 size={18} /></div><div><div className="text-xs font-bold text-[#7a8a9c]">الحسابات النشطة</div><div className="mt-1 text-sm font-black text-[#10213d]">{formatNumber(activeAdmins)}</div></div></div>
                <div className="flex items-center gap-3 rounded-[1.2rem] bg-[#f7f9fc] px-4 py-4"><div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white text-[#18345c] shadow-[0_12px_24px_rgba(18,30,54,0.06)]"><Clock3 size={18} /></div><div><div className="text-xs font-bold text-[#7a8a9c]">الحسابات الموقوفة</div><div className="mt-1 text-sm font-black text-[#10213d]">{formatNumber(suspendedAdmins)}</div></div></div>
              </div>
            </AdminPanel>
          </div>
        </div>
      ) : null}
      {activeTab === 'content' ? (
        <div className="grid gap-6">
          <AdminPanel
            title="فيديو خلفية الصفحة الرئيسية"
            description="يظهر خلف قسم الترحيب على الموقع العام مع طبقة شفافة للحفاظ على وضوح النصوص."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <AdminField label="رابط الفيديو (mp4 / webm)" hint="يمكنك لصق رابط مباشر من أي CDN." className="lg:col-span-2">
                <AdminInput
                  dir="ltr"
                  value={contentDraft.homeHeroVideoUrl}
                  onChange={(event) =>
                    setContentDraft((current) => ({ ...current, homeHeroVideoUrl: event.target.value }))
                  }
                  placeholder="https://example.com/hero.mp4"
                />
              </AdminField>
              <AdminField
                label="رفع ملف"
                hint={
                  hasFirebaseConfig()
                    ? 'يُرفع إلى Firebase Storage ضمن مجلد site/home-hero.'
                    : 'غير متاح بدون تهيئة Firebase في لوحة الأدمن.'
                }
              >
                <label className="flex cursor-pointer flex-col gap-2 rounded-[1.1rem] border border-dashed border-[rgba(24,37,63,0.14)] bg-[#f8fafc] px-4 py-6 text-center text-sm font-bold text-[#4d5f6d] transition hover:border-[#005dac]/40">
                  <Film className="mx-auto text-[#005dac]" size={22} />
                  <span>{videoBusy ? `جارٍ الرفع… ${videoUploadProgress}%` : 'اختر فيديو من الجهاز'}</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    disabled={!hasFirebaseConfig() || videoBusy}
                    onChange={(event) => void handleHeroVideoUpload(event.target.files)}
                  />
                </label>
              </AdminField>
              <div className="rounded-[1.1rem] bg-[#f4f7fb] px-4 py-4 text-xs leading-6 text-[#5c6f83]">
                لأفضل أداء: استخدم MP4 (H.264) بدقة 720p وحجم أقل من 35MB. الموقع يشغّل الفيديو بتحميل ذكي لتجنب التهنيج. بعد التأكد من المعاينة، احفظ المحتوى من الشريط العلوي. لإخفاء الفيديو، امسح الرابط واحفظ.
              </div>
            </div>
          </AdminPanel>
          {contentSections.map((section) => (
            <AdminPanel key={section.title} title={section.title} description="هذا القسم مرتبط مباشرة بالصفحات العامة على الموقع.">
              <div className="grid gap-4 lg:grid-cols-2">
                {section.fields.map((field) => {
                  const fieldKey = field.key as keyof typeof contentDraft;
                  const isTextarea = field.type === 'textarea';
                  return (
                    <AdminField key={field.key} label={field.label} className={isTextarea ? 'lg:col-span-2' : ''}>
                      {isTextarea ? (
                        <AdminTextarea rows={4} value={String(contentDraft[fieldKey] || '')} onChange={(event) => setContentDraft((current) => ({ ...current, [fieldKey]: event.target.value }))} />
                      ) : (
                        <AdminInput value={String(contentDraft[fieldKey] || '')} onChange={(event) => setContentDraft((current) => ({ ...current, [fieldKey]: event.target.value }))} />
                      )}
                    </AdminField>
                  );
                })}
              </div>
            </AdminPanel>
          ))}
        </div>
      ) : null}
      {activeTab === 'access' ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-6">
            <AdminPanel title="قاعدة الوصول" description="النظام يعتمد Super Admin واحد فقط، وباقي الحسابات تكون على أدوار داخلية منظمة.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] bg-[#f7f9fc] px-4 py-4"><div className="text-xs font-bold text-[#7a8b9e]">عدد الحسابات الإدارية</div><div className="mt-2 text-lg font-black text-[#10213d]">{formatNumber(state.admins.length)}</div></div>
                <div className="rounded-[1.2rem] bg-[#f7f9fc] px-4 py-4"><div className="text-xs font-bold text-[#7a8b9e]">عدد الأدوار الداخلية</div><div className="mt-2 text-lg font-black text-[#10213d]">{formatNumber(roleOptions.length)}</div></div>
              </div>
            </AdminPanel>

            <AdminPanel title="إنشاء حساب إداري" description="إنشاء أدمن أو مشرف على دور داخلي فقط.">
              <div className="grid gap-4 lg:grid-cols-2">
                <AdminField label="الاسم المعروض" required><AdminInput value={adminForm.displayName} onChange={(event) => setAdminForm((current) => ({ ...current, displayName: event.target.value }))} /></AdminField>
                <AdminField label="البريد الإلكتروني" required><AdminInput dir="ltr" value={adminForm.email} onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))} /></AdminField>
                <AdminField label="كلمة المرور" required><AdminInput type="password" dir="ltr" value={adminForm.password} onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))} /></AdminField>
                <AdminField label="الدور الداخلي"><AdminSelect value={adminForm.roleId} onChange={(event) => setAdminForm((current) => ({ ...current, roleId: event.target.value }))}>{roleOptions.map((role) => <option key={role.id} value={role.id}>{cleanAdminText(role.name)}</option>)}</AdminSelect></AdminField>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3"><AdminButton onClick={handleCreateAdmin}><Plus size={16} />إنشاء الحساب</AdminButton><AdminBadge tone="warning">Super Admin محجوز لحساب واحد فقط</AdminBadge></div>
            </AdminPanel>

            <AdminPanel title="الحسابات الإدارية" description="عرض الحسابات الحالية وتغيير الحالة أو الدور عند الحاجة.">
              <div className="space-y-3">
                {state.admins.map((admin) => {
                  const role = state.roles.find((item) => item.id === admin.roleId) || null;
                  const isSuperAdmin = admin.roleId === 'super-admin';
                  return (
                    <div key={admin.id} className="rounded-[1.2rem] border border-[rgba(24,37,63,0.08)] bg-[#fbfdff] px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0"><div className="text-sm font-black text-[#10213d]">{cleanAdminText(admin.displayName)}</div><div className="mt-1 text-xs text-[#74879b]">آخر دخول: {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : 'لم يتم بعد'}</div><div className="mt-1 text-xs text-[#74879b]">تاريخ الإنشاء: {formatDateTime(admin.createdAt)}</div></div>
                        <div className="flex flex-wrap gap-2"><AdminBadge tone={isSuperAdmin ? 'warning' : 'info'}>{cleanAdminText(role?.name || admin.roleId)}</AdminBadge><AdminBadge tone={admin.status === 'active' ? 'success' : 'danger'}>{admin.status === 'active' ? 'نشط' : 'موقوف'}</AdminBadge></div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                        <AdminSelect value={admin.roleId} disabled={isSuperAdmin} onChange={(event) => updateAdminRole(admin.id, event.target.value)}>
                          {state.roles.map((roleItem) => <option key={roleItem.id} value={roleItem.id} disabled={roleItem.id === 'super-admin' && !isSuperAdmin}>{cleanAdminText(roleItem.name)}</option>)}
                        </AdminSelect>
                        <AdminButton variant={admin.status === 'active' ? 'danger' : 'secondary'} disabled={isSuperAdmin} onClick={() => updateAdminStatus(admin.id, admin.status === 'active' ? 'suspended' : 'active')}>{admin.status === 'active' ? 'إيقاف الحساب' : 'إعادة التفعيل'}</AdminButton>
                        <AdminBadge tone={isSuperAdmin ? 'warning' : 'neutral'} className="justify-center px-4 py-2">{isSuperAdmin ? 'محمي' : 'قابل للإدارة'}</AdminBadge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AdminPanel>
          </div>

          <div className="grid gap-6">
            <AdminPanel title="الأدوار الداخلية" description="إدارة الصلاحيات التفصيلية للأدوار غير المحجوزة.">
              <div className="space-y-4">
                {state.roles.map((role) => (
                  <div key={role.id} className="rounded-[1.2rem] border border-[rgba(24,37,63,0.08)] bg-[#fbfdff] px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><div className="text-sm font-black text-[#10213d]">{cleanAdminText(role.name)}</div><div className="mt-1 text-xs leading-6 text-[#73849a]">{cleanAdminText(role.description)}</div></div>
                      <div className="flex flex-wrap gap-2"><AdminBadge tone={role.locked ? 'warning' : 'info'}>{role.locked ? 'دور محجوز' : 'قابل للتعديل'}</AdminBadge><AdminBadge tone="neutral">{buildRoleSummary(role)}</AdminBadge></div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {PERMISSION_CATALOG.map((permission) => {
                        const active = role.permissions.includes(permission.key);
                        return (
                          <button key={`${role.id}-${permission.key}`} type="button" disabled={role.locked} onClick={() => toggleRolePermission(role.id, permission.key)} className={`flex items-center justify-between gap-3 rounded-[1rem] border px-3 py-2.5 text-right transition ${active ? 'border-[rgba(36,67,106,0.16)] bg-[#eef3ff] text-[#17325a]' : 'border-[rgba(24,37,63,0.08)] bg-[#f7f9fc] text-[#5f7288]'} ${role.locked ? 'cursor-not-allowed opacity-70' : 'hover:border-[rgba(24,37,63,0.16)]'}`}>
                            <span className="text-sm font-bold">{permission.label}</span>
                            <AdminBadge tone={active ? 'success' : 'neutral'}>{active ? 'مفعل' : 'غير مفعل'}</AdminBadge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </AdminPanel>

            <AdminPanel title="إنشاء دور جديد" description="إضافة دور داخلي جديد ثم تخصيص صلاحياته من القائمة أعلاه.">
              <div className="grid gap-4">
                <AdminField label="اسم الدور"><AdminInput value={roleName} onChange={(event) => setRoleName(event.target.value)} /></AdminField>
                <AdminField label="وصف الدور"><AdminTextarea rows={4} value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} /></AdminField>
                <AdminButton onClick={handleCreateRole}><Plus size={16} />إنشاء الدور</AdminButton>
              </div>
            </AdminPanel>
          </div>
        </div>
      ) : null}
      {activeTab === 'profile' ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-6">
            <AdminPanel title="ملف الحساب الحالي" description="بيانات الحساب المستخدم الآن داخل لوحة التحكم.">
              <div className="grid gap-4">
                {[
                  { icon: UserCog, label: 'الاسم الحالي', value: currentAdmin?.displayName || 'غير متاح' },
                  { icon: Mail, label: 'البريد الحالي', value: session?.identifier || 'غير متاح' },
                  { icon: ShieldCheck, label: 'الدور الحالي', value: cleanAdminText(state.roles.find((role) => role.id === currentAdmin?.roleId)?.name || 'غير محدد') },
                  { icon: Clock3, label: 'آخر تسجيل دخول', value: currentAdmin?.lastLoginAt ? formatDateTime(currentAdmin.lastLoginAt) : 'لم يتم بعد' },
                ].map((item) => <div key={item.label} className="flex items-center gap-3 rounded-[1.35rem] bg-[#f7f9fc] px-4 py-4"><div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white text-[#18345c] shadow-[0_12px_24px_rgba(18,30,54,0.06)]"><item.icon size={18} /></div><div><div className="text-xs font-bold text-[#7a8a9c]">{item.label}</div><div className="mt-1 text-sm font-black text-[#10213d]">{item.value}</div></div></div>)}
              </div>
            </AdminPanel>

            <AdminPanel title="آخر الإشعارات المرسلة" description="سجل موجز لآخر الرسائل والإشعارات الخارجة من النظام.">
              {state.sentNotifications.length ? (
                <div className="space-y-3">
                  {state.sentNotifications.slice(0, 5).map((item) => <div key={item.id} className="rounded-[1.35rem] bg-[#f7f9fc] px-4 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-black text-[#11213d]">{cleanAdminText(item.subject)}</div><div className="mt-1 text-xs text-[#73849a]">{cleanAdminText(item.audience)}</div></div><AdminBadge tone="info">{formatDateTime(item.sentAt)}</AdminBadge></div><p className="mt-3 text-sm leading-7 text-[#617287]">{cleanAdminText(item.body)}</p></div>)}
                </div>
              ) : <AdminEmptyState title="لا توجد إشعارات مرسلة" description="بمجرد إرسال رسالة من تبويب المنصة ستظهر هنا مباشرة." />}
            </AdminPanel>
          </div>

          <AdminPanel title="تحديث بيانات الحساب" description="تعديل الاسم والبريد وكلمة المرور للحساب الحالي مع تحقق كامل.">
            <div className="grid gap-4 lg:grid-cols-2">
              <AdminField label="الاسم المعروض" required><AdminInput value={profileForm.displayName} onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))} /></AdminField>
              <AdminField label="البريد الإلكتروني" required><AdminInput dir="ltr" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} /></AdminField>
              <AdminField label="كلمة المرور الحالية" className="lg:col-span-2" hint="مطلوبة عند تغيير البريد أو تعيين كلمة مرور جديدة."><AdminInput type="password" dir="ltr" value={profileForm.currentPassword} onChange={(event) => setProfileForm((current) => ({ ...current, currentPassword: event.target.value }))} /></AdminField>
              <AdminField label="كلمة المرور الجديدة"><AdminInput type="password" dir="ltr" value={profileForm.newPassword} onChange={(event) => setProfileForm((current) => ({ ...current, newPassword: event.target.value }))} /></AdminField>
              <AdminField label="تأكيد كلمة المرور الجديدة"><AdminInput type="password" dir="ltr" value={profileForm.confirmPassword} onChange={(event) => setProfileForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></AdminField>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <AdminButton onClick={handleProfileSave}><Save size={16} />حفظ بيانات الحساب</AdminButton>
              <AdminBadge tone="warning">{formatNumber(state.auditLogs.length)} عملية موثقة في السجل</AdminBadge>
            </div>
          </AdminPanel>
        </div>
      ) : null}
    </>
  );
}
