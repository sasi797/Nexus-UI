'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import Table, { ColumnDef } from '@/components/Table';
import { useGetDashboardStatsQuery } from '@/services/dashboardApi';
import { useGetBookingsQuery, BookingListItem } from '@/services/bookingsApi';
import ApiErrorState from '@/components/ApiErrorState';

/* ── helpers ── */
function parseDaNumbers(raw: unknown): string[] {
  const val = String(raw ?? '').trim();
  if (!val || val === 'null') return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

const AVATAR_COLORS = [
  'from-sky-400 to-blue-500', 'from-violet-400 to-purple-600',
  'from-emerald-400 to-teal-500', 'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-600', 'from-indigo-400 to-violet-500',
];
function avatarColor(str: string) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function senderName(email: string) {
  return email.split('@')[0].split(/[._+]/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ── status config ── */
const STATUS_CFG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  'In Progress': { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'In Progress' },
  Pending:       { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Open'        },
  Completed:     { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed'   },
  Ignored:       { bg: 'bg-slate-50',   text: 'text-slate-600',   dot: 'bg-slate-400',   label: 'Ignored'     },
};

/* ── elapsed timer ── */
function ElapsedTimer({ receivedAt, completedAt, status, priority }: {
  receivedAt: string; completedAt: string | null; status: string; priority: string;
}) {
  const isActive = status === 'Pending' || status === 'In Progress';
  const endTime   = (!isActive && completedAt) ? new Date(completedAt).getTime() : null;

  const calcMs = () => endTime
    ? endTime - new Date(receivedAt).getTime()
    : Date.now() - new Date(receivedAt).getTime();

  const [ms, setMs] = useState(calcMs);

  useEffect(() => {
    if (!isActive) { setMs(calcMs()); return; }
    const id = setInterval(() => setMs(calcMs()), 1000);
    return () => clearInterval(id);
  }, [isActive, receivedAt, completedAt]);

  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const fmt = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const isHigh = priority === 'High';
  const isMed  = priority === 'Medium';

  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-gray-400">
        <svg className="w-3 h-3 shrink-0 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3"/>
        </svg>
        {fmt}
      </span>
    );
  }

  const ringCls = isHigh ? 'bg-red-50 text-red-600 border border-red-100'
    : isMed ? 'bg-amber-50 text-amber-600 border border-amber-100'
    : 'bg-slate-50 text-slate-500 border border-slate-100';
  const dotCls  = isHigh ? 'bg-red-500' : isMed ? 'bg-amber-500' : 'bg-slate-400';
  const badgeCls = isHigh ? 'bg-red-100 text-red-600' : isMed ? 'bg-amber-100 text-amber-600' : '';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold ${ringCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${dotCls}`} />
      {fmt}
      {(isHigh || isMed) && (
        <span className={`text-[9px] font-extrabold uppercase px-1 py-0.5 rounded ${badgeCls}`}>
          {priority}
        </span>
      )}
    </span>
  );
}

/* ── table columns ── */
const bookingColumns: ColumnDef<BookingListItem>[] = [
  {
    key: 'sender_email', header: 'From',
    render: (v) => {
      const email = String(v);
      const name  = senderName(email);
      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor(email)} flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-sm`}>
            {email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-gray-900 truncate leading-tight">{name}</p>
            <p className="text-[10px] text-gray-400 truncate leading-tight">{email}</p>
          </div>
        </div>
      );
    },
  },
  {
    key: 'id', header: 'Booking ID', sortable: true,
    render: v => (
      <Link href={`/dashboard/my-bookings/${v}`}
        className="inline-flex items-center font-mono text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
        {String(v)}
      </Link>
    ),
  },
  {
    key: 'subject', header: 'Subject', sortable: true, filterable: true,
    render: v => <span className="text-[12.5px] font-medium text-gray-800 line-clamp-1 max-w-[260px] block">{String(v)}</span>,
  },
  {
    key: 'status', header: 'Status', sortable: true, filterable: true,
    render: v => {
      const cfg = STATUS_CFG[String(v)] ?? STATUS_CFG.Ignored;
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
          {cfg.label}
        </span>
      );
    },
  },
  {
    key: '_timer', header: 'Timer',
    render: (_, row) => {
      const b = row as BookingListItem;
      return <ElapsedTimer receivedAt={b.received_at} completedAt={b.completed_at} status={b.status} priority={b.priority} />;
    },
  },
  {
    key: 'da_number', header: 'DA Numbers',
    render: (_, row) => {
      const nums = parseDaNumbers((row as BookingListItem).da_number);
      if (nums.length === 0) return <span className="text-gray-200 font-black text-lg">—</span>;
      const shown = nums.slice(0, 2);
      const rest  = nums.length - 2;
      return (
        <div className="flex items-center gap-1 flex-wrap">
          {shown.map(n => (
            <span key={n} className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
              {n}
            </span>
          ))}
          {rest > 0 && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-600 text-white whitespace-nowrap">
              +{rest}
            </span>
          )}
        </div>
      );
    },
  },
  {
    key: '_da_count', header: '#DA',
    render: (_, row) => {
      const count = parseDaNumbers((row as BookingListItem).da_number).length;
      if (count === 0) return <span className="text-gray-200 font-black text-lg">—</span>;
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-sm">
          {count}
        </span>
      );
    },
  },
  {
    key: 'received_at', header: 'Received', sortable: true,
    render: v => (
      <span className="text-[11px] text-gray-400 whitespace-nowrap">
        {new Date(String(v)).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </span>
    ),
  },

];

