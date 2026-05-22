'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetNotificationsQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
  NotificationItem,
} from '@/services/notificationsApi';

const TYPE_CFG: Record<string, { bg: string; ring: string; icon: string; label: string }> = {
  booking_created:  { bg: 'bg-indigo-50',  ring: 'ring-indigo-200',  icon: '📥', label: 'New Booking' },
  booking_assigned: { bg: 'bg-blue-50',    ring: 'ring-blue-200',    icon: '👤', label: 'Assigned' },
  booking_completed:{ bg: 'bg-emerald-50', ring: 'ring-emerald-200', icon: '✅', label: 'Completed' },
  status_changed:   { bg: 'bg-amber-50',   ring: 'ring-amber-200',   icon: '🔄', label: 'Status Change' },
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const { data, isLoading } = useGetNotificationsQuery(undefined, { pollingInterval: 15_000 });
  const [markRead] = useMarkReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllReadMutation();

  const items = data?.items ?? [];
  const unread = data?.unread_count ?? 0;

  const handleClick = async (n: NotificationItem) => {
    if (!n.is_read) await markRead(n.id);
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="max-w-2xl mx-auto space-y-3">

      {/* Header row */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900">Notifications</h2>
          {unread > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
              {unread} unread
            </span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAllRead()}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </motion.div>

      {/* List */}
      <motion.div variants={staggerItem} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
                  <div className="h-2.5 w-3/4 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-2">🔔</p>
            <p className="text-sm font-semibold text-gray-400">No notifications yet</p>
            <p className="text-xs text-gray-300 mt-1">You'll see updates here when bookings are created, assigned, or completed</p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="divide-y divide-gray-50">
              {items.map((n, idx) => {
                const cfg = TYPE_CFG[n.type] ?? { bg: 'bg-gray-50', ring: 'ring-gray-200', icon: '📌', label: 'Update' };
                return (
                  <motion.button
                    key={n.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => handleClick(n)}
                    className={`w-full flex items-start gap-3 px-5 py-4 text-left transition-colors ${
                      n.is_read ? 'hover:bg-gray-50/60' : 'bg-indigo-50/40 hover:bg-indigo-50/70'
                    }`}
                  >
                    {/* Icon */}
                    <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-base ring-1 ${cfg.bg} ${cfg.ring}`}>
                      {cfg.icon}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${n.is_read ? 'text-gray-400' : 'text-indigo-500'}`}>
                          {cfg.label}
                        </span>
                        {n.entity_id && (
                          <span className="text-[10px] font-mono text-gray-400">{n.entity_id}</span>
                        )}
                      </div>
                      <p className={`text-[13px] leading-snug ${n.is_read ? 'text-gray-500 font-medium' : 'text-gray-900 font-semibold'}`}>
                        {n.title}
                      </p>
                      <p className="text-[11.5px] text-gray-400 mt-0.5 leading-snug">{n.body}</p>
                      <p className="text-[10.5px] text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                    </div>

                    {/* Unread dot */}
                    {!n.is_read && (
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </motion.div>
    </motion.div>
  );
}
