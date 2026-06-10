'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Layers,
  BookUser,
  CalendarCheck2,
  Users,
  Bell,
  BarChart3,
  Settings2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { staggerContainer, staggerItem, slideLeft } from '@/lib/animations';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { useLogoutMutation } from '@/services/authApi';
import { useGetNotificationsQuery } from '@/services/notificationsApi';

const navItems = [
  { label: 'Dashboard',     href: '/dashboard',               adminOnly: false, icon: LayoutDashboard },
  { label: 'All Bookings',  href: '/dashboard/all-bookings',  adminOnly: false, icon: Layers },
  { label: 'My Bookings',   href: '/dashboard/my-bookings',   adminOnly: false, icon: BookUser },
  { label: 'Attendance',    href: '/dashboard/attendance',    adminOnly: true,  icon: CalendarCheck2 },
  { label: 'Agents',        href: '/dashboard/agents',        adminOnly: true,  icon: Users },
  { label: 'Notifications', href: '/dashboard/notifications', adminOnly: false, icon: Bell },
  { label: 'Reports',       href: '/dashboard/reports',       adminOnly: true,  icon: BarChart3 },
  { label: 'Settings',      href: '/dashboard/settings',      adminOnly: true,  icon: Settings2 },
];

export default function Sidebar({
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname  = usePathname();
  const router    = useRouter();
  const dispatch  = useAppDispatch();
  const user      = useAppSelector(state => state.auth.user);
  const [logoutApi] = useLogoutMutation();
  const { data: notifData } = useGetNotificationsQuery(undefined, { pollingInterval: 60_000 });
  const unreadCount = notifData?.unread_count ?? 0;
  const badgeLabel  = unreadCount >= 50 ? '50+' : String(unreadCount);

  const handleLogout = async () => {
    try { await logoutApi().unwrap(); } catch { /* ignore */ }
    dispatch(logout());
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      variants={slideLeft}
      initial="hidden"
      animate="visible"
      className={`${collapsed ? 'w-16' : 'w-56'} h-full min-h-screen bg-white flex flex-col shadow-[2px_0_12px_0_rgba(0,0,0,0.07)] transition-[width] duration-300 overflow-hidden`}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className={`h-14 flex items-center justify-between shadow-[0_2px_8px_0_rgba(0,0,0,0.06)] z-10 relative ${collapsed ? 'px-[6px]' : 'px-4'} transition-[padding] duration-300`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className={`${collapsed ? 'w-7 h-7' : 'w-9 h-9'} flex-shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 transition-all duration-300`}
          >
            <svg className={`${collapsed ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-white transition-all duration-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="12" y1="11" x2="12" y2="4" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
              <line x1="12" y1="11" x2="4.5" y2="18.5" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
              <line x1="12" y1="11" x2="19.5" y2="18.5" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
              <circle cx="12" cy="3.5" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="4" cy="19.5" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="20" cy="19.5" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="12" cy="11" r="2.2" fill="currentColor" stroke="none" opacity="0.5" />
            </svg>
          </motion.div>

          <AnimatePresence>
            {!collapsed && (
              <motion.p
                key="nexus-label"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="font-bold text-gray-900 text-sm leading-tight tracking-tight whitespace-nowrap"
              >
                Nexus
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse toggle */}
        {onToggleCollapse && (
          <motion.button
            onClick={onToggleCollapse}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.88 }}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <PanelLeftOpen size={15} strokeWidth={1.8} />
              : <PanelLeftClose size={15} strokeWidth={1.8} />
            }
          </motion.button>
        )}
      </motion.div>

      {/* Nav */}
      <motion.nav
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className={`flex-1 pt-4 pb-1 ${collapsed ? 'px-1.5' : 'px-3'} space-y-0.5 transition-[padding] duration-300`}
      >
        {navItems.filter(item => !item.adminOnly || user?.role !== 'agent').map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <motion.div key={item.href} variants={staggerItem}>
              <Link
                href={item.href}
                onClick={onClose}
                className="no-underline"
                title={collapsed ? item.label : undefined}
              >
                <motion.div
                  whileHover={{ x: collapsed ? 0 : 3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700'
                      : 'text-gray-800 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-r-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}

                  <span className={`relative flex-shrink-0 ${active ? 'text-indigo-600' : 'text-gray-500'}`}>
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                    {item.label === 'Notifications' && unreadCount > 0 && collapsed && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </span>

                  {!collapsed && (
                    <>
                      {item.label}
                      {item.label === 'Notifications' && unreadCount > 0 && (
                        <motion.span
                          key={unreadCount}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500 }}
                          className="ml-auto min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                        >
                          {badgeLabel}
                        </motion.span>
                      )}
                    </>
                  )}
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      {/* User + Logout */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className={`${collapsed ? 'px-1.5' : 'px-3'} pb-5 pt-4 space-y-1 shadow-[0_-2px_8px_0_rgba(0,0,0,0.06)] relative z-10 transition-[padding] duration-300`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2 mb-1`}>
          <div className="w-7 h-7 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow">
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{user?.name ?? '—'}</p>
              <p className="text-[10px] text-gray-700 truncate capitalize">{user?.role ?? ''}</p>
            </div>
          )}
        </div>

        <motion.button
          onClick={() => { handleLogout(); onClose?.(); }}
          whileHover={{ x: collapsed ? 0 : 3 }}
          whileTap={{ scale: 0.97 }}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer`}
        >
          <LogOut size={17} strokeWidth={1.8} className="flex-shrink-0" />
          {!collapsed && 'Logout'}
        </motion.button>
      </motion.div>
    </motion.aside>
  );
}
