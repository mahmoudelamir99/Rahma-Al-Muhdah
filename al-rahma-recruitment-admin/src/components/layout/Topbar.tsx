import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, LogOut, Menu, Search, Settings2, UserCircle2 } from 'lucide-react';
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SITE_METADATA } from '../../lib/admin-data';
import { cleanAdminText, getNotificationSummary } from '../../lib/admin-dashboard';
import { getRouteMeta } from '../../lib/admin-navigation';
import { useAdmin } from '../../lib/admin-store';
import { cn } from '../../lib/utils';
import { AdminBadge, AdminIconButton } from '../ui/admin-kit';

type TopbarProps = {
  onMenuClick: () => void;
};

const READ_NOTIFICATIONS_STORAGE_KEY = 'rahmaAdminReadNotifications.v1';

export default function Topbar({ onMenuClick }: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentAdmin, currentRole, logout, searchEverywhere, state } = useAdmin();
  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];

    try {
      const rawValue = window.localStorage.getItem(READ_NOTIFICATIONS_STORAGE_KEY);
      if (!rawValue) return [];
      const parsedValue = JSON.parse(rawValue);
      return Array.isArray(parsedValue) ? parsedValue.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });

  const routeMeta = getRouteMeta(location.pathname);
  const deferredSearch = useDeferredValue(searchValue);
  const results = useMemo(() => searchEverywhere(deferredSearch).slice(0, 6), [deferredSearch, searchEverywhere]);
  const notifications = useMemo(() => getNotificationSummary(state), [state]);

  const buildNotificationReadKey = (item: (typeof notifications.items)[number]) => `${item.id}:${item.value}:${item.path}`;

  const visibleNotifications = useMemo(
    () => notifications.items.filter((item) => !readNotifications.includes(buildNotificationReadKey(item))),
    [notifications.items, readNotifications],
  );

  const visibleNotificationsCount = useMemo(
    () => visibleNotifications.reduce((total, item) => total + item.value, 0),
    [visibleNotifications],
  );

  useEffect(() => {
    const activeNotificationKeys = new Set(notifications.items.map((item) => buildNotificationReadKey(item)));
    setReadNotifications((current) => current.filter((item) => activeNotificationKeys.has(item)));
  }, [notifications.items]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(READ_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(readNotifications));
    } catch {
      // Ignore storage errors for this lightweight UI preference.
    }
  }, [readNotifications]);

  const goTo = (path: string) => {
    startTransition(() => navigate(path));
    setSearchOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  const markNotificationAsRead = (item: (typeof notifications.items)[number]) => {
    const key = buildNotificationReadKey(item);
    setReadNotifications((current) => (current.includes(key) ? current : [...current, key]));
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(133,155,179,0.12)] bg-[rgba(255,255,255,0.92)] backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4 lg:px-5 lg:pr-[20.5rem] xl:pr-[21rem]">
        <AdminIconButton className="lg:hidden" onClick={onMenuClick} aria-label="فتح القائمة">
          <Menu size={18} />
        </AdminIconButton>

        <div className="hidden min-w-0 lg:block">
          <div className="text-[0.69rem] font-bold text-[#7a8c9f]">{SITE_METADATA.shortName}</div>
          <div className="text-sm font-black text-[#143050]">{routeMeta.name}</div>
        </div>

        <div className="relative hidden min-w-[250px] max-w-[360px] flex-1 lg:block">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8d9bad]" size={17} />
          <input
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="ابحث في الشركات أو الوظائف أو الطلبات..."
            className="rm-search-field w-full pl-12 pr-4"
          />

          <AnimatePresence>
            {searchOpen && deferredSearch.trim() ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute inset-x-0 top-[calc(100%+0.65rem)] z-50 overflow-hidden rounded-[1.2rem] border border-[rgba(113,142,172,0.14)] bg-white p-2 shadow-[0_20px_36px_rgba(34,55,86,0.12)]"
              >
                {results.length ? (
                  results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => goTo(result.path)}
                      className="flex w-full items-start justify-between gap-3 rounded-[0.95rem] px-3 py-2.5 text-right transition hover:bg-[#f4f8fc]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#122341]">{result.label}</div>
                        <div className="mt-1 truncate text-[11px] text-[#7a8b9e]">{result.meta}</div>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-[#557390]">{getRouteMeta(result.path).name}</span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[0.95rem] px-4 py-5 text-center text-sm font-bold text-[#73849a]">لا توجد نتائج مطابقة.</div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="min-w-0 flex-1 lg:hidden">
          <p className="text-[10px] font-bold text-[#8a98aa] sm:text-[11px]">{SITE_METADATA.shortName}</p>
          <h2 className="text-[0.98rem] font-black leading-6 text-[#11213d] sm:text-[1.02rem]">{routeMeta.name}</h2>
        </div>

        <div className="mr-auto flex items-center gap-2">
          <div className="relative">
            <AdminIconButton
              onClick={() => {
                setNotificationsOpen((value) => !value);
                setProfileOpen(false);
              }}
              aria-label="الإشعارات"
            >
              <Bell size={18} />
            </AdminIconButton>
            {visibleNotificationsCount ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d65b5b] px-1 text-[10px] font-black text-white">
                {visibleNotificationsCount > 99 ? '99+' : visibleNotificationsCount}
              </span>
            ) : null}

            <AnimatePresence>
              {notificationsOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 top-[calc(100%+0.65rem)] z-50 w-[18.25rem] rounded-[1.2rem] border border-[rgba(113,142,172,0.14)] bg-white p-2.5 shadow-[0_20px_36px_rgba(34,55,86,0.12)]"
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <strong className="text-sm font-black text-[#11213d]">الإشعارات</strong>
                    <AdminBadge tone="warning">{visibleNotificationsCount}</AdminBadge>
                  </div>
                  <div className="space-y-2">
                    {visibleNotifications.length ? (
                      visibleNotifications.map((item) => (
                        <div key={buildNotificationReadKey(item)} className="rounded-[1rem] bg-[#f6f8fc] px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => goTo(item.path)}
                            className="block w-full text-right transition hover:text-[#0f2a4d]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-[#122341]">{item.label}</div>
                                <div className="mt-1 text-[11px] leading-5 text-[#73849a]">{item.description}</div>
                              </div>
                              <AdminBadge tone="info" className="shrink-0">
                                {item.value}
                              </AdminBadge>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => markNotificationAsRead(item)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[rgba(113,142,172,0.16)] bg-white px-2.5 py-1 text-[11px] font-bold text-[#54718f] transition hover:border-[rgba(84,113,143,0.28)] hover:text-[#11213d]"
                          >
                            <Check size={13} />
                            اجعله مقروءًا
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1rem] bg-[#f6f8fc] px-3 py-4 text-sm font-bold text-[#73849a]">لا توجد إشعارات حالية.</div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((value) => !value);
                setNotificationsOpen(false);
              }}
              className={cn(
                'flex items-center gap-2.5 rounded-[1.15rem] border border-[rgba(113,142,172,0.14)] bg-white px-2.5 py-1.5 shadow-[0_10px_20px_rgba(34,55,86,0.05)] transition hover:border-[rgba(113,142,172,0.24)]',
              )}
            >
              <div className="hidden text-right md:block">
                <div className="text-sm font-black text-[#10213d]">{cleanAdminText(currentAdmin?.displayName || 'مدير المنصة')}</div>
                <div className="text-[10px] text-[#7b8b9e]">{cleanAdminText(currentRole?.name || 'إدارة المنصة')}</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-[linear-gradient(180deg,#eef5fb_0%,#ffffff_100%)] text-[#1a3359]">
                <UserCircle2 size={21} />
              </div>
            </button>

            <AnimatePresence>
              {profileOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 top-[calc(100%+0.65rem)] z-50 w-[15rem] rounded-[1.2rem] border border-[rgba(113,142,172,0.14)] bg-white p-2.5 shadow-[0_20px_36px_rgba(34,55,86,0.12)]"
                >
                  <button
                    type="button"
                    onClick={() => goTo('/settings')}
                    className="flex w-full items-center gap-2.5 rounded-[0.95rem] px-3 py-2.5 text-right transition hover:bg-[#f4f7fb]"
                  >
                    <Settings2 size={17} />
                    <span className="font-bold text-[#122341]">الحساب والإعدادات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="mt-2 flex w-full items-center gap-2.5 rounded-[0.95rem] px-3 py-2.5 text-right text-[#b44949] transition hover:bg-[#fff5f5]"
                  >
                    <LogOut size={17} />
                    <span className="font-bold">تسجيل خروج</span>
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
