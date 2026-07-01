'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetAgentStatsQuery } from '@/services/agentsApi';
import { useGetBookingsQuery } from '@/services/bookingsApi';
import ApiErrorState from '@/components/ApiErrorState';
import type { AgentStatsItem } from '@/services/agentsApi';
import type { BookingListItem } from '@/services/bookingsApi';

const BST_TZ   = 'Europe/London';
const MIN_DATE = '2026-06-01';
type FilterMode = 'today' | 'day' | 'range' | 'alltime';

const ACCENTS = [
  { grad: 'from-indigo-500 to-violet-600', bar: 'from-indigo-400 to-violet-500', light: 'bg-indigo-50',  ring: 'ring-indigo-200'  },
  { grad: 'from-sky-500 to-blue-600',      bar: 'from-sky-400 to-blue-500',      light: 'bg-sky-50',    ring: 'ring-sky-200'    },
  { grad: 'from-emerald-500 to-teal-600',  bar: 'from-emerald-400 to-teal-500',  light: 'bg-emerald-50',ring: 'ring-emerald-200'},
  { grad: 'from-rose-500 to-pink-600',     bar: 'from-rose-400 to-pink-500',     light: 'bg-rose-50',   ring: 'ring-rose-200'   },
  { grad: 'from-amber-500 to-orange-500',  bar: 'from-amber-400 to-orange-400',  light: 'bg-amber-50',  ring: 'ring-amber-200'  },
  { grad: 'from-purple-500 to-fuchsia-600',bar: 'from-purple-400 to-fuchsia-500',light: 'bg-purple-50', ring: 'ring-purple-200' },
];

