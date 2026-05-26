'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, slideLeft } from '@/lib/animations';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { useLogoutMutation } from '@/services/authApi';
import { useGetNotificationsQuery } from '@/services/notificationsApi';

const navItems = [
  {
    label: 'Dashboard', href: '/dashboard', adminOnly: false,
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    label: 'All Bookings', href: '/dashboard/all-bookings', adminOnly: false,
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  },
  {
    label: 'My Bookings', href: '/dashboard/my-bookings', adminOnly: false,
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  },
  {
    label: 'Attendance', href: '/dashboard/attendance', adminOnly: true,
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    label: 'Allocations', href: '/dashboard/allocations', adminOnly: true,
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>,
  },
  {
    label: 'Agents', href: '/dashboard/agents', adminOnly: true,
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    label: 'Notifications', href: '/dashboard/notifications', adminOnly: false,
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  },
  {
    label: 'Reports', href: '/dashboard/reports', adminOnly: true,
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    label: 'Settings', href: '/dashboard/settings', adminOnly: true,
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const [logoutApi] = useLogoutMutation();
  const { data: notifData } = useGetNotificationsQuery(undefined, { pollingInterval: 30_000 });
  const unreadCount = notifData?.unread_count ?? 0;
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const handleLogout = async () => {
    try { await logoutApi().unwrap(); } catch { /* ignore */ }
    dispatch(logout());
    router.push('/login');
  };

  const isActive = (href: string) => href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <motion.aside
      variants={slideLeft}
      initial="hidden"
      animate="visible"
      className="w-56 min-h-screen bg-white border-r border-gray-200/70 flex flex-col shadow-sm"
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="px-5 py-5 border-b border-gray-100"
      >
        <div className="flex items-center gap-2.5">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {/* Nexus hub: 3 nodes connected at a central point */}
              <line x1="12" y1="11" x2="12" y2="4" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
              <line x1="12" y1="11" x2="4.5" y2="18.5" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
              <line x1="12" y1="11" x2="19.5" y2="18.5" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
              <circle cx="12" cy="3.5" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="4" cy="19.5" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="20" cy="19.5" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="12" cy="11" r="2.2" fill="currentColor" stroke="none" opacity="0.5" />
            </svg>
          </motion.div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight tracking-tight">Nexus</p>
            <p className="text-[10px] text-gray-500 font-medium">BookOps AI</p>
          </div>
        </div>
      </motion.div>

      {/* Nav */}
      <motion.nav
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex-1 py-4 px-3 space-y-0.5"
      >
        {navItems.filter(item => !item.adminOnly || user?.role !== 'agent').map((item) => {
          const active = isActive(item.href);
          return (
            <motion.div key={item.href} variants={staggerItem}>
              <Link href={item.href}>
                <motion.div
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-r-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}
                  <span className={active ? 'text-indigo-600' : 'text-gray-400'}>
                    {item.icon}
                  </span>
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
        className="px-3 pb-5 border-t border-gray-100 pt-4 space-y-1"
      >
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow">
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{user?.name ?? '—'}</p>
            <p className="text-[10px] text-gray-400 truncate capitalize">{user?.role ?? ''}</p>
          </div>
        </div>
        <motion.button
          onClick={handleLogout}
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </motion.button>
      </motion.div>
    </motion.aside>
  );
}
