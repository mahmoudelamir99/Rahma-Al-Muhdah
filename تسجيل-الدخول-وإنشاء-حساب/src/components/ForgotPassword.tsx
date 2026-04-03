import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { requestCompanyPasswordReset } from '../lib/company-auth';
import { buildSiteUrl } from '../lib/navigation';

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
    <div className="flex min-h-screen items-center justify-center bg-[#f5f1ea] px-3 py-4 sm:px-4 sm:py-5">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-[26rem] rounded-[1.65rem] border border-[rgba(20,35,59,0.08)] bg-white/96 p-4 shadow-[0_24px_52px_rgba(21,35,57,0.12)] backdrop-blur sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <a
            href={siteHref}
            className="inline-flex items-center gap-2 rounded-full bg-[#f6f3ee] px-3 py-1.5 text-[0.82rem] font-bold text-[#5f6f81] transition hover:bg-[#efe8dc] hover:text-[#13233b]"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للموقع
          </a>

          <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[#f9f5ed] shadow-[0_12px_24px_rgba(184,143,71,0.14)]">
            <img src={logoHref} alt="الرحمة المهداه للتوظيف" className="h-8 w-8 object-contain" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfcb] bg-[#fbf7ef] px-3.5 py-1.5 text-[0.82rem] font-bold text-[#9d7532]">
          <ShieldCheck className="h-4 w-4" />
          استعادة كلمة المرور
        </div>

        <div className="mt-3 space-y-1.5">
          <h1 className="text-[1.6rem] font-black tracking-[-0.04em] text-[#13233b]">أعد الوصول إلى حساب شركتك</h1>
          <p className="text-[0.92rem] leading-6 text-[#66768a]">
            اكتب البريد الإلكتروني المسجل لحساب الشركة، وسنرسل لك رابط إعادة التعيين إلى البريد المرتبط بالحساب.
          </p>
        </div>

        <div className="mt-3 text-sm text-[#66768a]">
          <a href={loginHref} className="font-bold text-[#13233b] transition hover:text-[#b88f47]">
            العودة للدخول
          </a>
        </div>

        {status ? (
          <div
            className={`mt-4 rounded-[1.1rem] border px-3.5 py-2.5 text-sm font-bold leading-6 ${
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

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#24364f]">البريد الإلكتروني</span>
            <div className="relative">
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8a98aa]">
                <Mail className="h-5 w-5" />
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-[1rem] border border-[#d9e0e8] bg-[#fbfcfd] py-3 pr-12 pl-4 text-slate-900 outline-none transition focus:border-[#b88f47] focus:bg-white focus:ring-4 focus:ring-[#b88f47]/10"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[1rem] bg-[#13233b] px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(19,35,59,0.18)] transition hover:bg-[#0f1c30] focus:ring-4 focus:ring-[#13233b]/15 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
            {isSubmitting ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
