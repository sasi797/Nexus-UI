'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Table, { ColumnDef } from '@/components/Table';
import { pageTransition, staggerItem, popIn, cardHover } from '@/lib/animations';
import { useGetPendingQueueQuery, useAutoAssignAllMutation, PendingQueueItem } from '@/services/pendingQueueApi';
import { useGetBookingsQuery } from '@/services/bookingsApi';
import { useRunAllocationMutation } from '@/services/allocationsApi';

const priorityStyle: Record<string, string> = {
  Urgent:   'bg-red-50 text-red-700 ring-1 ring-red-200',
  Standard: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  Economy:  'bg-sky-50 text-sky-600 ring-1 ring-sky-200',
};

interface QueueRow { booking_id: string; subject: string; priority: string; reason: string; pending_since: string }

export default function NotificationsPage() {
  const { data: queue = [], isLoading } = useGetPendingQueueQuery();
  const { data: bookings = [] } = useGetBookingsQuery({ limit: 200 });
  const [runAllocation, { isLoading: assigning }] = useRunAllocationMutation();
  const [autoAssignAll, { isLoading: autoAssigning }] = useAutoAssignAllMutation();

  const tableData: QueueRow[] = useMemo(() =>
    queue.map(item => {
      const booking = bookings.find(b => b.id === item.booking_id);
      return {
        booking_id: item.booking_id,
        subject: booking?.subject ?? '—',
        priority: booking?.priority ?? 'Standard',
        reason: item.reason,
        pending_since: item.pending_since,
      };
    }),
    [queue, bookings]
  );

  const statsData = [
    { label: 'Total Pending',  value: queue.length,                                        icon: '⏳', bg: 'from-amber-50 to-orange-50',   text: 'text-amber-700' },
    { label: 'Unique Reasons', value: [...new Set(queue.map(q => q.reason))].length,        icon: '📋', bg: 'from-indigo-50 to-violet-50',  text: 'text-indigo-700' },
    { label: 'Auto Allocate',  value: 'Enabled',                                            icon: '✅', bg: 'from-emerald-50 to-teal-50',   text: 'text-emerald-700' },
    { label: 'Oldest (mins)',  value: queue.length ? Math.floor((Date.now() - new Date(queue[queue.length - 1]?.pending_since ?? Date.now()).getTime()) / 60000) : 0,
      icon: '🕐', bg: 'from-red-50 to-rose-50', text: 'text-red-700' },
  ];

  const columns: ColumnDef<QueueRow>[] = [
    { key: 'booking_id', header: 'Booking ID',   sortable: true, filterable: true, render: v => <span className="font-bold text-indigo-600">{String(v)}</span> },
    { key: 'subject',    header: 'Subject',       sortable: true, filterable: true, render: v => <span className="font-medium text-gray-700">{String(v)}</span> },
    {
      key: 'priority', header: 'Priority', sortable: true, filterable: true,
      render: v => <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ${priorityStyle[String(v)] ?? ''}`}>{String(v)}</span>,
    },
    { key: 'reason',       header: 'Reason',        sortable: true, filterable: true, render: v => <span className="text-gray-500">{String(v)}</span> },
    { key: 'pending_since', header: 'Pending Since', sortable: true,
      render: v => <span className="text-gray-400">{new Date(String(v)).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> },
    {
      key: 'booking_id', header: 'Actions', width: '90px',
      render: (v) => (
        <motion.button
          onClick={() => runAllocation({ booking_id: String(v) })}
          disabled={assigning}
          whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}
          whileTap={{ scale: 0.95 }}
          className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 shadow-sm">
          {assigning ? 'Assigning...' : 'Assign'}
        </motion.button>
      ),
    },
  ];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3">
      <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Pending Queue</motion.h1>

      <div className="grid grid-cols-4 gap-3">
        {statsData.map(s => (
          <motion.div key={s.label} variants={popIn} initial="rest" whileHover="hover" animate="rest">
            <motion.div variants={cardHover} className={`bg-gradient-to-br ${s.bg} rounded-xl p-4 border border-white shadow-sm cursor-default`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-semibold text-gray-500">{s.label}</p>
                <span className="text-lg">{s.icon}</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.p key={String(s.value)} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300 }} className={`text-2xl font-black ${s.text}`}>
                  {s.value}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ))}
      </div>

      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-sm">Pending Queue</h2>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => autoAssignAll()} disabled={autoAssigning || !queue.length}
            className="flex items-center gap-1 text-xs font-bold text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {autoAssigning ? 'Assigning...' : 'Auto-assign all'}
          </motion.button>
        </div>

        <AnimatePresence>
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : tableData.length > 0 ? (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Table columns={columns} data={tableData} rowKey={row => row.booking_id} emptyMessage="All bookings assigned!" />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
              className="py-14 text-center">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} className="text-4xl mb-2">🎉</motion.div>
              <p className="text-sm font-semibold text-gray-400">All bookings have been assigned!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}