const STATUS_BADGE: Record<string, { bg: string; dot: string; label: string }> = {
  Completed:     { bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500', label: 'Completed'   },
  'In Progress': { bg: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',          dot: 'bg-blue-500',    label: 'In Progress' },
  Pending:       { bg: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',       dot: 'bg-amber-500',   label: 'Open'        },
  Ignored:       { bg: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',      dot: 'bg-slate-400',   label: 'Ignored'     },
};

const PRIORITY_BADGE: Record<string, string> = {
  'Very Urgent': 'bg-red-50 text-red-700 ring-1 ring-red-200',
  Urgent:        'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  'Not Urgent':  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};

/* ── DA number pills ── */
function DANumbers({ da_number }: { da_number: string | null }) {
  if (!da_number) return <span className="text-gray-300 text-xs">—</span>;
  const parts = da_number.split(',').map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((d, i) => (
        <span key={i} className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md">
          {d}
        </span>
      ))}
    </div>
  );
}

/* ── Portal modal shell ── */
function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" onClick={onClose}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ── Bookings modal ── */
function AgentBookingsModal({
  stat, idx, isOpen, onClose,
}: {
  stat: AgentStatsItem; idx: number; isOpen: boolean; onClose: () => void;
}) {
  const accent = ACCENTS[idx % ACCENTS.length];

  const { data: bookingsPage, isFetching } = useGetBookingsQuery(
    { agent_id: stat.agent_id, page_size: 100 },
    { skip: !isOpen }
  );
  const bookings: BookingListItem[] = bookingsPage?.items ?? [];

  const modalStats = [
    { label: 'Total',       value: stat.total,       color: 'text-gray-800'    },
    { label: 'Completed',   value: stat.completed,   color: 'text-emerald-700' },
    { label: 'In Progress', value: stat.in_progress, color: 'text-blue-700'    },
    { label: 'Open',        value: stat.pending,     color: 'text-amber-700'   },
    { label: 'Ignored',     value: stat.ignored,     color: 'text-slate-600'   },
    { label: 'DA Count',    value: stat.da_count,    color: 'text-violet-700'  },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Header */}
      <div className={`h-1 bg-gradient-to-r ${accent.bar} shrink-0`} />
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${accent.grad} flex items-center justify-center text-white font-black text-base shadow-md shrink-0`}>
          {stat.agent_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-gray-900 text-[15px] leading-tight">{stat.agent_name}</h2>
          <p className="text-[11px] text-gray-400 truncate mt-0.5">
            {stat.agent_email}{stat.shift ? ` · ${stat.shift}` : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stat pills */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/60 shrink-0 flex-wrap">
        {modalStats.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-1.5 border border-gray-100 shadow-sm">
            <span className={`text-base font-black leading-none ${s.color}`}>{s.value}</span>
            <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wide">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Bookings table */}
      <div className="flex-1 overflow-y-auto">
        {isFetching ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-10 h-10 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-semibold">No bookings in this period</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="sticky top-0 bg-white border-b border-gray-100 z-10">
                {['Booking ID', 'Subject', 'Status', 'Priority', 'DA Number', 'Received'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map((b, i) => {
                const s = STATUS_BADGE[b.status] ?? STATUS_BADGE.Ignored;
                return (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025, duration: 0.18 }}
                    className="hover:bg-gray-50/70 transition-colors"
                  >
                    {/* ID */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-indigo-600 text-[11px]">{b.id}</span>
                    </td>
                    {/* Subject */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <span className="text-[12px] text-gray-800 font-medium line-clamp-2 leading-snug">{b.subject}</span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${s.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>
                    {/* Priority */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[b.priority] ?? 'bg-gray-50 text-gray-500'}`}>
                        {b.priority}
                      </span>
                    </td>
                    {/* DA */}
                    <td className="px-4 py-3">
                      <DANumbers da_number={b.da_number} />
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[11px] text-gray-500 font-medium">
                        {new Date(b.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {b.completed_at && (
                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          ✓ {new Date(b.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {!isFetching && bookings.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-gray-400 font-medium">
            Showing {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onClose}
            className="text-[11px] font-bold text-gray-500 bg-white hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ── Agent card ── */
function AgentCard({ stat, idx, isTop }: { stat: AgentStatsItem; idx: number; isTop: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);
  const accent = ACCENTS[idx % ACCENTS.length];
  const pct    = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;

  const tiles = [
    { label: 'Completed',   value: stat.completed,   num: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'In Progress', value: stat.in_progress, num: 'text-blue-600',    bg: 'bg-blue-50'    },
    { label: 'Open',        value: stat.pending,     num: 'text-amber-600',   bg: 'bg-amber-50'   },
    { label: 'Ignored',     value: stat.ignored,     num: 'text-slate-500',   bg: 'bg-slate-50'   },
  ];

  return (
    <>
      <motion.div
        variants={staggerItem}
        whileHover={{ y: -4, transition: { duration: 0.15 } }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-gray-200 transition-all duration-200 overflow-hidden flex flex-col"
      >
        <div className={`h-[3px] bg-gradient-to-r ${accent.bar} shrink-0`} />

        <div className="p-5 flex-1 flex flex-col">
          {/* Agent identity */}
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${accent.grad} flex items-center justify-center text-white font-black text-base shadow-lg shrink-0`}>
              {stat.agent_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-black text-gray-900 text-[13.5px] leading-tight truncate">{stat.agent_name}</p>
                {isTop && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0 leading-none">
                    ★ TOP
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{stat.shift ?? 'No shift'}</p>
            </div>
            {stat.da_count > 0 && (
              <span className="shrink-0 text-[10px] font-black text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg leading-none">
                DA {stat.da_count}
              </span>
            )}
          </div>

          {/* Completion progress */}
          <div className="mb-5">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[11px] text-gray-500 font-semibold">{stat.completed} of {stat.total} done</span>
              <span className="text-[13px] font-black text-gray-800">{pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: idx * 0.05 }}
                className={`h-full bg-gradient-to-r ${accent.bar} rounded-full`}
              />
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {tiles.map(t => (
              <div key={t.label} className={`${t.bg} rounded-xl py-2.5 px-1 text-center`}>
                <p className={`text-xl font-black leading-none ${t.num}`}>{t.value}</p>
                <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-wide mt-1 leading-tight">{t.label}</p>
              </div>
            ))}
          </div>

          {/* View bookings button */}
          <button
            onClick={() => setModalOpen(true)}
            className={`mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all duration-150 bg-gray-50 hover:bg-indigo-50 text-gray-500 hover:text-indigo-700 hover:ring-1 hover:ring-indigo-200`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View {stat.total} bookings
          </button>
        </div>
      </motion.div>

      {/* Modal */}
      <AgentBookingsModal
        stat={stat}
        idx={idx}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

/* ── Page ── */
export default function AgentsPage() {
  const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: BST_TZ }).format(new Date());

  const [filterMode,  setFilterMode]  = useState<FilterMode>('today');
  const [selectedDay, setSelectedDay] = useState(todayISO);
  const [rangeFrom,   setRangeFrom]   = useState(todayISO);
  const [rangeTo,     setRangeTo]     = useState(todayISO);

  const statsParams = useMemo(() => {
    if (filterMode === 'today') return { date: todayISO, tz: BST_TZ };
    if (filterMode === 'day')   return { date: selectedDay, tz: BST_TZ };
    if (filterMode === 'range') return { date_from: rangeFrom, date_to: rangeTo, tz: BST_TZ };
    return {};
  }, [filterMode, selectedDay, rangeFrom, rangeTo, todayISO]);

  const skipQuery = filterMode === 'range' && (!rangeFrom || !rangeTo || rangeFrom > rangeTo);

  const { data: rawStats = [], isLoading, isError, refetch } = useGetAgentStatsQuery(statsParams, {
    skip: skipQuery,
    pollingInterval: 60_000,
  });

  const agentStats = useMemo(
    () => [...rawStats].sort((a, b) => b.completed - a.completed),
    [rawStats]
  );
  const topId = agentStats.find(a => a.completed > 0)?.agent_id ?? null;

  const summary = useMemo(() => ({
    agents:     agentStats.length,
    total:      agentStats.reduce((s, a) => s + a.total, 0),
    completed:  agentStats.reduce((s, a) => s + a.completed, 0),
    inProgress: agentStats.reduce((s, a) => s + a.in_progress, 0),
    open:       agentStats.reduce((s, a) => s + a.pending, 0),
    ignored:    agentStats.reduce((s, a) => s + a.ignored, 0),
    daCount:    agentStats.reduce((s, a) => s + a.da_count, 0),
  }), [agentStats]);

  const filterLabel = useMemo(() => {
    if (filterMode === 'today') return `Today · ${new Date(todayISO + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    if (filterMode === 'day')   return new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (filterMode === 'range') return `${new Date(rangeFrom + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(rangeTo + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return 'All time';
  }, [filterMode, selectedDay, rangeFrom, rangeTo, todayISO]);

  const summaryStrip = [
    { label: 'Agents',      value: summary.agents,     color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-100'   },
    { label: 'Total',       value: summary.total,      color: 'text-gray-800',    bg: 'bg-white border-gray-200'         },
    { label: 'Completed',   value: summary.completed,  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
    { label: 'In Progress', value: summary.inProgress, color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-100'       },
    { label: 'Open',        value: summary.open,       color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-100'     },
    { label: 'Ignored',     value: summary.ignored,    color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200'     },
    { label: 'DA Count',    value: summary.daCount,    color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-100'   },
  ];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-5">

      {/* Header + filter */}
      <motion.div variants={staggerItem} className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-base font-black text-gray-900 leading-tight">Agent Performance</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{filterLabel}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5">
            {(['today', 'day', 'range', 'alltime'] as FilterMode[]).map(mode => (
              <button key={mode} onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  filterMode === mode ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}>
                {mode === 'alltime' ? 'All Time' : mode === 'range' ? 'Range' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          {filterMode === 'day' && (
            <input type="date" value={selectedDay} min={MIN_DATE} max={todayISO}
              onChange={e => setSelectedDay(e.target.value || todayISO)}
              className="text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white cursor-pointer focus:outline-none focus:border-indigo-300"
            />
          )}
          {filterMode === 'range' && (
            <div className="flex items-center gap-2">
              <input type="date" value={rangeFrom} min={MIN_DATE} max={rangeTo || todayISO}
                onChange={e => setRangeFrom(e.target.value || MIN_DATE)}
                className="text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white cursor-pointer focus:outline-none focus:border-indigo-300"
              />
              <span className="text-xs text-gray-400 font-medium">→</span>
              <input type="date" value={rangeTo} min={rangeFrom || MIN_DATE} max={todayISO}
                onChange={e => setRangeTo(e.target.value || todayISO)}
                className="text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white cursor-pointer focus:outline-none focus:border-indigo-300"
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* Summary strip */}
      <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
        {summaryStrip.map(s => (
          <div key={s.label} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border ${s.bg} shadow-sm`}>
            <span className={`text-[17px] font-black leading-none ${s.color}`}>{isLoading ? '—' : s.value}</span>
            <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wide">{s.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[280px] bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load agent stats" onRetry={refetch} />
      ) : agentStats.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-300 text-sm bg-white rounded-2xl border border-gray-100">
          No agents found
        </div>
      ) : (
        <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agentStats.map((stat, idx) => (
            <AgentCard key={stat.agent_id} stat={stat} idx={idx} isTop={stat.agent_id === topId} />
          ))}
        </motion.div>
      )}

    </motion.div>
  );
}
