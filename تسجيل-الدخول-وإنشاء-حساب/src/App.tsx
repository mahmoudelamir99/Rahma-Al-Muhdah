import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import ForgotPassword from './components/ForgotPassword';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import CheckEmail from './components/CheckEmail';
import { bootstrapCompanySession, hasCompanyPasswordRecoveryPending } from './lib/company-auth';
import { buildSiteUrl, sanitizeRedirectTarget } from './lib/navigation';

type PortalView = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'check-email';

function getInitialView(searchParams: URLSearchParams): PortalView {
  const view = searchParams.get('view');
  if (view === 'register' || view === 'forgot-password' || view === 'reset-password' || view === 'check-email') {
    return view;
  }

  if (hasCompanyPasswordRecoveryPending()) {
    return 'reset-password';
  }

  return 'login';
}

export default function App() {
  const searchParams = useMemo(
    () => (typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)),
    [],
  );

  const [currentPage, setCurrentPage] = useState<PortalView>(() => getInitialView(searchParams));
  const [bootstrapped, setBootstrapped] = useState(false);
  const redirectTarget = sanitizeRedirectTarget(searchParams.get('redirect'), 'company-dashboard.html');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    if (currentPage === 'login') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', currentPage);
    }

    window.history.replaceState({}, '', url.toString());
  }, [currentPage]);

  useEffect(() => {
    if (currentPage === 'forgot-password' || currentPage === 'reset-password' || currentPage === 'check-email') {
      setBootstrapped(true);
      return;
    }

    let active = true;
    setBootstrapped(false);

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
      <div className="portal-loading">
        <div className="portal-loading-card">
          <LoaderCircle className="portal-spinner h-8 w-8" />
          <div className="portal-loading-title">جارٍ تجهيز بوابة الشركات</div>
          <p className="portal-loading-text">لحظات بسيطة ويتم توجيهك إلى الشاشة المناسبة.</p>
        </div>
      </div>
    );
  }

  if (currentPage === 'login') {
    return <Login onNavigate={setCurrentPage} redirectTo={redirectTarget} />;
  }

  if (currentPage === 'forgot-password') {
    return <ForgotPassword onNavigate={setCurrentPage} />;
  }

  if (currentPage === 'reset-password') {
    return <ResetPassword onNavigate={setCurrentPage} />;
  }

  if (currentPage === 'check-email') {
    return <CheckEmail onNavigate={setCurrentPage} redirectTo={redirectTarget} />;
  }

  return <Register onNavigate={setCurrentPage} redirectTo={redirectTarget} />;
}
