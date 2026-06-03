'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition } from '@/lib/animations';
import {
  useGetNotificationsQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
  useDeleteNotificationMutation,
  NotificationItem,
} from '@/services/notificationsApi';

/* ── type config ── */
const TYPE_CFG: Record<string, { accent: string; iconBg: string; iconColor: string; icon: React.ReactNode; label: string }> = {
  booking_created: {
    accent: 'bg-indigo-500',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    label: 'New Booking',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 11v4m-2-2h4" />
      </svg>
    ),
  },
  booking_assigned: {
    accent: 'bg-blue-500',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    label: 'Assigned',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  booking_completed: {
    accent: 'bg-emerald-500',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    label: 'Completed',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  status_changed: {
    accent: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    label: 'Status Update',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
};

const DEFAULT_CFG = {
  accent: 'bg-gray-400',
  iconBg: 'bg-gray-50',
  iconColor: 'text-gray-500',
  label: 'Update',
  icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/* ── helpers ── */
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'yesterday';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function groupByDate(items: NotificationItem[]) {
  const groups: { label: string; items: NotificationItem[] }[] = [];
  const map = new Map<string, NotificationItem[]>();
  const now = new Date();
  for (const item of items) {
    const d = new Date(item.created_at);
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const key = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  map.forEach((v, k) => groups.push({ label: k, items: v }));
  return groups;
}

type Filter = 'all' | 'unread' | 'read';

/* ── Notification card ── */
function NotifCard({ n, onRead, onDelete }: { n: NotificationItem; onRead: (id: string) => void; onDelete: (id: string) => void }) {
  const cfg = TYPE_CFG[n.type] ?? DEFAULT_CFG;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.18 }}
      className={`relative flex items-start gap-4 px-5 py-4 transition-all duration-150 group
        ${n.is_read
          ? 'bg-white hover:bg-gray-50/70'
          : 'bg-gradient-to-r from-indigo-50/60 to-white hover:from-indigo-50 hover:to-white'
        }`}
    >
      {/* Left accent bar */}
      {!n.is_read && (
        <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${cfg.accent}`} />
      )}

      {/* Icon */}
      <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${cfg.iconBg} ${cfg.iconColor} mt-0.5`}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !n.is_read && onRead(n.id)}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${n.is_read ? 'text-gray-400' : cfg.iconColor}`}>
            {cfg.label}
          </span>
          {n.entity_id && (
            <span className="text-[10px] font-mono font-semibold text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded">
              {n.entity_id}
            </span>
          )}
        </div>
        <p className={`text-[13.5px] leading-snug mb-1 ${n.is_read ? 'text-gray-500 font-medium' : 'text-gray-900 font-semibold'}`}>
          {n.title}
        </p>
        <p className="text-[12px] text-gray-400 leading-relaxed line-clamp-2">{n.body}</p>
        <p className="text-[11px] text-gray-300 mt-1.5 font-medium">{timeAgo(n.created_at)}</p>
      </div>

      {/* Right: unread dot + delete */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        {!n.is_read && (
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-100 mt-1" />
        )}
        <button
          onClick={() => onDelete(n.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

/* ── Page ── */
export default function NotificationsPage() {
  const { data, isLoading } = useGetNotificationsQuery(undefined, { pollingInterval: 15_000 });
  const [markRead] = useMarkReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllReadMutation();
  const [deleteNotif] = useDeleteNotificationMutation();
  const [filter, setFilter] = useState<Filter>('all');

  const allItems = data?.items ?? [];
  const unread = data?.unread_count ?? 0;
  const total = allItems.length;
  const readCount = total - unread;

  const filtered = useMemo(() => {
    if (filter === 'unread') return allItems.filter(n => !n.is_read);
    if (filter === 'read') return allItems.filter(n => n.is_read);
    return allItems;
  }, [allItems, filter]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all',    label: 'All',    count: total },
    { key: 'unread', label: 'Unread', count: unread },
    { key: 'read',   label: 'Read',   count: readCount },
  ];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible"
      className="flex flex-col md:flex-row gap-4 md:gap-5 items-start">

      {/* ── Left Sidebar ── */}
      <div className="w-full md:w-52 md:shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          {/* <h1 className="text-[15px] font-bold text-gray-900 leading-tight">Notifications</h1> */}
          <p className="text-[12px] text-gray-500 font-semibold mt-0.5">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
          {unread > 0 && (
            <button
              onClick={() => markAllRead()}
              disabled={markingAll}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
              {markingAll ? 'Marking...' : 'Mark all read'}
            </button>
          )}
        </div>

        {/* Filter nav */}
        <nav className="p-2 space-y-0.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
                filter === f.key
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <span>{f.label}</span>
              {f.count > 0 && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full leading-none ${
                  filter === f.key
                    ? f.key === 'unread' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-100/60 text-indigo-500'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Right: notification list ── */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse shrink-0" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3.5 w-3/4 bg-gray-100 rounded animate-pulse" />
                  <div className="h-2.5 w-1/2 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-16 text-center px-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-400">
              {filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}
            </p>
            <p className="text-xs text-gray-300 mt-1">
              {filter === 'all' ? "You'll be notified when bookings are created, assigned, or completed" : ''}
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {groups.map((group, gi) => (
              <motion.div key={group.label} layout>
                <div className="px-5 py-2.5 bg-gray-50/80 border-b border-gray-100 sticky top-0">
                  <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-widest">{group.label}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  <AnimatePresence mode="popLayout">
                    {group.items.map(n => (
                      <NotifCard key={n.id} n={n} onRead={(id) => markRead(id)} onDelete={(id) => deleteNotif(id)} />
                    ))}
                  </AnimatePresence>
                </div>
                {gi < groups.length - 1 && <div className="h-2 bg-gray-50" />}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
