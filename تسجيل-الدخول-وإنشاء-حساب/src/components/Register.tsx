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
      const nextTarget = sanitizeRedirectTarget(redirectTo, 'company-dashboard.html');
      window.setTimeout(() => {
        window.location.href = buildSiteUrl(nextTarget, 'company-dashboard.html');
      }, 450);
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
    <div className="min-h-screen bg-[#f4efe7] px-2.5 py-2.5 text-slate-900 sm:px-3.5 sm:py-3.5">
      <div className="mx-auto grid min-h-[calc(100vh-1.25rem)] max-w-[980px] gap-2.5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden rounded-[22px] bg-[#152845] p-5 text-white shadow-sm lg:flex lg:flex-col lg:items-center lg:justify-center">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[20px] bg-white/10 p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <img src={logoHref} alt={SITE_NAME} className="h-full w-full object-contain" />
            </div>
            <div className="mt-3 text-[0.82rem] font-black tracking-[0.08em] text-white/80">{SITE_NAME}</div>
            <div className="mt-2 text-[1.5rem] font-black leading-tight">إنشاء حساب</div>
          </div>
        </aside>

        <section className="flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="w-full rounded-[22px] border border-[rgba(20,35,59,0.08)] bg-white/98 p-3.5 shadow-sm sm:p-4.5"
          >
            <div className="mb-3.5 flex items-center justify-between gap-2.5">
              <a
                href={siteHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f6f3ee] px-2.5 py-1.5 text-[0.78rem] font-bold text-[#5f6f81] transition hover:bg-[#efe8dc] hover:text-[#13233b]"
              >
                <ArrowRight className="h-4 w-4" />
                العودة للموقع
              </a>

              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#152845] p-2">
                  <img src={logoHref} alt={SITE_NAME} className="h-full w-full object-contain" />
                </div>
                <div className="text-right">
                  <div className="text-[0.7rem] font-black tracking-[0.08em] text-[#8d7b58]">{SITE_NAME}</div>
                  <h1 className="text-[1.02rem] font-black leading-none text-[#13233b]">إنشاء حساب</h1>
                </div>
              </div>
            </div>

            <h1 className="mb-3.5 hidden text-[1.5rem] font-black tracking-tight text-[#13233b] lg:block">إنشاء حساب</h1>

            {status ? (
              <div
                className={`mb-3.5 rounded-[16px] border px-3 py-2 text-sm font-bold leading-6 ${
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

            <form className="space-y-2.5" onSubmit={handleSubmit}>
              <div className="grid gap-2.5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[0.88rem] font-bold text-[#23354d]">اسم الشركة</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f5f7fa] text-[#7f90a4]">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      autoComplete="organization"
                      className="h-10 w-full rounded-[14px] border border-[#d9e0e8] bg-[#fbfcfd] py-2 pr-11 pl-3.5 text-[0.96rem] text-slate-900 outline-none transition focus:border-[#b88f47] focus:bg-white focus:ring-2 focus:ring-[#b88f47]/20"
                      placeholder="اسم الشركة"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[0.88rem] font-bold text-[#23354d]">مجال الشركة</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f5f7fa] text-[#7f90a4]">
                      <Landmark className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      className="h-10 w-full rounded-[14px] border border-[#d9e0e8] bg-[#fbfcfd] py-2 pr-11 pl-3.5 text-[0.96rem] text-slate-900 outline-none transition focus:border-[#b88f47] focus:bg-white focus:ring-2 focus:ring-[#b88f47]/20"
                      placeholder="مثال: التوظيف أو الخدمات"
                      value={companySector}
                      onChange={(event) => setCompanySector(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[0.88rem] font-bold text-[#23354d]">المدينة</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f5f7fa] text-[#7f90a4]">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      className="h-10 w-full rounded-[14px] border border-[#d9e0e8] bg-[#fbfcfd] py-2 pr-11 pl-3.5 text-[0.96rem] text-slate-900 outline-none transition focus:border-[#b88f47] focus:bg-white focus:ring-2 focus:ring-[#b88f47]/20"
                      placeholder="المدينة"
                      value={companyCity}
                      onChange={(event) => setCompanyCity(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[0.88rem] font-bold text-[#23354d]">حجم الفريق</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f5f7fa] text-[#7f90a4]">
                      <Users className="h-4 w-4" />
                    </span>
                    <select
                      required
                      className="h-10 w-full appearance-none rounded-[14px] border border-[#d9e0e8] bg-[#fbfcfd] py-2 pr-11 pl-3.5 text-[0.96rem] text-slate-900 outline-none transition focus:border-[#b88f47] focus:bg-white focus:ring-2 focus:ring-[#b88f47]/20"
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

              <div className="grid gap-2.5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[0.88rem] font-bold text-[#23354d]">رقم الموبايل</span>
                  <PhoneInput
                    value={phone}
                    onChange={(value) => setPhone(value)}
                    countryCode={countryCode}
                    onCountryCodeChange={(value) => setCountryCode(value)}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[0.88rem] font-bold text-[#23354d]">البريد الإلكتروني</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f5f7fa] text-[#7f90a4]">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      className="h-10 w-full rounded-[14px] border border-[#d9e0e8] bg-[#fbfcfd] py-2 pr-11 pl-3.5 text-[0.96rem] text-slate-900 outline-none transition focus:border-[#b88f47] focus:bg-white focus:ring-2 focus:ring-[#b88f47]/20"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </label>
              </div>

              <div className="grid gap-2.5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[0.88rem] font-bold text-[#23354d]">كلمة المرور</span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      className="h-10 w-full rounded-[14px] border border-[#d9e0e8] bg-[#fbfcfd] py-2 pr-3.5 pl-11 text-[0.96rem] text-slate-900 outline-none transition focus:border-[#b88f47] focus:bg-white focus:ring-2 focus:ring-[#b88f47]/20"
                      placeholder="8 أحرف على الأقل"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f5f7fa] text-[#6d7e92] transition hover:bg-[#eef2f7] hover:text-[#13233b]"
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[0.88rem] font-bold text-[#23354d]">تأكيد كلمة المرور</span>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      className="h-10 w-full rounded-[14px] border border-[#d9e0e8] bg-[#fbfcfd] py-2 pr-3.5 pl-11 text-[0.96rem] text-slate-900 outline-none transition focus:border-[#b88f47] focus:bg-white focus:ring-2 focus:ring-[#b88f47]/20"
                      placeholder="أعد كتابة كلمة المرور"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f5f7fa] text-[#6d7e92] transition hover:bg-[#eef2f7] hover:text-[#13233b]"
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
                className="inline-flex h-10 w-full items-center justify-center rounded-[14px] bg-[#13233b] px-5 text-[0.95rem] font-black text-white shadow-sm transition hover:bg-[#0f1c30] focus:ring-2 focus:ring-[#13233b]/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}
              </button>
            </form>

            <div className="mt-3 rounded-[16px] bg-[#f8f5ef] px-3 py-2.5 text-[0.9rem] text-[#66768a]">
              لديك حساب شركة بالفعل؟{' '}
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="font-black text-[#13233b] transition hover:text-[#b88f47]"
              >
                تسجيل الدخول
              </button>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
