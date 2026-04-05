import React, { useState } from 'react';
import {
  Building2,
  Eye,
  EyeOff,
  Landmark,
  LoaderCircle,
  Mail,
  MapPin,
  Users,
} from 'lucide-react';
import { registerCompany } from '../lib/company-auth';
import { buildSiteUrl, sanitizeRedirectTarget } from '../lib/navigation';
import PhoneInput from './PhoneInput';
import PortalShell from './PortalShell';

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

function StatusMessage({
  tone,
  message,
}: {
  tone: 'success' | 'error';
  message: string;
}) {
  return <div className={`portal-status portal-status--${tone}`}>{message}</div>;
}

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
        }, 320);
      } else if (result.requiresEmailVerification) {
        window.setTimeout(() => {
          onNavigate('login');
        }, 900);
      }
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'تعذر إنشاء الحساب الآن. حاول مرة أخرى بعد قليل.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalShell
      screenLabel="فتح حساب شركة"
      badge="إنشاء حساب جديد"
      title="أنشئ ملف شركتك مرة واحدة وابدأ إدارة الوظائف من لوحة منظمة."
      description="املأ البيانات الأساسية فقط، وبعدها تنتقل مباشرة إلى لوحة الشركة لمتابعة الوظائف، مراجعة الطلبات، وتحديث معلومات المؤسسة."
      sideLabel="بدء التشغيل"
      sideTitle="واجهة أخف للشركات من أول تسجيل وحتى أول وظيفة منشورة."
      sideDescription="الحساب الجديد يجهز ملف الشركة، يربطه باللوحة، ويضع بين يديك تجربة أسرع وأوضح بدون ازدحام بصري."
      sideHighlights={[
        {
          title: 'نموذج مختصر',
          description: 'الحقول الأساسية فقط: اسم الشركة، المجال، المدينة، الهاتف، والبريد الإلكتروني.',
        },
        {
          title: 'انتقال مباشر',
          description: 'بعد نجاح التسجيل تنتقل مباشرة لمتابعة الوظائف والمتقدمين من نفس الحساب.',
        },
        {
          title: 'تجربة متجاوبة',
          description: 'التصميم مضبوط لسطح المكتب، اللابتوب، الأجهزة اللوحية، والهواتف بدون تضخم.',
        },
      ]}
      status={status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
      footer={
        <div className="portal-note">
          لديك حساب شركة بالفعل؟{' '}
          <button type="button" onClick={() => onNavigate('login')} className="portal-inline-link">
            سجّل الدخول
          </button>
        </div>
      }
    >
      <form className="portal-form" onSubmit={handleSubmit}>
        <div className="portal-grid portal-grid--2">
          <label className="portal-label">
            <span className="portal-label-text">اسم الشركة</span>
            <div className="portal-control-wrap">
              <span className="portal-field-icon">
                <Building2 className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                autoComplete="organization"
                className="portal-input portal-input--with-right"
                placeholder="اسم الشركة"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </div>
          </label>

          <label className="portal-label">
            <span className="portal-label-text">مجال الشركة</span>
            <div className="portal-control-wrap">
              <span className="portal-field-icon">
                <Landmark className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                className="portal-input portal-input--with-right"
                placeholder="مثال: التوظيف أو الخدمات"
                value={companySector}
                onChange={(event) => setCompanySector(event.target.value)}
              />
            </div>
          </label>

          <label className="portal-label">
            <span className="portal-label-text">المدينة</span>
            <div className="portal-control-wrap">
              <span className="portal-field-icon">
                <MapPin className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                className="portal-input portal-input--with-right"
                placeholder="المدينة"
                value={companyCity}
                onChange={(event) => setCompanyCity(event.target.value)}
              />
            </div>
          </label>

          <label className="portal-label">
            <span className="portal-label-text">حجم الفريق</span>
            <div className="portal-control-wrap">
              <span className="portal-field-icon">
                <Users className="h-4 w-4" />
              </span>
              <select
                required
                className="portal-select portal-input--with-right"
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

        <div className="portal-grid portal-grid--2">
          <label className="portal-label">
            <span className="portal-label-text">رقم الموبايل</span>
            <PhoneInput
              value={phone}
              onChange={(value) => setPhone(value)}
              countryCode={countryCode}
              onCountryCodeChange={(value) => setCountryCode(value)}
            />
          </label>

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
        </div>

        <div className="portal-grid portal-grid--2">
          <label className="portal-label">
            <span className="portal-label-text">كلمة المرور</span>
            <div className="portal-control-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                className="portal-input portal-input--with-left"
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
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                className="portal-input portal-input--with-left"
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
        </div>

        <button type="submit" disabled={isSubmitting} className="portal-submit">
          {isSubmitting ? <LoaderCircle className="portal-spinner h-5 w-5" /> : null}
          {isSubmitting ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب الشركة'}
        </button>
      </form>
    </PortalShell>
  );
}
