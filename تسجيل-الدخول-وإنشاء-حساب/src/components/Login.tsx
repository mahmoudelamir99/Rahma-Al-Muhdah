import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, LoaderCircle, Mail } from 'lucide-react';
import { loginCompany } from '../lib/company-auth';
import { buildSiteUrl, sanitizeRedirectTarget } from '../lib/navigation';
import PortalShell from './PortalShell';

interface LoginProps {
  onNavigate: (page: 'login' | 'register' | 'forgot-password') => void;
  redirectTo?: string;
}

function StatusMessage({
  tone,
  message,
}: {
  tone: 'success' | 'error';
  message: string;
}) {
  return <div className={`portal-status portal-status--${tone}`}>{message}</div>;
}

export default function Login({ onNavigate, redirectTo }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextTarget = sanitizeRedirectTarget(redirectTo, 'company-dashboard.html');

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
        window.setTimeout(() => {
          window.location.href = buildSiteUrl(nextTarget, 'company-dashboard.html');
        }, 280);
      }
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'تعذر تسجيل الدخول الآن. حاول مرة أخرى بعد قليل.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalShell
      screenLabel="بوابة الشركات"
      badge="تسجيل الدخول"
      title="مرحبًا بعودتك"
      description="سجّل الدخول لإدارة وظائفك والوصول إلى أفضل الكفاءات."
      sideLabel="لوحة الشركة"
      sideTitle="كل ما تحتاجه لإدارة التوظيف في مكان واحد."
      sideDescription="بعد تسجيل الدخول يمكنك متابعة الوظائف المنشورة، مراجعة الطلبات، وتحديث ملف شركتك بسهولة."
      sideHighlights={[
        {
          title: 'الوظائف',
          description: 'راجع الوظائف المنشورة وحدد ما تريد تحديثه أو متابعته من اللوحة مباشرة.',
        },
        {
          title: 'الطلبات',
          description: 'تابع الطلبات الجديدة واعرف حالة كل متقدم أولًا بأول.',
        },
        {
          title: 'ملف الشركة',
          description: 'حدّث بيانات شركتك وروابط التواصل من نفس الحساب بدون خطوات إضافية.',
        },
      ]}
      status={status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
      footer={
        <div className="portal-note">
          ليس لديك حساب شركة حتى الآن؟{' '}
          <button type="button" onClick={() => onNavigate('register')} className="portal-inline-link">
            أنشئ حسابًا جديدًا
          </button>
        </div>
      }
    >
      <form className="portal-form" onSubmit={handleSubmit}>
        <label className="portal-label">
          <span className="portal-label-text">البريد الإلكتروني</span>
          <div className="portal-control-wrap">
            <span className="portal-field-icon">
              <Mail className="h-4 w-4" />
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              className="portal-input portal-input--with-right"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>

        <label className="portal-label">
          <span className="portal-label-text">كلمة المرور</span>
          <div className="portal-control-wrap">
            <span className="portal-field-icon">
              <KeyRound className="h-4 w-4" />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              className="portal-input portal-input--with-right portal-input--with-left"
              placeholder="أدخل كلمة المرور"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="portal-field-action"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <div className="portal-switch-row">
          <label className="portal-checkbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            تذكر هذا الجهاز
          </label>

          <button
            type="button"
            className="portal-inline-link portal-inline-link--accent"
            onClick={() => onNavigate('forgot-password')}
          >
            نسيت كلمة المرور؟
          </button>
        </div>

        <button type="submit" disabled={isSubmitting} className="portal-submit">
          {isSubmitting ? <LoaderCircle className="portal-spinner h-5 w-5" /> : null}
          {isSubmitting ? 'جارٍ التحقق من البيانات...' : 'دخول لوحة الشركة'}
        </button>
      </form>
    </PortalShell>
  );
}
