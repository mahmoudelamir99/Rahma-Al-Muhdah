import React, { useEffect, useState } from 'react';
import ForgotPassword from './components/ForgotPassword';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import { bootstrapCompanySession, hasCompanyPasswordRecoveryPending } from './lib/company-auth';
import { buildSiteUrl, sanitizeRedirectTarget } from './lib/navigation';

export default function App() {
  const searchParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [currentPage, setCurrentPage] = useState<'login' | 'register' | 'forgot-password' | 'reset-password'>(() => {
    const view = searchParams.get('view');
    if (view === 'register' || view === 'forgot-password' || view === 'reset-password') {
      return view;
    }

    if (hasCompanyPasswordRecoveryPending()) {
      return 'reset-password';
    }

    return 'login';
  });
  const [bootstrapped, setBootstrapped] = useState(false);
  const redirectTarget = sanitizeRedirectTarget(searchParams.get('redirect'), 'company-dashboard.html');

  useEffect(() => {
    if (currentPage === 'forgot-password' || currentPage === 'reset-password') {
      setBootstrapped(true);
      return;
    }

    let active = true;

    void (async () => {
      const session = await bootstrapCompanySession();
      if (!active) return;

      if (session?.loggedIn && session.role === 'company') {
        window.location.replace(buildSiteUrl(redirectTarget, 'company-dashboard.html'));
        return;
      }

      setBootstrapped(true);
    })();

    return () => {
      active = false;
    };
  }, [currentPage, redirectTarget]);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f5ef_0%,#eef6f6_100%)] px-4 text-center text-sm font-bold text-[#46636a]">
        جارٍ تجهيز بوابة الشركات...
      </div>
    );
  }

  return (
    <>
      {currentPage === 'login' ? (
        <Login onNavigate={setCurrentPage} redirectTo={redirectTarget} />
      ) : currentPage === 'forgot-password' ? (
        <ForgotPassword />
      ) : currentPage === 'reset-password' ? (
        <ResetPassword />
      ) : (
        <Register onNavigate={setCurrentPage} redirectTo={redirectTarget} />
      )}
    </>
  );
}
