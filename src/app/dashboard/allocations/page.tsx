'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem, popIn, cardHover } from '@/lib/animations';
import Table, { ColumnDef } from '@/components/Table';
import { useGetAllocationStatusQuery, useRunAllocationMutation, useGetAllocationLogQuery } from '@/services/allocationsApi';
import { useGetPendingQueueQuery } from '@/services/pendingQueueApi';
import type { AllocationLogEntry } from '@/services/allocationsApi';

const avatarGrads = ['from-indigo-500 to-violet-500', 'from-sky-500 to-blue-500', 'from-emerald-500 to-teal-500'];

const columns: ColumnDef<AllocationLogEntry>[] = [
  { key: 'booking_id',  header: 'Booking ID',     sortable: true, filterable: true, render: v => <span className="font-bold text-indigo-600">{String(v)}</span> },
  { key: 'agent',       header: 'Assigned Agent',  sortable: true, filterable: true, render: (v) => <span className="font-medium text-gray-700">{(v as { name: string } | null)?.name ?? '—'}</span> },
  { key: 'pointer_value', header: 'Pointer',       sortable: true, render: v => <span className="text-gray-500">{String(v)}</span> },
  { key: 'pool_size',   header: 'Pool Size',       sortable: true, render: v => <span className="text-gray-500">{String(v)}</span> },
  { key: 'allocated_at', header: 'Allocated At',   sortable: true, render: v => <span className="text-gray-400">{new Date(String(v)).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> },
];

export default function AllocationsPage() {
  const { data: status, isLoading: statusLoading } = useGetAllocationStatusQuery(undefined, { pollingInterval: 5000 });
  const { data: log = [], isLoading: logLoading } = useGetAllocationLogQuery({ limit: 50 });
  const { data: pendingQueue = [] } = useGetPendingQueueQuery();
  const [runAllocation, { isLoading: running }] = useRunAllocationMutation();

  const handleRun = async () => {
    const nextBooking = pendingQueue[0];
    if (!nextBooking) return;
    await runAllocation({ booking_id: nextBooking.booking_id });
  };

  const statCards = status ? [
    { label: 'Present Agents',      value: String(status.pool_size),         bg: 'from-emerald-50 to-teal-50',  text: 'text-emerald-700' },
    { label: 'Round Robin Pointer', value: String(status.pointer),            bg: 'from-indigo-50 to-violet-50', text: 'text-indigo-600' },
    { label: 'Next Agent',          value: status.next_agent_name ?? 'None',  bg: 'from-gray-50 to-slate-50',    text: 'text-gray-800', small: true },
    { label: 'Pool Size',           value: String(status.pool_size),          bg: 'from-sky-50 to-blue-50',      text: 'text-sky-600' },
  ] : [];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3 max-w-4xl">
      <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Allocation</motion.h1>

      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-sm">Round Robin Allocation</h2>
          <motion.button onClick={handleRun} disabled={running || !pendingQueue.length}
            whileHover={{ scale: 1.03, boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }} whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md transition-all">
            <motion.svg animate={running ? { rotate: 360 } : {}} transition={running ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
              className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </motion.svg>
            {running ? 'Allocating...' : pendingQueue.length ? `Run Allocation (${pendingQueue.length} pending)` : 'No pending bookings'}
          </motion.button>
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
                    <motion.p key={s.value} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
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

        {/* Allocation Log */}
        <div className="px-0">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-900">Allocation Log</p>
            {logLoading && <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />}
          </div>
          <Table columns={columns} data={log} rowKey={(_, i) => String(i)} />
        </div>
      </motion.div>
    </motion.div>
  );
}