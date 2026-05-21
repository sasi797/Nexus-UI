'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { pageTransition, staggerItem, popIn, cardHover, staggerContainer } from '@/lib/animations';
import Table, { ColumnDef } from '@/components/Table';
import { useGetDashboardStatsQuery } from '@/services/dashboardApi';
import { useGetBookingsQuery, BookingListItem } from '@/services/bookingsApi';
import ApiErrorState from '@/components/ApiErrorState';

const priorityStyle: Record<string, string> = {
  Urgent:   'bg-red-50 text-red-700 ring-1 ring-red-200',
  Standard: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  Economy:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};
const statusStyle: Record<string, string> = {
  'In Progress': 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  Pending:       'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Completed:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};

const bookingColumns: ColumnDef<BookingListItem>[] = [
  {
    key: 'id', header: 'Booking ID', sortable: true,
    render: (v) => (
      <Link href={`/dashboard/my-bookings/${v}`} className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
        {String(v)}
      </Link>
    ),
  },
  { key: 'subject', header: 'Subject', sortable: true, filterable: true, render: v => <span className="font-medium text-gray-700">{String(v)}</span> },
  {
    key: 'priority', header: 'Priority', sortable: true, filterable: true,
    render: v => <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ${priorityStyle[String(v)] ?? ''}`}>{String(v)}</span>,
  },
  {
    key: 'status', header: 'Status', sortable: true, filterable: true,
    render: v => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${statusStyle[String(v)] ?? ''}`}>{String(v)}</span>,
  },
  {
    key: 'received_at', header: 'Received At', sortable: true,
    render: v => <span className="text-gray-400">{new Date(String(v)).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>,
  },
];

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 animate-pulse rounded-xl ${className}`} />;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useGetDashboardStatsQuery();
  const { data: bookingsPage, isLoading: bookingsLoading, isError: bookingsError, refetch: refetchBookings } = useGetBookingsQuery({ page_size: 10 });
  const bookings = bookingsPage?.items ?? [];

  const statCards = stats ? [
    { label: 'Total Bookings', value: stats.total_bookings, icon: '📋', bg: 'from-indigo-50 to-violet-50', text: 'text-indigo-700' },
    { label: 'Pending',        value: stats.pending,        icon: '⏳', bg: 'from-amber-50 to-orange-50',  text: 'text-amber-700' },
    { label: 'In Progress',    value: stats.in_progress,    icon: '🔄', bg: 'from-blue-50 to-sky-50',      text: 'text-blue-700' },
    { label: 'Completed',      value: stats.completed,      icon: '✅', bg: 'from-emerald-50 to-teal-50',  text: 'text-emerald-700' },
  ] : [];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Dashboard</motion.h1>

      {statsError && <ApiErrorState title="Failed to load stats" onRetry={refetchStats} />}

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-4 gap-3">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : statCards.map(s => (
            <motion.div key={s.label} variants={popIn} initial="rest" whileHover="hover" animate="rest">
              <motion.div variants={cardHover} className={`bg-gradient-to-br ${s.bg} rounded-xl p-4 border border-white shadow-sm cursor-default`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-gray-500">{s.label}</p>
                  <span className="text-lg">{s.icon}</span>
                </div>
                <motion.p initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className={`text-3xl font-black ${s.text}`}>{s.value}</motion.p>
              </motion.div>
            </motion.div>
          ))
        }
      </motion.div>

      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-xs">Recent Bookings</h2>
          <Link href="/dashboard/my-bookings" className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">View all →</Link>
        </div>
        {bookingsLoading
          ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          : bookingsError
            ? <ApiErrorState title="Failed to load bookings" onRetry={refetchBookings} />
            : <Table columns={bookingColumns} data={bookings} rowKey={r => r.id} />
        }
      </motion.div>
    </motion.div>
  );
}
