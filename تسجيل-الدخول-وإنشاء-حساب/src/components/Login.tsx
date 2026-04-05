import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { loginCompany } from '../lib/company-auth';
import { buildSiteUrl, sanitizeRedirectTarget } from '../lib/navigation';

interface LoginProps {
  onNavigate: (page: 'login' | 'register') => void;
  redirectTo?: string;
}

const SITE_NAME = 'الرحمة المهداه للتوظيف';

export default function Login({ onNavigate, redirectTo }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const forgotPasswordParams = new URLSearchParams(searchParams);
  const siteHref = buildSiteUrl('index.html');
  const logoHref = '/logo-mark.png';

  forgotPasswordParams.set('view', 'forgot-password');
  const forgotPasswordHref = `?${forgotPasswordParams.toString()}`;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await loginCompany({
        email,
        password,
        remember: rememberMe,
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
        }, 350);
      }
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'تعذر تسجيل الدخول الآن.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#eef6f6_52%,#e8f1f2_100%)] px-3 py-3 text-slate-900 sm:px-4 sm:py-4">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1080px] gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-[38rem] rounded-[28px] border border-[#d7e6e8] bg-[rgba(248,245,239,0.95)] p-4 shadow-[0_26px_68px_rgba(15,61,76,0.12)] backdrop-blur sm:p-5"
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
                  <h1 className="text-[1rem] font-black text-[#0f3d4c]">تسجيل الدخول</h1>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c79d] bg-[#f5ecda] px-3.5 py-2 text-[0.76rem] font-black text-[#8b6a2f]">
                <ShieldCheck className="h-4 w-4" />
                دخول آمن للشركات
              </div>
              <h1 className="mt-3 text-[2rem] font-black tracking-[-0.05em] text-[#0f3d4c]">
                ادخل إلى لوحة شركتك وتابع الوظائف والطلبات بسهولة.
              </h1>
              <p className="mt-3 max-w-[32rem] text-[0.95rem] leading-7 text-[#5f7b82]">
                استخدم البريد الإلكتروني وكلمة المرور المرتبطين بحساب الشركة للوصول السريع إلى لوحة التشغيل والمتابعة.
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

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
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

              <label className="block">
                <span className="mb-2 block text-[0.88rem] font-black text-[#183845]">كلمة المرور</span>
                <div className="relative">
                  <span className="pointer-events-none absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] bg-[#eef6f6] text-[#1f6b7a]">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="h-11 w-full rounded-[16px] border border-[#d5e3e5] bg-white py-2.5 pr-12 pl-12 text-[0.94rem] font-semibold text-slate-900 outline-none transition focus:border-[#1f6b7a] focus:ring-4 focus:ring-[#1f6b7a]/12"
                    placeholder="أدخل كلمة المرور"
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

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[0.84rem] font-semibold text-[#5e7780]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#bfd3d7] text-[#1f6b7a] focus:ring-[#1f6b7a]"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  تذكر هذا الجهاز
                </label>

                <a href={forgotPasswordHref} className="text-[0.84rem] font-black text-[#c7a76c] transition hover:text-[#8b6a2f]">
                  نسيت كلمة المرور؟
                </a>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#0f3d4c,#1f6b7a)] px-5 text-[0.94rem] font-black text-white shadow-[0_18px_30px_rgba(15,61,76,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_36px_rgba(15,61,76,0.22)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'جارٍ التحقق...' : 'دخول لوحة الشركة'}
              </button>
            </form>

            <div className="mt-4 rounded-[16px] border border-[#dde7e8] bg-white px-4 py-3 text-[0.88rem] text-[#5d7880]">
              لا يوجد لديك حساب شركة حتى الآن؟{' '}
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="font-black text-[#0f3d4c] transition hover:text-[#c7a76c]"
              >
                أنشئ حسابًا جديدًا
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
            <h2 className="mt-3 text-[1.75rem] font-black leading-tight">وصول سريع وواضح لإدارة الوظائف والطلبات.</h2>
            <p className="mt-3 text-[0.9rem] leading-7 text-white/78">
              نفس حساب الشركة ينقلك إلى لوحة واحدة تراجع منها الوظائف، الطلبات، وحالة كل مرشح بشكل منظم.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-[18px] border border-white/10 bg-white/8 px-4 py-3.5">
              <div className="text-sm font-black">جلسة محمية</div>
              <p className="mt-1 text-[0.84rem] leading-7 text-white/74">الدخول مرتبط بحساب الشركة نفسه وبصلاحياته التشغيلية فقط.</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/8 px-4 py-3.5">
              <div className="text-sm font-black">متابعة مباشرة</div>
              <p className="mt-1 text-[0.84rem] leading-7 text-white/74">راجع الوظائف المنشورة والمتقدمين من نفس الواجهة بدون خطوات إضافية.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
