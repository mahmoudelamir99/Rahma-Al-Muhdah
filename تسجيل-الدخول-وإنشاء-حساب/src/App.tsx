import React, { useEffect, useState } from 'react';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import Register from './components/Register';
import { buildSiteUrl, sanitizeRedirectTarget } from './lib/navigation';
import { getStoredCompanySession } from './lib/company-auth';

export default function App() {
  const searchParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [currentPage, setCurrentPage] = useState<'login' | 'register' | 'forgot-password'>(() => {
    const view = searchParams.get('view');
    if (view === 'register' || view === 'forgot-password') {
      return view;
    }
    return 'login';
  });
  const [bootstrapped, setBootstrapped] = useState(false);
  const redirectTarget = sanitizeRedirectTarget(searchParams.get('redirect'), 'company-dashboard.html');

  useEffect(() => {
    if (currentPage === 'forgot-password') {
      setBootstrapped(true);
      return;
    }

    const session = getStoredCompanySession();
    if (session?.loggedIn && session.role === 'company') {
      window.location.replace(buildSiteUrl(redirectTarget, 'company-dashboard.html'));
      return;
    }

    setBootstrapped(true);
  }, [currentPage, redirectTarget]);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1ea] px-4 text-center text-sm font-bold text-[#66768a]">
        جارٍ التحقق من الجلسة...
      </div>
    );
  }

  return (
    <>
      {currentPage === 'login' ? (
        <Login onNavigate={setCurrentPage} redirectTo={redirectTarget} />
      ) : currentPage === 'forgot-password' ? (
        <ForgotPassword />
      ) : (
        <Register onNavigate={setCurrentPage} redirectTo={redirectTarget} />
      )}
    </>
  );
}
