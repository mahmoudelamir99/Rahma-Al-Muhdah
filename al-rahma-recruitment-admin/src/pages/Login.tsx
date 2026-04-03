import { motion } from 'framer-motion';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminButton, AdminField, AdminInput } from '../components/ui/admin-kit';
import { cleanAdminText } from '../lib/admin-dashboard';
import { SITE_METADATA } from '../lib/admin-data';
import { useAdmin } from '../lib/admin-store';

const LOGIN_BACKGROUND_PATH = '/admin-login-bg.jpg';
const DEFAULT_ADMIN_NAME = 'محمود';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isSetupRequired, login, setupPrimaryAdmin } = useAdmin();
  const [displayName, setDisplayName] = useState(DEFAULT_ADMIN_NAME);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    const result = isSetupRequired
      ? await setupPrimaryAdmin(displayName.trim() || DEFAULT_ADMIN_NAME, email.trim(), password)
      : await login(email.trim(), password, remember);

    setBusy(false);

    if (!result.ok) {
      setError(cleanAdminText(result.message));
      return;
    }

    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#f4f7fb_0%,#e9eef5_100%)] px-4 py-6">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.08]"
        style={{ backgroundImage: `url('${LOGIN_BACKGROUND_PATH}')` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(18,34,62,0.1),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(184,143,71,0.12),transparent_24%)]" />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-[1] w-full max-w-[27rem] rounded-[1.8rem] border border-[rgba(24,37,63,0.08)] bg-white/96 p-5 shadow-[0_24px_60px_rgba(18,30,54,0.12)] backdrop-blur sm:p-6"
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#fffaf0_0%,#f6edd7_100%)] shadow-sm">
            <img src={SITE_METADATA.logoPath} alt={SITE_METADATA.name} className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#10213d]">{SITE_METADATA.name}</h1>
            <p className="mt-0.5 text-xs font-semibold text-[#708298]">لوحة الإدارة</p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-[1.1rem] border border-[#efc7c7] bg-[#fff4f4] px-4 py-3 text-sm font-bold leading-7 text-[#b44949]">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSetupRequired ? (
            <AdminField label="اسم الأدمن الرئيسي" required>
              <div className="relative">
                <UserRound className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8393a6]" size={16} />
                <AdminInput
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="pr-10 pl-4 py-2 text-sm"
                  placeholder="الاسم"
                />
              </div>
            </AdminField>
          ) : null}

          <AdminField label="البريد الإلكتروني" required>
            <div className="relative">
              <Mail className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8393a6]" size={16} />
              <AdminInput
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pr-10 pl-4 py-2 text-sm"
                dir="ltr"
                type="email"
                placeholder="admin@example.com"
              />
            </div>
          </AdminField>

          <AdminField label="كلمة المرور" required>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8393a6]" size={16} />
              <AdminInput
                autoComplete={isSetupRequired ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-10 pl-[3.5rem] py-2 text-sm"
                dir="ltr"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
              />
              <span className="pointer-events-none absolute bottom-2 left-[2.8rem] top-2 w-px bg-[rgba(131,147,166,0.18)]" />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-[rgba(24,37,63,0.08)] bg-[#f8fafc] text-[#687b91] transition hover:border-[rgba(24,37,63,0.14)] hover:bg-white hover:text-[#10213d]"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </AdminField>

          <AdminButton className="mt-2 h-10 w-full text-sm font-bold" type="submit" disabled={busy}>
            {busy ? 'جارٍ التحقق...' : isSetupRequired ? 'إنشاء الحساب والدخول' : 'دخول لوحة التحكم'}
          </AdminButton>
        </form>
      </motion.section>
    </div>
  );
}
