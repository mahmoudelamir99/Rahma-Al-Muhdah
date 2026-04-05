import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { requestCompanyPasswordReset } from '../lib/company-auth';
import { buildSiteUrl } from '../lib/navigation';

const SITE_NAME = 'الرحمة المهداه للتوظيف';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const loginParams = new URLSearchParams(searchParams);
  loginParams.set('view', 'login');
  const loginHref = `?${loginParams.toString()}`;
  const siteHref = buildSiteUrl('index.html');
  const logoHref = '/logo-mark.png';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await requestCompanyPasswordReset(email);
      setStatus({
        tone: result.ok ? 'success' : 'error',
        message: result.message,
      });
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'تعذر تنفيذ الطلب الآن.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f5ef_0%,#eef6f6_100%)] px-3 py-4 sm:px-4 sm:py-5">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-[31rem] rounded-[26px] border border-[#d6e5e7] bg-[rgba(248,245,239,0.95)] p-4 shadow-[0_24px_60px_rgba(15,61,76,0.12)] backdrop-blur sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <a
            href={siteHref}
            className="inline-flex items-center gap-2 rounded-full border border-[#d7e6e8] bg-white px-3.5 py-2 text-[0.78rem] font-extrabold text-[#0f3d4c] transition hover:-translate-y-0.5 hover:border-[#1f6b7a]/30 hover:bg-[#eef6f6]"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للموقع
          </a>

          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white p-2.5 shadow-[0_16px_28px_rgba(15,61,76,0.14)]">
            <img src={logoHref} alt={SITE_NAME} className="h-full w-full object-contain" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c79d] bg-[#f5ecda] px-3.5 py-2 text-[0.76rem] font-black text-[#8b6a2f]">
          <ShieldCheck className="h-4 w-4" />
          استعادة كلمة المرور
        </div>

        <div className="mt-4 space-y-2">
          <h1 className="text-[1.72rem] font-black tracking-[-0.05em] text-[#0f3d4c]">أعد الوصول إلى حساب شركتك بسرعة.</h1>
          <p className="text-[0.92rem] leading-7 text-[#5f7b82]">
            اكتب البريد الإلكتروني المسجل في حساب الشركة، وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور.
          </p>
        </div>

        <div className="mt-3 text-sm text-[#667b80]">
          <a href={loginHref} className="font-black text-[#0f3d4c] transition hover:text-[#c7a76c]">
            العودة لتسجيل الدخول
          </a>
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#0f3d4c,#1f6b7a)] px-5 text-[0.94rem] font-black text-white shadow-[0_18px_30px_rgba(15,61,76,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_36px_rgba(15,61,76,0.22)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
            {isSubmitting ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