/* ── skeleton ── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 animate-pulse rounded-2xl ${className}`} />;
}

/* ── small icons for card header ── */
const ICON = {
  clipboard: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  clock:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3"/></svg>,
  refresh:   <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>,
  check:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
};

/* ── watermark icons ── */
const WM = {
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  ),
};

/* ── stat card ── */
function StatCard({ label, value, gradient, border, valueColor, iconBg, iconColor, icon, watermarkColor, watermark, sub, delay = 0 }: {
  label: string; value: number; gradient: string; border: string;
  valueColor: string; iconBg: string; iconColor: string; icon: React.ReactNode;
  watermarkColor: string; watermark: React.ReactNode;
  sub?: { value: number; label: string } | null; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`relative overflow-hidden rounded-xl ${gradient} ${border} border px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow cursor-default select-none`}
    >
      {/* Watermark */}
      <div className={`absolute -right-2 -bottom-2 ${watermarkColor} pointer-events-none`}>
        {watermark}
      </div>

      {/* Top row: icon + label */}
      <div className="flex items-center justify-between mb-1.5">
        <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center ${iconColor} shrink-0`}>
          {icon}
        </div>
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      </div>

      {/* Value */}
      <motion.p
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, delay: delay + 0.08 }}
        className={`text-3xl font-black leading-none ${valueColor}`}
      >
        {value}
      </motion.p>

      {/* Sub metric */}
      {sub && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${iconBg} ${iconColor} text-[12px] font-bold`}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            {sub.value}
          </span>
          <span className="text-[11px] font-medium text-gray-500">{sub.label}</span>
        </div>
      )}
    </motion.div>
  );
}

/* ── page ── */
export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } =
    useGetDashboardStatsQuery();
  const { data: bookingsPage, isLoading: bookingsLoading, isError: bookingsError, refetch: refetchBookings } =
    useGetBookingsQuery({ page_size: 10 });
  const bookings = bookingsPage?.items ?? [];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-5">
      {statsError && <ApiErrorState title="Failed to load stats" onRetry={refetchStats} />}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : (
            <>
              <StatCard
                label="Total Bookings" value={stats?.total_bookings ?? 0}
                gradient="bg-gradient-to-br from-indigo-50 to-violet-100"
                border="border-indigo-100" valueColor="text-indigo-700"
                iconBg="bg-indigo-100" iconColor="text-indigo-600" icon={ICON.clipboard}
                watermarkColor="text-indigo-200" watermark={WM.clipboard} delay={0}
              />
              <StatCard
                label="Open" value={stats?.pending ?? 0}
                gradient="bg-gradient-to-br from-amber-50 to-orange-100"
                border="border-amber-100" valueColor="text-amber-700"
                iconBg="bg-amber-100" iconColor="text-amber-600" icon={ICON.clock}
                watermarkColor="text-amber-200" watermark={WM.clock} delay={0.07}
              />
              <StatCard
                label="In Progress" value={stats?.in_progress ?? 0}
                gradient="bg-gradient-to-br from-blue-50 to-sky-100"
                border="border-blue-100" valueColor="text-blue-700"
                iconBg="bg-blue-100" iconColor="text-blue-600" icon={ICON.refresh}
                watermarkColor="text-blue-200" watermark={WM.refresh} delay={0.14}
              />
              <StatCard
                label="Completed" value={stats?.completed ?? 0}
                gradient="bg-gradient-to-br from-emerald-50 to-teal-100"
                border="border-emerald-100" valueColor="text-emerald-700"
                iconBg="bg-emerald-100" iconColor="text-emerald-600" icon={ICON.check}
                watermarkColor="text-emerald-200" watermark={WM.check} delay={0.21}
                sub={stats ? { value: stats.da_numbers_count, label: 'total DA numbers' } : null}
              />
            </>
          )
        }
      </div>

      {/* ── Recent Bookings ── */}
      <motion.div variants={staggerItem} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm leading-tight">Recent Bookings</h2>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                {bookings.length > 0 ? `Latest ${bookings.length} bookings` : 'No bookings yet'}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/all-bookings"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 px-3.5 py-2 rounded-xl transition-all duration-200"
          >
            View all
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {bookingsLoading
          ? <div className="p-5 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          : bookingsError
            ? <ApiErrorState title="Failed to load bookings" onRetry={refetchBookings} />
            : <Table columns={bookingColumns} data={bookings} rowKey={r => r.id} />
        }
      </motion.div>
    </motion.div>
  );
}
