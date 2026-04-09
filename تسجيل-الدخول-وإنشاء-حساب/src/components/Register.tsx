import React, { useState } from 'react';
import {
  Building2,
  Eye,
  EyeOff,
  Globe2,
  Landmark,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Users,
} from 'lucide-react';
import { registerCompany } from '../lib/company-auth';
import { buildSiteUrl, sanitizeRedirectTarget } from '../lib/navigation';
import PhoneInput, { PHONE_COUNTRIES } from './PhoneInput';
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
  const [country, setCountry] = useState(PHONE_COUNTRIES[0]?.name || 'مصر');
  const [companyCity, setCompanyCity] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [phone, setPhone] = useState('');
  const [landline, setLandline] = useState('');
  const [countryCode, setCountryCode] = useState(PHONE_COUNTRIES[0]?.code || '+20');
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
      const normalizedPhone = phone.trim() ? `${countryCode}${phone}`.trim() : '';
      const result = await registerCompany({
        companyName,
        companySector,
        country,
        companyCity,
        teamSize,
        phone: normalizedPhone,
        landline: landline.trim(),
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
      title="انضم إلى شبكة شركائنا"
      description="أنشئ حسابًا لشركتك وابدأ في نشر وظائفك واستقطاب المواهب اليوم."
      sideLabel="حساب شركة"
      sideTitle="ابدأ تجهيز ملف شركتك وخطة التوظيف."
      sideDescription="بعد إنشاء الحساب ستتمكن من نشر الوظائف، متابعة الطلبات، وتحديث بيانات الشركة من لوحة واحدة."
      sideHighlights={[
        {
          title: 'البيانات',
          description: 'أدخل بيانات شركتك الأساسية مرة واحدة ليتم تجهيز الملف والحساب مباشرة.',
        },
        {
          title: 'الوظائف',
          description: 'ابدأ في نشر الوظائف ومراجعة الطلبات من نفس الحساب بدون خطوات إضافية.',
        },
        {
          title: 'التواصل',
          description: 'أضف وسائل التواصل المناسبة حتى تصل المواهب إلى شركتك بسهولة.',
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
        </div>

        <div className="portal-grid portal-grid--2">
          <label className="portal-label">
            <span className="portal-label-text">الدولة</span>
            <div className="portal-control-wrap">
              <span className="portal-field-icon">
                <Globe2 className="h-4 w-4" />
              </span>
              <select
                required
                className="portal-select portal-input--with-right"
                value={country}
                onChange={(event) => {
                  const nextCountry = event.target.value;
                  setCountry(nextCountry);
                  const matchedCountry = PHONE_COUNTRIES.find((entry) => entry.name === nextCountry);
                  if (matchedCountry) {
                    setCountryCode(matchedCountry.code);
                  }
                }}
              >
                {PHONE_COUNTRIES.map((entry) => (
                  <option key={entry.code} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </select>
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
        </div>

        <div className="portal-grid portal-grid--2">
          <label className="portal-label">
            <span className="portal-label-text">حجم الفريق</span>
            <div className="portal-control-wrap">
              <span className="portal-field-icon">
                <Users className="h-4 w-4" />
              </span>
              <input
                required
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                className="portal-input portal-input--with-right"
                placeholder="مثال: 35"
                value={teamSize}
                onChange={(event) => setTeamSize(event.target.value.replace(/[^\d]/g, ''))}
              />
            </div>
          </label>

          <label className="portal-label">
            <span className="portal-label-text">رقم الموبايل (اختياري)</span>
            <PhoneInput
              value={phone}
              onChange={(value) => setPhone(value)}
              countryCode={countryCode}
              onCountryCodeChange={(value) => setCountryCode(value)}
            />
          </label>
        </div>

        <div className="portal-grid portal-grid--2">
          <label className="portal-label">
            <span className="portal-label-text">الرقم الأرضي (اختياري)</span>
            <div className="portal-control-wrap">
              <span className="portal-field-icon">
                <Phone className="h-4 w-4" />
              </span>
              <input
                type="tel"
                autoComplete="tel"
                className="portal-input portal-input--with-right"
                placeholder="مثال: 0231234567"
                value={landline}
                onChange={(event) => setLandline(event.target.value.replace(/[^\d+()\s-]/g, ''))}
              />
            </div>
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
