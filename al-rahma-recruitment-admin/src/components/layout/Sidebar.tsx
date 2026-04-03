import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { SITE_METADATA } from '../../lib/admin-data';
import { cleanAdminText } from '../../lib/admin-dashboard';
import { ADMIN_NAV_ITEMS } from '../../lib/admin-navigation';
import { cn } from '../../lib/utils';
import { useAdmin } from '../../lib/admin-store';

type SidebarProps = {
  onCloseMobile: () => void;
};

export default function Sidebar({ onCloseMobile }: SidebarProps) {
  const { currentAdmin, currentRole, logout, hasPermission } = useAdmin();
  const visibleItems = ADMIN_NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <aside className="flex h-full w-[17.5rem] flex-col border-l border-[rgba(88,113,145,0.14)] bg-[linear-gradient(180deg,#eef3f8_0%,#e8eef5_100%)] text-[#17304f] shadow-[-10px_0_28px_rgba(34,55,86,0.07)] lg:w-[19rem] xl:w-[19.5rem]">
      <div className="border-b border-[rgba(88,113,145,0.12)] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-white shadow-[0_10px_22px_rgba(34,55,86,0.08)] ring-1 ring-[rgba(60,89,121,0.08)]">
            <img src={SITE_METADATA.logoPath} alt={SITE_METADATA.name} className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.96rem] font-black leading-6 text-[#102745]">{SITE_METADATA.name}</p>
            <p className="mt-0.5 text-[0.73rem] font-semibold text-[#607890]">لوحة الإدارة التنفيذية</p>
          </div>
        </div>
      </div>

      <div className="border-b border-[rgba(88,113,145,0.12)] px-4 py-3">
        <p className="text-[0.93rem] font-black text-[#112847]">{cleanAdminText(currentAdmin?.displayName || 'مدير النظام')}</p>
        <p className="mt-1 text-[0.74rem] text-[#5d7590]">{cleanAdminText(currentRole?.name || 'إدارة المنصة')}</p>
      </div>

      <nav className="rm-scrollbar flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-1.5">
          {visibleItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
            >
              <NavLink
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-[0.87rem] transition',
                    isActive
                      ? 'bg-white text-[#0f2746] shadow-[0_12px_24px_rgba(34,55,86,0.1)]'
                      : 'text-[#31506f] hover:bg-white/72 hover:text-[#143050]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border transition',
                        isActive
                          ? 'border-[rgba(66,95,126,0.16)] bg-[#eff5fb] text-[#143152]'
                          : 'border-[rgba(66,95,126,0.1)] bg-white/55 text-[#53708d] group-hover:text-[#143152]',
                      )}
                    >
                      <item.icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold leading-6">{item.name}</div>
                      <div className="text-[0.7rem] leading-[1.5] text-[#6a8198]">{item.summary}</div>
                    </div>
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
        </div>
      </nav>

      <div className="border-t border-[rgba(88,113,145,0.12)] px-3 py-3">
        <button
          type="button"
          onClick={() => {
            logout();
            onCloseMobile();
          }}
          className="flex w-full items-center gap-3 rounded-[1rem] px-3 py-2.5 text-[0.87rem] font-bold text-[#31506f] transition hover:bg-white/72 hover:text-[#143050]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border border-[rgba(66,95,126,0.1)] bg-white/55">
            <LogOut size={18} />
          </span>
          <span>تسجيل خروج</span>
        </button>
      </div>
    </aside>
  );
}
