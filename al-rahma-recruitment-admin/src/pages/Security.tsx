import { Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { AdminButton, AdminField, AdminInput, AdminKeyValue, AdminPanel, AdminStatusBadge } from '../components/ui/admin-kit';
import { useAdmin } from '../lib/admin-store';

export default function Security() {
  const { currentAdmin, currentRole, session, updateCurrentAdminProfile } = useAdmin();
  const [displayName, setDisplayName] = useState(currentAdmin?.displayName || '');
  const [email, setEmail] = useState(String(session?.identifier || ''));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDisplayName(currentAdmin?.displayName || '');
    setEmail(String(session?.identifier || ''));
  }, [currentAdmin?.displayName, session?.identifier]);

  const canShowPasswordFields = Boolean(currentPassword.trim() || newPassword.trim() || confirmPassword.trim());

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    const result = await updateCurrentAdminProfile({
      displayName,
      email,
      currentPassword,
      newPassword,
      confirmPassword,
    });

    setIsSaving(false);

    if (!result.ok) {
      setFeedback({ type: 'error', message: result.message });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFeedback({ type: 'success', message: 'تم تحديث بيانات الحساب الحالي بنجاح.' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="حسابي"
        title="الحساب الشخصي"
        description="يمكنك هنا تعديل الاسم والبريد الإلكتروني وكلمة المرور الخاصة بحسابك الحالي فقط. تغيير الحالة أو الدور غير مسموح من هذه الصفحة."
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <AdminPanel title="بيانات الحساب" description="الاسم والبريد وكلمة المرور الخاصة بالأدمن الحالي." bodyClassName="space-y-4">
          {feedback ? (
            <div
              className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                feedback.type === 'success'
                  ? 'border border-[#bfe5d4] bg-[#eef8f2] text-[#226146]'
                  : 'border border-[#f0c5bd] bg-[#fbe8e5] text-[#9d341f]'
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="الاسم الظاهر">
                <div className="relative">
                  <UserRound size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7d8b97]" />
                  <AdminInput
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="pr-11"
                    placeholder="اسم الحساب"
                  />
                </div>
              </AdminField>

              <AdminField label="البريد الإلكتروني">
                <div className="relative">
                  <Mail size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7d8b97]" />
                  <AdminInput
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pr-11"
                    dir="ltr"
                    type="email"
                    placeholder="البريد الإلكتروني"
                  />
                </div>
              </AdminField>
            </div>

            <div className="rounded-2xl border border-[#e7ebef] bg-[#f8fafb] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#173349]">الحماية الذاتية</p>
                  <p className="mt-1 text-xs text-[#7b8791]">
                    لو هتغير البريد أو كلمة المرور، لازم تدخل كلمة المرور الحالية للتأكيد.
                  </p>
                </div>
                <AdminStatusBadge status={currentAdmin?.status || 'active'} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <AdminField label="كلمة المرور الحالية">
                  <div className="relative">
                    <Lock size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7d8b97]" />
                    <AdminInput
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="pr-11 pl-11"
                      dir="ltr"
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((value) => !value)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7d8b97] transition hover:text-[#12293b]"
                    >
                      {showCurrentPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </AdminField>

                <AdminField label="كلمة المرور الجديدة">
                  <div className="relative">
                    <Lock size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7d8b97]" />
                    <AdminInput
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="pr-11 pl-11"
                      dir="ltr"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="اتركها فارغة لو مش هتغيّرها"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((value) => !value)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7d8b97] transition hover:text-[#12293b]"
                    >
                      {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </AdminField>
              </div>

              <div className="mt-4">
                <AdminField label="تأكيد كلمة المرور الجديدة">
                  <AdminInput
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    dir="ltr"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="أعد كتابة كلمة المرور الجديدة"
                  />
                </AdminField>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AdminButton type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
              </AdminButton>
              <span className="text-xs font-semibold text-[#7b8791]">
                {canShowPasswordFields ? 'يتم التحقق من كلمة المرور الحالية قبل الحفظ.' : 'تغيير الاسم فقط لا يحتاج إلى كلمة المرور الحالية.'}
              </span>
            </div>
          </form>
        </AdminPanel>

        <AdminPanel title="ملخص الحساب" description="بيانات سريعة عن الحساب الحالي مع تذكير بالقيود." bodyClassName="space-y-3">
          <div className="rounded-2xl bg-[#26445d] px-4 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/12">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-sm font-black">{currentAdmin?.displayName || 'الحساب الحالي'}</div>
                <div className="text-xs text-white/75">{currentRole?.name || 'صلاحية إدارية'}</div>
              </div>
            </div>
          </div>

          <AdminKeyValue label="البريد المسجل" value={<span dir="ltr">{session?.identifier || 'غير متاح'}</span>} />
          <AdminKeyValue label="الحالة" value={<AdminStatusBadge status={currentAdmin?.status || 'active'} />} />
          <AdminKeyValue label="آخر دخول" value={currentAdmin?.lastLoginAt ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(currentAdmin.lastLoginAt)) : 'لم يسجل بعد'} />

          {!session?.identifier ? (
            <div className="rounded-2xl bg-[#fff7ed] px-4 py-4 text-sm leading-8 text-[#92400e]">
              البريد الحالي غير محفوظ في الجلسة القديمة. يمكنك تعديل الاسم الآن مباشرة، وإذا أردت تحديث البريد اكتب بريدًا جديدًا ثم أكّد بكلمة المرور الحالية.
            </div>
          ) : null}

          <div className="rounded-2xl border border-[#e5eaef] bg-[#f8fafb] px-4 py-4 text-sm leading-8 text-[#4d5f6d]">
            من هنا فقط تقدر تعدل الاسم والبريد وكلمة المرور الخاصة بك. أي تغيير في الحالة أو الدور محجوب ومتاح فقط من لوحة إدارة الحسابات.
          </div>
        </AdminPanel>
      </section>
    </div>
  );
}
