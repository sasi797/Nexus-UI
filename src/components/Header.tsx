'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import {
  useGetNotificationsQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
  NotificationItem,
} from '@/services/notificationsApi';

const PATH_TITLES: { match: (p: string) => boolean; title: string }[] = [
  { match: p => /^\/dashboard\/my-bookings\/.+/.test(p), title: 'Booking Detail' },
  { match: p => p.startsWith('/dashboard/my-bookings'),   title: 'My Bookings' },
  { match: p => p.startsWith('/dashboard/all-bookings'),  title: 'All Bookings' },
  { match: p => p.startsWith('/dashboard/attendance'),    title: 'Attendance' },
  { match: p => p.startsWith('/dashboard/allocations'),   title: 'Allocations' },
  { match: p => p.startsWith('/dashboard/agents'),        title: 'Agents' },
  { match: p => p.startsWith('/dashboard/notifications'), title: 'Notifications' },
  { match: p => p.startsWith('/dashboard/reports'),       title: 'Reports' },
  { match: p => p.startsWith('/dashboard/settings'),      title: 'Settings' },
  { match: p => p === '/dashboard',                       title: 'Dashboard' },
];

const TYPE_ICON: Record<string, { bg: string; icon: string }> = {
  booking_created: { bg: 'bg-indigo-100',  icon: '📥' },
  booking_assigned:{ bg: 'bg-blue-100',    icon: '👤' },
  booking_completed:{ bg: 'bg-emerald-100', icon: '✅' },
  status_changed:  { bg: 'bg-amber-100',   icon: '🔄' },
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Header() {
  const user = useAppSelector(state => state.auth.user);
  const pathname = usePathname();
  const title = PATH_TITLES.find(t => t.match(pathname))?.title ?? 'Dashboard';

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useGetNotificationsQuery(undefined, { pollingInterval: 30_000 });
  const [markRead] = useMarkReadMutation();
  const [markAllRead] = useMarkAllReadMutation();

  const unread = data?.unread_count ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleClick = async (n: NotificationItem) => {
    if (!n.is_read) await markRead(n.id);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="h-14 bg-white/80 backdrop-blur-md border-b border-gray-200/70 flex items-center justify-between px-6 sticky top-0 z-10"
    >
      <div className="flex items-center">
        <h1 className="text-[15px] font-bold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-2">

        {/* Bell + dropdown */}
        <div ref={ref} className="relative">
          <motion.button
            onClick={() => setOpen(v => !v)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            className={`relative p-2 rounded-xl transition-colors ${open ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  key={unread}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                  className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white leading-none"
                >
                  {unread > 99 ? '99+' : unread}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">Notifications</span>
                    {unread > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                        {unread} new
                      </span>
                    )}
                  </div>
                  {unread > 0 && (
                    <button
                      onClick={() => markAllRead()}
                      className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {items.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-2xl mb-1">🔔</p>
                      <p className="text-xs font-medium text-gray-400">No notifications yet</p>
                    </div>
                  ) : (
                    items.slice(0, 10).map(n => {
                      const cfg = TYPE_ICON[n.type] ?? { bg: 'bg-gray-100', icon: '📌' };
                      return (
                        <button
                          key={n.id}
                          onClick={() => handleClick(n)}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${n.is_read ? 'hover:bg-gray-50' : 'bg-indigo-50/60 hover:bg-indigo-50'}`}
                        >
                          <span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-sm ${cfg.bg}`}>
                            {cfg.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12.5px] leading-snug ${n.is_read ? 'text-gray-600 font-medium' : 'text-gray-900 font-semibold'}`}>
                              {n.title}
                            </p>
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">{n.body}</p>
                            <p className="text-[10px] text-gray-300 mt-0.5">{timeAgo(n.created_at)}</p>
                          </div>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-4 py-2.5">
                  <a
                    href="/dashboard/notifications"
                    onClick={() => setOpen(false)}
                    className="block text-center text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    View all notifications
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.93 }}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-200"
        >
          {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </motion.button>
      </div>
    </motion.header>
  );
}
