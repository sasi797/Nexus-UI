'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem, popIn } from '@/lib/animations';
import { useGetAgentsQuery } from '@/services/agentsApi';
import { useGetBookingsQuery } from '@/services/bookingsApi';
import ApiErrorState from '@/components/ApiErrorState';
import type { Agent } from '@/services/agentsApi';
import type { BookingListItem } from '@/services/bookingsApi';

const statusStyle: Record<string, string> = {
  'In Progress': 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  Pending:       'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Completed:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};
const priorityStyle: Record<string, string> = {
  Urgent:   'bg-red-50 text-red-700',
  Standard: 'bg-indigo-50 text-indigo-700',
  Economy:  'bg-emerald-50 text-emerald-700',
};
const avatarGrads = [
  'from-indigo-500 to-violet-500', 'from-sky-500 to-blue-500', 'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500', 'from-amber-500 to-orange-500', 'from-purple-500 to-fuchsia-500',
];

function AgentBookingsPanel({ agent, idx }: { agent: Agent; idx: number }) {
  const [open, setOpen] = useState(false);
  const { data: bookings = [], isFetching } = useGetBookingsQuery(
    { agent_id: agent.id, limit: 100 },
    { skip: !open }
  );

  const inProgress = bookings.filter(b => b.status === 'In Progress').length;
  const completed  = bookings.filter(b => b.status === 'Completed').length;
  const pending    = bookings.filter(b => b.status === 'Pending').length;

  return (
    <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80 overflow-hidden">
      {/* Agent row */}
      <button onClick={() => setOpen(v => !v)} className="w-full text-left">
        <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/60 transition-colors">
          <motion.div whileHover={{ scale: 1.08, rotate: 4 }} transition={{ type: 'spring', stiffness: 400 }}
            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGrads[idx % avatarGrads.length]} flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0`}>
            {agent.name.charAt(0)}
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">{agent.name}</p>
            <p className="text-xs text-gray-400 truncate">{agent.email}{agent.shift ? ` · ${agent.shift.name}` : ''}</p>
          </div>
          {/* Mini stats */}
          <div className="flex items-center gap-2 mr-2">
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{inProgress > 0 || open ? inProgress : '—'} In Progress</span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{completed > 0 || open ? completed : '—'} Done</span>
            {pending > 0 && <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{pending} Pending</span>}
          </div>
          <motion.svg animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}
            className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      {/* Expanded bookings list */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="border-t border-gray-100 px-4 py-2">
              {isFetching ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : bookings.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">No bookings assigned to this agent</p>
              ) : (
                <div className="space-y-1.5 py-1.5">
                  {bookings.map(b => (
                    <motion.div key={b.id} variants={popIn} initial="hidden" animate="visible"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50/70 hover:bg-indigo-50/40 transition-colors">
                      <span className="font-bold text-indigo-600 text-xs w-32 shrink-0">{b.id}</span>
                      <span className="text-xs text-gray-700 flex-1 truncate">{b.subject}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${priorityStyle[b.priority] ?? ''}`}>{b.priority}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 ${statusStyle[b.status] ?? ''}`}>
                        {b.status}
                      </span>
                      <span className="text-[11px] text-gray-400 shrink-0">
                        {new Date(b.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AgentsPage() {
  const { data: agents = [], isLoading, isError, refetch } = useGetAgentsQuery();
  const { data: allBookings = [] } = useGetBookingsQuery({ limit: 200 });

  const totalAssigned = allBookings.filter(b => b.agent !== null).length;
  const totalUnassigned = allBookings.filter(b => b.agent === null).length;

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3 max-w-3xl">
      <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Agents</motion.h1>

      {/* Summary row */}
      <motion.div variants={staggerItem} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Agents', value: agents.length, bg: 'from-indigo-50 to-violet-50', text: 'text-indigo-700' },
          { label: 'Assigned Bookings', value: totalAssigned, bg: 'from-emerald-50 to-teal-50', text: 'text-emerald-700' },
          { label: 'Unassigned Bookings', value: totalUnassigned, bg: 'from-amber-50 to-orange-50', text: 'text-amber-700' },
        ].map(s => (
          <motion.div key={s.label} whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300 }}
            className={`bg-gradient-to-br ${s.bg} rounded-xl p-4 border border-white shadow-sm`}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.text}`}>{isLoading ? '—' : s.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Agent list */}
      <motion.div variants={staggerItem} className="space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Click an agent to see their bookings</p>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse" />)
          : isError
            ? <ApiErrorState title="Failed to load agents" onRetry={refetch} />
            : agents.map((agent, idx) => <AgentBookingsPanel key={agent.id} agent={agent} idx={idx} />)
        }
      </motion.div>
    </motion.div>
  );
}
