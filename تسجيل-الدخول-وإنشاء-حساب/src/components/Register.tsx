import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Building2, Eye, EyeOff, Landmark, Mail, MapPin, Users } from 'lucide-react';
import { registerCompany } from '../lib/company-auth';
import { buildSiteUrl, sanitizeRedirectTarget } from '../lib/navigation';
import PhoneInput from './PhoneInput';

interface RegisterProps {
  onNavigate: (page: 'login' | 'register') => void;
  redirectTo?: string;
}

type StatusState =
  | {
      tone: 'success' | 'error';
      message: string;
    }
  | null;

const SITE_NAME = 'الرحمة المهداه للتوظيف';

export default function Register({ onNavigate, redirectTo }: RegisterProps) {
  const [companyName, setCompanyName] = useState('');
  const [companySector, setCompanySector] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+20');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const siteHref = buildSiteUrl('index.html');
  const logoHref = '/logo-mark.png';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await registerCompany({
        companyName,
        companySector,
        companyCity,
        teamSize,
        phone: `${countryCode}${phone}`.trim(),
        email,
        password,
        confirmPassword,
        remember: true,
      });

      if (!result.ok) {
        setStatus({ tone: 'error', message: result.message });
        return;
      }

      setStatus({ tone: 'success', message: result.message });
      if (result.session) {
        const nextTarget = sanitizeRedirectTarget(redirectTo, 'company-dashboard.html');
        window.setTimeout(() => {
          window.location.href = buildSiteUrl(nextTarget, 'company-dashboard.html');
        }, 450);
      } else if (result.requiresEmailVerification) {
        window.setTimeout(() => {
          onNavigate('login');
        }, 900);
      }
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'تعذر إنشاء الحساب الآن.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#eef6f6_55%,#e8f1f2_100%)] px-3 py-3 text-slate-900 sm:px-4 sm:py-4">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1160px] gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full rounded-[28px] border border-[#d7e6e8] bg-[rgba(248,245,239,0.95)] p-4 shadow-[0_26px_68px_rgba(15,61,76,0.12)] backdrop-blur sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <a
                href={siteHref}
                className="inline-flex items-center gap-2 rounded-full border border-[#d7e6e8] bg-white px-3.5 py-2 text-[0.78rem] font-extrabold text-[#0f3d4c] transition hover:-translate-y-0.5 hover:border-[#1f6b7a]/30 hover:bg-[#eef6f6]"
              >
                <ArrowRight className="h-4 w-4" />
                العودة للموقع
              </a>

              <div className="flex items-center gap-3 lg:hidden">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#0f3d4c,#1f6b7a)] p-2 shadow-[0_18px_30px_rgba(15,61,76,0.2)]">
                  <img src={logoHref} alt={SITE_NAME} className="h-full w-full object-contain" />
                </div>
                <div className="text-right">
                  <div className="text-[0.68rem] font-black tracking-[0.1em] text-[#7e6b44]">{SITE_NAME}</div>
                  <h1 className="text-[1rem] font-black text-[#0f3d4c]">إنشاء حساب شركة</h1>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c79d] bg-[#f5ecda] px-3.5 py-2 text-[0.76rem] font-black text-[#8b6a2f]">
                <Building2 className="h-4 w-4" />
                ملف شركة جديد
              </div>
              <h1 className="mt-3 text-[1.95rem] font-black tracking-[-0.05em] text-[#0f3d4c]">
                أنشئ حساب شركتك وابدأ إدارة الوظائف من واجهة مرتبة وواضحة.
              </h1>
              <p className="mt-3 max-w-[34rem] text-[0.95rem] leading-7 text-[#5f7b82]">
                املأ البيانات الأساسية مرة واحدة، وبعدها تنتقل مباشرة إلى لوحة الشركة لإضافة الوظائف ومراجعة الطلبات.
              </p>
            </div>

            {status ? (
              <div
                className={`mt-4 rounded-[16px] border px-4 py-3 text-sm font-bold leading-7 ${
                  status.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
                role="status"
                aria-live="polite"
              >
                {status.message}
              </div>
            ) : null}

            <form className="mt-4 space-y-3.5" onSubmit={handleSubmit}>
              <div className="grid gap-3.5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[0.88rem] font-black text-[#183845]">اسم الشركة</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] bg-[#eef6f6] text-[#1f6b7a]">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      autoComplete="organization"
                      className="h-11 w-full rounded-[16px] border border-[#d5e3e5] bg-white py-2.5 pr-12 pl-4 text-[0.94rem] font-semibold text-slate-900 outline-none transition focus:border-[#1f6b7a] focus:ring-4 focus:ring-[#1f6b7a]/12"
                      placeholder="اسم الشركة"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[0.88rem] font-black text-[#183845]">مجال الشركة</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] bg-[#eef6f6] text-[#1f6b7a]">
                      <Landmark className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      className="h-11 w-full rounded-[16px] border border-[#d5e3e5] bg-white py-2.5 pr-12 pl-4 text-[0.94rem] font-semibold text-slate-900 outline-none transition focus:border-[#1f6b7a] focus:ring-4 focus:ring-[#1f6b7a]/12"
                      placeholder="مثل: التوظيف أو الخدمات"
                      value={companySector}
                      onChange={(event) => setCompanySector(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[0.88rem] font-black text-[#183845]">المدينة</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] bg-[#eef6f6] text-[#1f6b7a]">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      className="h-11 w-full rounded-[16px] border border-[#d5e3e5] bg-white py-2.5 pr-12 pl-4 text-[0.94rem] font-semibold text-slate-900 outline-none transition focus:border-[#1f6b7a] focus:ring-4 focus:ring-[#1f6b7a]/12"
                      placeholder="المدينة"
                      value={companyCity}
                      onChange={(event) => setCompanyCity(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[0.88rem] font-black text-[#183845]">حجم الفريق</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] bg-[#eef6f6] text-[#1f6b7a]">
                      <Users className="h-4 w-4" />
                    </span>
                    <select
                      required
                      className="h-11 w-full appearance-none rounded-[16px] border border-[#d5e3e5] bg-white py-2.5 pr-12 pl-4 text-[0.94rem] font-semibold text-slate-900 outline-none transition focus:border-[#1f6b7a] focus:ring-4 focus:ring-[#1f6b7a]/12"
                      value={teamSize}
                      onChange={(event) => setTeamSize(event.target.value)}
                    >
                      <option value="">اختر الحجم</option>
                      <option value="1-10">1 - 10</option>
                      <option value="11-25">11 - 25</option>
                      <option value="26-50">26 - 50</option>
                      <option value="51-100">51 - 100</option>
                      <option value="100+">أكثر من 100</option>
                    </select>
                  </div>
                </label>
              </div>

              <div className="grid gap-3.5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[0.88rem] font-black text-[#183845]">رقم الموبايل</span>
                  <PhoneInput
                    value={phone}
                    onChange={(value) => setPhone(value)}
                    countryCode={countryCode}
                    onCountryCodeChange={(value) => setCountryCode(value)}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[0.88rem] font-black text-[#183845]">البريد الإلكتروني</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] bg-[#eef6f6] text-[#1f6b7a]">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      className="h-11 w-full rounded-[16px] border border-[#d5e3e5] bg-white py-2.5 pr-12 pl-4 text-[0.94rem] font-semibold text-slate-900 outline-none transition focus:border-[#1f6b7a] focus:ring-4 focus:ring-[#1f6b7a]/12"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </label>
              </div>

              <div className="grid gap-3.5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[0.88rem] font-black text-[#183845]">كلمة المرور</span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      className="h-11 w-full rounded-[16px] border border-[#d5e3e5] bg-white py-2.5 pr-4 pl-12 text-[0.94rem] font-semibold text-slate-900 outline-none transition focus:border-[#1f6b7a] focus:ring-4 focus:ring-[#1f6b7a]/12"
                      placeholder="8 أحرف على الأقل"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] bg-[#f8f5ef] text-[#55727a] transition hover:bg-[#eef6f6] hover:text-[#0f3d4c]"
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[0.88rem] font-black text-[#183845]">تأكيد كلمة المرور</span>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      className="h-11 w-full rounded-[16px] border border-[#d5e3e5] bg-white py-2.5 pr-4 pl-12 text-[0.94rem] font-semibold text-slate-900 outline-none transition focus:border-[#1f6b7a] focus:ring-4 focus:ring-[#1f6b7a]/12"
                      placeholder="أعد كتابة كلمة المرور"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] bg-[#f8f5ef] text-[#55727a] transition hover:bg-[#eef6f6] hover:text-[#0f3d4c]"
                      aria-label={showConfirmPassword ? 'إخفاء تأكيد كلمة المرور' : 'إظهار تأكيد كلمة المرور'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#0f3d4c,#1f6b7a)] px-5 text-[0.94rem] font-black text-white shadow-[0_18px_30px_rgba(15,61,76,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_36px_rgba(15,61,76,0.22)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}
              </button>
            </form>

            <div className="mt-4 rounded-[16px] border border-[#dde7e8] bg-white px-4 py-3 text-[0.88rem] text-[#5d7880]">
              لديك حساب شركة بالفعل؟{' '}
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="font-black text-[#0f3d4c] transition hover:text-[#c7a76c]"
              >
                تسجيل الدخول
              </button>
            </div>
          </motion.div>
        </section>

        <aside className="hidden rounded-[28px] bg-[linear-gradient(180deg,#0f3d4c_0%,#1f6b7a_100%)] p-5 text-white shadow-[0_28px_70px_rgba(15,61,76,0.2)] lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/10 p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <img src={logoHref} alt={SITE_NAME} className="h-full w-full object-contain" />
            </div>
            <div className="mt-4 text-[0.78rem] font-black tracking-[0.12em] text-white/74">{SITE_NAME}</div>
            <h2 className="mt-3 text-[1.7rem] font-black leading-tight">ملف شركة منظم من أول تسجيل حتى أول وظيفة منشورة.</h2>
            <p className="mt-3 text-[0.9rem] leading-7 text-white/78">
              بمجرد إنشاء الحساب تقدر تضيف الوظائف، تراجع الطلبات، وتدير بيانات الشركة من نفس اللوحة.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-[18px] border border-white/10 bg-white/8 px-4 py-3.5">
              <div className="text-sm font-black">بيانات أساسية واضحة</div>
              <p className="mt-1 text-[0.84rem] leading-7 text-white/74">اسم الشركة، المجال، المدينة، الهاتف ووسيلة الدخول في نفس النموذج.</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/8 px-4 py-3.5">
              <div className="text-sm font-black">انتقال مباشر للوحة</div>
              <p className="mt-1 text-[0.84rem] leading-7 text-white/74">بعد الإتمام تنتقل مباشرة لمتابعة الوظائف والمتقدمين بدون تعقيد.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
