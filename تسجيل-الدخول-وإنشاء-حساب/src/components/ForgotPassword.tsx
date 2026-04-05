import React, { useState } from 'react';
import { LoaderCircle, Mail } from 'lucide-react';
import { requestCompanyPasswordReset } from '../lib/company-auth';
import PortalShell from './PortalShell';

interface ForgotPasswordProps {
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

export default function ForgotPassword({ onNavigate }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        message: error instanceof Error ? error.message : 'تعذر تنفيذ الطلب الآن. حاول مرة أخرى بعد قليل.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalShell
      screenLabel="استعادة كلمة المرور"
      badge="إرسال رابط الاستعادة"
      title="أعد الوصول إلى حساب شركتك بخطوة واضحة وآمنة."
      description="اكتب البريد الإلكتروني المسجل في حساب الشركة، وسنرسل لك رسالة رسمية تحتوي على رابط آمن لتعيين كلمة مرور جديدة."
      sideLabel="استعادة مدروسة"
      sideTitle="المسار واضح من أول الطلب حتى العودة لتسجيل الدخول."
      sideDescription="أظهرنا خطوة الاستعادة بشكل بسيط: اكتب البريد، انتظر الرسالة، ثم عيّن كلمة مرور جديدة وارجع مباشرة إلى اللوحة."
      sideHighlights={[
        {
          title: 'طلب واحد واضح',
          description: 'لن تحتاج أكثر من البريد الإلكتروني المرتبط بحساب الشركة.',
        },
        {
          title: 'رسالة رسمية',
          description: 'إذا كان البريد مسجلًا ستصلك رسالة تحتوي على رابط الاستعادة الآمن.',
        },
        {
          title: 'عودة مباشرة',
          description: 'بعد تعيين كلمة المرور الجديدة يمكنك الرجوع لتسجيل الدخول فورًا.',
        },
      ]}
      status={status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
      footer={
        <div className="portal-note">
          تذكرت كلمة المرور؟{' '}
          <button type="button" onClick={() => onNavigate('login')} className="portal-inline-link">
            العودة لتسجيل الدخول
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

        <button type="submit" disabled={isSubmitting} className="portal-submit">
          {isSubmitting ? <LoaderCircle className="portal-spinner h-5 w-5" /> : null}
          {isSubmitting ? 'جارٍ إرسال الرابط...' : 'إرسال رابط الاستعادة'}
        </button>
      </form>
    </PortalShell>
  );
}
