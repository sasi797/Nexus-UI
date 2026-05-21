'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem, popIn, cardHover } from '@/lib/animations';
import Table, { ColumnDef } from '@/components/Table';
import {
  useGetAllocationStatusQuery, useRunAllocationMutation,
  useRunAllPendingMutation, useGetAllocationLogQuery, useResetPointerMutation,
} from '@/services/allocationsApi';
import { useGetBookingsQuery, BookingListItem } from '@/services/bookingsApi';
import type { AllocationLogEntry } from '@/services/allocationsApi';

type Tab = 'pending' | 'log';

const logColumns: ColumnDef<AllocationLogEntry>[] = [
  { key: 'booking_id',   header: 'Booking ID',    sortable: true, filterable: true, render: v => <span className="font-bold text-indigo-600 text-xs">{String(v)}</span> },
  { key: 'agent',        header: 'Assigned Agent', sortable: true, filterable: true, render: v => <span className="font-medium text-gray-700 text-xs">{(v as { name: string } | null)?.name ?? '—'}</span> },
  { key: 'pointer_value',header: 'Pointer',        sortable: true, render: v => <span className="text-gray-500 text-xs">{String(v)}</span> },
  { key: 'pool_size',    header: 'Pool',           sortable: true, render: v => <span className="text-gray-500 text-xs">{String(v)}</span> },
  { key: 'allocated_at', header: 'Allocated At',   sortable: true, render: v => <span className="text-gray-400 text-xs">{new Date(String(v)).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> },
];

export default function AllocationsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [toast, setToast] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useGetAllocationStatusQuery(undefined, { pollingInterval: 5000 });
  const { data: log = [], isLoading: logLoading } = useGetAllocationLogQuery({ limit: 50 });
  const { data: pendingBookingsPage, isFetching: pendingFetching } = useGetBookingsQuery({ status: 'Pending', page_size: 100 });
  const pendingBookings = pendingBookingsPage?.items ?? [];

  const [runAllocation, { isLoading: running }] = useRunAllocationMutation();
  const [runAllPending, { isLoading: runningAll }] = useRunAllPendingMutation();
  const [resetPointer] = useResetPointerMutation();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAllocateOne = async (bookingId: string) => {
    await runAllocation({ booking_id: bookingId });
    showToast('Booking allocated successfully');
  };

  const handleAllocateAll = async () => {
    const res = await runAllPending().unwrap();
    showToast(res.message);
  };

  const pendingColumns: ColumnDef<BookingListItem>[] = [
    {
      key: 'id', header: 'Booking ID', sortable: true, filterable: true,
      render: v => <span className="font-bold text-indigo-600 text-xs">{String(v)}</span>,
    },
    { key: 'subject', header: 'Subject', sortable: true, filterable: true, render: v => <span className="text-gray-700 text-xs truncate max-w-[180px] block">{String(v)}</span> },
    {
      key: 'priority', header: 'Priority', sortable: true,
      render: v => {
        const s = String(v);
        const cls = s === 'Urgent' ? 'bg-red-50 text-red-700 ring-red-200' : s === 'Standard' ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200';
        return <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ring-1 ${cls}`}>{s}</span>;
      },
    },
    {
      key: 'received_at', header: 'Received', sortable: true,
      render: v => <span className="text-gray-400 text-xs">{new Date(String(v)).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>,
    },
    {
      key: 'id', header: 'Action', width: '90px',
      render: (v) => (
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => handleAllocateOne(String(v))}
          disabled={running || !status?.pool_size}
          className="text-xs font-bold px-3 py-1 bg-indigo-600 text-white rounded-lg disabled:opacity-50 transition-all">
          Allocate
        </motion.button>
      ),
    },
  ];

  const statCards = status ? [
    { label: 'Present Agents', value: String(status.pool_size), bg: 'from-emerald-50 to-teal-50', text: 'text-emerald-700' },
    { label: 'RR Pointer', value: String(status.pointer), bg: 'from-indigo-50 to-violet-50', text: 'text-indigo-600' },
    { label: 'Next Agent', value: status.next_agent_name ?? 'None', bg: 'from-sky-50 to-blue-50', text: 'text-sky-700', small: true },
    { label: 'Pending', value: String(pendingBookings.length), bg: 'from-amber-50 to-orange-50', text: 'text-amber-700' },
  ] : [];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3 max-w-4xl">
      {/* <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Allocation</motion.h1> */}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Round Robin Allocation</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Only <b>Present</b> agents participate. On Break / Absent agents are excluded from the pool.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button onClick={() => resetPointer()} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
              className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all">
              Reset Pointer
            </motion.button>
            <motion.button onClick={handleAllocateAll} disabled={runningAll || !pendingBookings.length || !status?.pool_size}
              whileHover={{ scale: 1.03, boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }} whileTap={{ scale: 0.96 }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md transition-all">
              <motion.svg animate={runningAll ? { rotate: 360 } : {}} transition={runningAll ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
                className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </motion.svg>
              {runningAll ? 'Allocating...' : `Allocate All (${pendingBookings.length})`}
            </motion.button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 grid grid-cols-4 gap-3 border-b border-gray-100">
          {statusLoading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
            : statCards.map(s => (
              <motion.div key={s.label} variants={popIn} initial="rest" whileHover="hover" animate="rest">
                <motion.div variants={cardHover} className={`text-center bg-gradient-to-br ${s.bg} rounded-xl p-3 border border-white shadow-sm`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
                  <AnimatePresence mode="wait">
                    <motion.p key={s.value} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className={`font-black ${s.text} ${s.small ? 'text-sm leading-tight' : 'text-2xl'}`}>
                      {s.value}
                    </motion.p>
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            ))
          }
        </div>

        {/* Tabs */}
        <div className="px-4 border-b border-gray-100 flex items-center gap-1">
          {(['pending', 'log'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative px-3 py-2.5 text-xs font-bold capitalize transition-colors ${tab === t ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-700'}`}>
              {t === 'pending' ? `Pending Bookings${pendingBookings.length ? ` (${pendingBookings.length})` : ''}` : 'Allocation Log'}
              {tab === t && (
                <motion.div layoutId="alloc-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          ))}
          {(pendingFetching || logLoading) && <div className="ml-auto w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {tab === 'pending' ? (
              status?.pool_size === 0 ? (
                <div className="py-10 text-center text-xs text-amber-600 font-semibold bg-amber-50/50">
                  No present agents today. Mark attendance before running allocation.
                </div>
              ) : (
                <Table columns={pendingColumns} data={pendingBookings} rowKey={r => r.id}
                  emptyMessage="No pending bookings — all caught up!" />
              )
            ) : (
              <Table columns={logColumns} data={log} rowKey={(_, i) => String(i)}
                emptyMessage="No allocation history yet." />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
