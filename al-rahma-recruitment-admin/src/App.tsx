import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import { AdminLoadingBlock } from './components/ui/admin-kit';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

const Applications = lazy(() => import('./pages/Applications'));
const Companies = lazy(() => import('./pages/Companies'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Messages = lazy(() => import('./pages/Messages'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Candidates = lazy(() => import('./pages/Candidates'));

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<AdminLoadingBlock label="جارٍ تجهيز لوحة التحكم..." />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="companies" element={<Companies />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="applications" element={<Applications />} />
            <Route path="candidates" element={<Candidates />} />
            <Route path="reports" element={<Reports />} />
            <Route path="messages" element={<Messages />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="content" element={<Navigate to="/settings" replace />} />
            <Route path="roles" element={<Navigate to="/settings" replace />} />
            <Route path="security" element={<Navigate to="/settings" replace />} />
            <Route path="users" element={<Navigate to="/settings" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
