import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
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
      const nextTarget = sanitizeRedirectTarget(redirectTo, 'company-dashboard.html');
      window.setTimeout(() => {
        window.location.href = buildSiteUrl(nextTarget, 'company-dashboard.html');
      }, 350);
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
    <div className="min-h-screen bg-[#f4efe7] px-2.5 py-2.5 text-slate-900 sm:px-3.5 sm:py-3.5">
      <div className="mx-auto grid min-h-[calc(100vh-1.25rem)] max-w-[860px] gap-2.5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden rounded-[22px] bg-[#152845] p-5 text-white shadow-sm lg:flex lg:flex-col lg:items-center lg:justify-center">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[20px] bg-white/10 p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <img src={logoHref} alt={SITE_NAME} className="h-full w-full object-contain" />
            </div>
            <div className="mt-3 text-[0.82rem] font-black tracking-[0.08em] text-white/80">{SITE_NAME}</div>
            <div className="mt-2 text-[1.5rem] font-black leading-tight">تسجيل الدخول</div>
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
                  <h1 className="text-[1.02rem] font-black leading-none text-[#13233b]">تسجيل الدخول</h1>
                </div>
              </div>
            </div>

            <h1 className="mb-3.5 hidden text-[1.5rem] font-black tracking-tight text-[#13233b] lg:block">تسجيل الدخول</h1>

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

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <label className="block">
                <span className="mb-1 block text-[0.88rem] font-bold text-[#24364f]">البريد الإلكتروني</span>
                <div className="relative">
                  <span className="pointer-events-none absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f4f7fa] text-[#7d8da1]">
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

              <label className="block">
                <span className="mb-1 block text-[0.88rem] font-bold text-[#24364f]">كلمة المرور</span>
                <div className="relative">
                  <span className="pointer-events-none absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f4f7fa] text-[#7d8da1]">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="h-10 w-full rounded-[14px] border border-[#d9e0e8] bg-[#fbfcfd] py-2 pr-11 pl-11 text-[0.96rem] text-slate-900 outline-none transition focus:border-[#b88f47] focus:bg-white focus:ring-2 focus:ring-[#b88f47]/20"
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[#f4f7fa] text-[#6d7e92] transition hover:bg-[#edf2f7] hover:text-[#13233b]"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[0.84rem] font-medium text-[#5f6f81]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#cad3dd] text-[#b88f47] focus:ring-[#b88f47]"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  تذكر هذا الجهاز
                </label>

                <a href={forgotPasswordHref} className="text-[0.84rem] font-bold text-[#b88f47] transition hover:text-[#9d7532]">
                  نسيت كلمة المرور؟
                </a>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 w-full items-center justify-center rounded-[14px] bg-[#13233b] px-4 text-[0.95rem] font-black text-white shadow-sm transition hover:bg-[#0f1c30] focus:ring-2 focus:ring-[#13233b]/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'جارٍ التحقق...' : 'دخول لوحة الشركة'}
              </button>
            </form>

            <div className="mt-3 rounded-[16px] bg-[#f8f5ef] px-3 py-2.5 text-[0.9rem] text-[#66768a]">
              ليس لديك حساب شركة؟{' '}
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="font-black text-[#13233b] transition hover:text-[#b88f47]"
              >
                إنشاء حساب
              </button>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
