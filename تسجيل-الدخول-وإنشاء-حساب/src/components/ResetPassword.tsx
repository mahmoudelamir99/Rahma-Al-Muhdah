import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react';
import { resetCompanyPassword } from '../lib/company-auth';
import PortalShell from './PortalShell';

interface ResetPasswordProps {
  onNavigate: (page: 'login') => void;
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

export default function ResetPassword({ onNavigate }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (password !== confirmPassword) {
      setStatus({ tone: 'error', message: 'كلمتا المرور غير متطابقتين.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await resetCompanyPassword(password);
      setStatus({ tone: result.ok ? 'success' : 'error', message: result.message });
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'تعذر تحديث كلمة المرور الآن. حاول مرة أخرى بعد قليل.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalShell
      screenLabel="تعيين كلمة مرور جديدة"
      badge="إنهاء الاستعادة"
      title="حدّث كلمة المرور ثم ارجع مباشرة إلى تسجيل الدخول."
      description="اختر كلمة مرور قوية وآمنة، وبعد الحفظ ستتمكن من استخدام الحساب مرة أخرى على الفور."
      sideLabel="خطوة أخيرة"
      sideTitle="نفس الواجهة الهادئة، لكن بنهاية واضحة وآمنة."
      sideDescription="بعد حفظ كلمة المرور الجديدة، يكفي الرجوع إلى شاشة الدخول واستخدامها فورًا للدخول إلى لوحة الشركة."
      sideHighlights={[
        {
          title: 'كلمة مرور قوية',
          description: 'يفضل استخدام 8 أحرف أو أكثر مع مزيج من الحروف والأرقام.',
        },
        {
          title: 'تأكيد مباشر',
          description: 'نطابق كلمة المرور وتأكيدها قبل إرسال الطلب لتجنب الأخطاء.',
        },
        {
          title: 'عودة سريعة',
          description: 'بمجرد نجاح التحديث يمكنك الرجوع إلى تسجيل الدخول من نفس الصفحة.',
        },
      ]}
      status={status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
      footer={
        <div className="portal-note">
          تريد الرجوع الآن؟{' '}
          <button type="button" onClick={() => onNavigate('login')} className="portal-inline-link">
            العودة لتسجيل الدخول
          </button>
        </div>
      }
    >
      <form className="portal-form" onSubmit={handleSubmit}>
        <label className="portal-label">
          <span className="portal-label-text">كلمة المرور الجديدة</span>
          <div className="portal-control-wrap">
            <span className="portal-field-icon">
              <KeyRound className="h-4 w-4" />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              className="portal-input portal-input--with-right portal-input--with-left"
              placeholder="8 أحرف على الأقل"
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

        <label className="portal-label">
          <span className="portal-label-text">تأكيد كلمة المرور</span>
          <div className="portal-control-wrap">
            <span className="portal-field-icon">
              <KeyRound className="h-4 w-4" />
            </span>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              className="portal-input portal-input--with-right portal-input--with-left"
              placeholder="أعد كتابة كلمة المرور"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button
              type="button"
              className="portal-field-action"
              onClick={() => setShowConfirmPassword((value) => !value)}
              aria-label={showConfirmPassword ? 'إخفاء تأكيد كلمة المرور' : 'إظهار تأكيد كلمة المرور'}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <button type="submit" disabled={isSubmitting} className="portal-submit">
          {isSubmitting ? <LoaderCircle className="portal-spinner h-5 w-5" /> : null}
          {isSubmitting ? 'جارٍ حفظ كلمة المرور...' : 'حفظ كلمة المرور الجديدة'}
        </button>
      </form>
    </PortalShell>
  );
}
