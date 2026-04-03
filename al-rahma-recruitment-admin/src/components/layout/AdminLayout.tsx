import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getRequiredPermissionForPath } from '../../lib/admin-navigation';
import { useAdmin } from '../../lib/admin-store';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AdminLayout() {
  const location = useLocation();
  const { isAuthenticated, hasPermission } = useAdmin();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  const requiredPermission = getRequiredPermissionForPath(location.pathname);
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(33,58,100,0.06),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(184,148,78,0.1),transparent_24%),linear-gradient(180deg,#f6f8fb_0%,#eef3f7_100%)] text-[#11213d]">
      <AnimatePresence>
        {mobileSidebarOpen ? (
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-[rgba(8,16,31,0.42)] backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="إغلاق القائمة"
          />
        ) : null}
      </AnimatePresence>

      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 right-0 z-30 hidden lg:block">
          <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
        </aside>

        <AnimatePresence>
          {mobileSidebarOpen ? (
            <motion.aside
              initial={{ x: 70, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 70, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="fixed inset-y-0 right-0 z-50 lg:hidden"
            >
              <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
            </motion.aside>
          ) : null}
        </AnimatePresence>

        <div className="min-w-0 flex-1">
          <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />

          <main className="px-3 py-3.5 sm:px-4 lg:px-5 lg:py-4 lg:pr-[20.5rem] xl:pr-[21rem]">
            <div className="mx-auto flex w-full max-w-[1460px] flex-col gap-3.5">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
