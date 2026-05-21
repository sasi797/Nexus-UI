'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetBookingsQuery, useUpdateBookingMutation, usePatchBookingStatusMutation,
  BookingListItem,
} from '@/services/bookingsApi';
import { useGetAgentsQuery, Agent } from '@/services/agentsApi';
import { useGetDashboardStatsQuery } from '@/services/dashboardApi';
import ApiErrorState from '@/components/ApiErrorState';

type Tab = 'All' | 'Pending' | 'In Progress' | 'Completed';
const TABS: Tab[] = ['All', 'Pending', 'In Progress', 'Completed'];

/* ── helpers ── */
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
function extractName(email: string) {
  return email.split('@')[0].split(/[._+]/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

const SLA: Record<string, number> = { Urgent: 4, Standard: 8, Economy: 24 };
function dueIn(b: BookingListItem) {
  const dueAt = new Date(b.received_at).getTime() + (SLA[b.priority] ?? 8) * 3_600_000;
  const ms = dueAt - Date.now();
  if (ms <= 0) return 'Overdue';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `Due in ${Math.floor(h / 24)} days`;
  if (h >= 1) return `Due in ${h} hour${h !== 1 ? 's' : ''}`;
  return `Due in ${Math.floor((ms % 3_600_000) / 60_000)} min`;
}

/* ── priority ── */
const P_DOT: Record<string, string> = { Urgent: 'bg-red-500', Standard: 'bg-blue-500', Economy: 'bg-green-500' };
const P_TEXT: Record<string, string> = { Urgent: 'text-red-600', Standard: 'text-blue-600', Economy: 'text-green-600' };
const P_BG: Record<string, string> = {
  Urgent: 'bg-red-50 hover:bg-red-100/60',
  Standard: 'bg-blue-50 hover:bg-blue-100/60',
  Economy: 'bg-green-50 hover:bg-green-100/60',
};

/* ── status ── */
const S_CFG: Record<string, { dot: string; text: string; label: string; path: string }> = {
  Pending: {
    dot: 'bg-amber-400', text: 'text-amber-600', label: 'Open',
    path: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  'In Progress': {
    dot: 'bg-blue-400', text: 'text-blue-600', label: 'In Progress',
    path: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  },
  Completed: {
    dot: 'bg-gray-400', text: 'text-gray-500', label: 'Closed',
    path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

/* ── InlineDropdown ── */
function InlineDropdown({ trigger, children, align = 'right' }: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      {trigger(open, () => setOpen(v => !v))}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.1 }}
            className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 min-w-[160px]`}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DdItem({ label, active, onClick, left }: {
  label: React.ReactNode; active?: boolean; onClick: () => void; left?: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
      {left}{label}
      {active && <svg className="w-3 h-3 ml-auto text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
    </button>
  );
}

const Chevron = ({ cls = '' }: { cls?: string }) => (
  <svg className={`w-3 h-3 shrink-0 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
  </svg>
);

/* ── Custom filter dropdown (replaces native <select>) ── */
function FilterDropdown({ value, options, onChange }: {
  value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-medium bg-white border rounded-lg transition-all cursor-pointer ${
          open ? 'border-indigo-400 ring-2 ring-indigo-100 text-gray-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'
        }`}
      >
        <span className="truncate text-left">{value}</span>
        <Chevron cls={`text-gray-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-[60] overflow-hidden max-h-52 overflow-y-auto"
          >
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-[12px] font-medium transition-colors flex items-center gap-2 ${
                  value === opt
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {value === opt && (
                  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {value !== opt && <span className="w-3 shrink-0" />}
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Filter panel layout helpers ── */
function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="space-y-1.5">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-[11px] font-bold text-gray-600 hover:text-gray-900 transition-colors">
        {label}
        <Chevron cls={`text-gray-400 transition-transform duration-150 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-500">{label}</p>
      <FilterDropdown value={value} options={options} onChange={onChange} />
    </div>
  );
}

/* ── Booking row ── */
function BookingRow({ booking, agents }: { booking: BookingListItem; agents: Agent[] }) {
  const [updateBooking, { isLoading: upd }] = useUpdateBookingMutation();
  const [patchStatus, { isLoading: pat }] = usePatchBookingStatusMutation();
  const busy = upd || pat;
  const sc = S_CFG[booking.status] ?? S_CFG.Pending;
  const due = dueIn(booking);
  const overdue = due === 'Overdue';

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group ${busy ? 'opacity-60 pointer-events-none' : ''}`}>

      {/* Checkbox */}
      <input type="checkbox" onClick={e => e.stopPropagation()}
        className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer shrink-0 accent-indigo-600 opacity-30 group-hover:opacity-100 transition-opacity" />

      {/* Clickable → detail */}
      <Link href={`/dashboard/my-bookings/${booking.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(booking.sender_email)} flex items-center justify-center text-white text-[13px] font-bold shrink-0 shadow-sm`}>
          {booking.sender_email.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold text-gray-400 font-mono tracking-tight">{booking.id}</span>
            {booking.status === 'Pending' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 leading-none">New</span>
            )}
          </div>
          <p className="text-[13.5px] font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors leading-snug truncate">
            {booking.subject}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px] text-gray-400">
              {extractName(booking.sender_email)}
              <span className="mx-1.5 text-gray-200">·</span>
              <span className={overdue ? 'text-red-500 font-semibold' : ''}>{due}</span>
            </span>
          </div>
        </div>
      </Link>

      {/* Right meta — 3 stacked rows */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-[148px]">

        {/* Priority */}
        <InlineDropdown
          trigger={(open, toggle) => (
            <button onClick={toggle}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold w-full justify-end text-xs transition-colors ${open ? 'bg-gray-100' : P_BG[booking.priority]} ${P_TEXT[booking.priority] ?? 'text-gray-500'}`}>
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${P_DOT[booking.priority] ?? 'bg-gray-300'}`} />
              {booking.priority}
              <Chevron cls="text-current opacity-40" />
            </button>
          )}>
          {close => ['Urgent', 'Standard', 'Economy'].map(p => (
            <DdItem key={p} label={p} active={booking.priority === p}
              left={<span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${P_DOT[p] ?? 'bg-gray-300'}`} />}
              onClick={() => { updateBooking({ id: booking.id, body: { priority: p } }); close(); }} />
          ))}
        </InlineDropdown>

        {/* Agent */}
        <InlineDropdown
          trigger={(open, toggle) => (
            <button onClick={toggle}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-gray-500 w-full justify-end text-xs max-w-[160px] transition-colors ${open ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{booking.agent?.name ?? '—'}</span>
              <Chevron cls="text-gray-300" />
            </button>
          )}>
          {close => (
            <>
              <DdItem label="Unassign" active={!booking.agent}
                left={<span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400 font-bold shrink-0">—</span>}
                onClick={() => { updateBooking({ id: booking.id, body: { agent_id: undefined } }); close(); }} />
              {agents.map(a => (
                <DdItem key={a.id} label={a.name} active={booking.agent?.id === a.id}
                  left={
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(a.email)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                  }
                  onClick={() => { updateBooking({ id: booking.id, body: { agent_id: a.id } }); close(); }} />
              ))}
            </>
          )}
        </InlineDropdown>

        {/* Status */}
        <InlineDropdown
          trigger={(open, toggle) => (
            <button onClick={toggle}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold w-full justify-end text-xs transition-colors ${open ? 'bg-gray-100' : 'hover:bg-gray-50'} ${sc.text}`}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sc.path} />
              </svg>
              {sc.label}
              <Chevron cls="text-current opacity-40" />
            </button>
          )}>
          {close => ['Pending', 'In Progress', 'Completed'].map(s => (
            <DdItem key={s} label={S_CFG[s].label} active={booking.status === s}
              left={<span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${S_CFG[s].dot}`} />}
              onClick={() => { patchStatus({ id: booking.id, status: s }); close(); }} />
          ))}
        </InlineDropdown>

      </div>
    </div>
  );
}

const PAGE_SIZES = [10, 25, 50, 100];

/* ── Page ── */
export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [tabDir, setTabDir] = useState(0);
  const prevTabIdx = useRef(0);

  function handleTabChange(tab: Tab) {
    const newIdx = TABS.indexOf(tab);
    setTabDir(newIdx > prevTabIdx.current ? 1 : -1);
    prevTabIdx.current = newIdx;
    setActiveTab(tab);
  }

  const [sortBy, setSortBy] = useState('Date created');
  const [agentFilter, setAgentFilter] = useState('Any agent');
  const [sentimentFilter, setSentimentFilter] = useState('Any');
  const [createdFilter, setCreatedFilter] = useState('Last 30 days');
  const [closedAtFilter, setClosedAtFilter] = useState('Anytime');
  const [resolvedAtFilter, setResolvedAtFilter] = useState('Anytime');
  const [resDueFilter, setResDueFilter] = useState('Anytime');
  const [firstRespFilter, setFirstRespFilter] = useState('Anytime');
  const [nextRespFilter, setNextRespFilter] = useState('Anytime');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1); // 1-indexed to match backend

  /* Reset to page 1 whenever filters/tab/sort/pageSize change */
  useEffect(() => { setCurrentPage(1); }, [activeTab, agentFilter, sortBy, pageSize]);

  const status = activeTab === 'All' ? undefined : activeTab;
  const { data: agents = [] } = useGetAgentsQuery();
  const { data: stats } = useGetDashboardStatsQuery();
  const TAB_COUNTS: Record<Tab, number | undefined> = {
    All:          stats?.total_bookings,
    Pending:      stats?.pending,
    'In Progress': stats?.in_progress,
    Completed:    stats?.completed,
  };

  const agentId = agentFilter === 'Any agent' ? undefined : agents.find(a => a.name === agentFilter)?.id;

  const { data, isLoading, isFetching, isError, refetch } = useGetBookingsQuery({
    status,
    agent_id: agentId,
    page: currentPage,
    page_size: pageSize,
  });

  const sorted = [...(data?.items ?? [])].sort((a, b) => {
    if (sortBy === 'Priority') {
      const ord: Record<string, number> = { Urgent: 0, Standard: 1, Economy: 2 };
      return (ord[a.priority] ?? 3) - (ord[b.priority] ?? 3);
    }
    if (sortBy === 'Due date') {
      const due = (x: BookingListItem) => new Date(x.received_at).getTime() + (SLA[x.priority] ?? 8) * 3_600_000;
      return due(a) - due(b);
    }
    return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
  });

  const totalCount = data?.total      ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const startIdx   = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx     = Math.min(currentPage * pageSize, totalCount);

  const agentOpts = ['Any agent', ...agents.map(a => a.name)];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="flex gap-4 h-full min-h-0">

      {/* ── Main ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">

        {/* Page header */}
        {/* <motion.div variants={staggerItem}>
          <h1 className="text-xl font-bold text-gray-900">All tickets</h1>
        </motion.div> */}

        {/* Sort / Layout bar */}
        <motion.div variants={staggerItem} className="flex items-center gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Sort by:</span>
            <InlineDropdown align="left"
              trigger={(open, toggle) => (
                <button onClick={toggle}
                  className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                  {sortBy} <Chevron cls="text-indigo-400" />
                </button>
              )}>
              {close => ['Date created', 'Priority', 'Due date'].map(s => (
                <DdItem key={s} label={s} active={sortBy === s} onClick={() => { setSortBy(s); close(); }} />
              ))}
            </InlineDropdown>
          </div>
          <span className="text-gray-200">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Layout:</span>
            <span className="font-semibold text-gray-700">Card view</span>
          </div>
        </motion.div>

        {/* Tab bar */}
        <motion.div variants={staggerItem} className="flex items-center gap-0.5 border-b border-gray-200">
          {TABS.map(tab => (
            <button key={tab} onClick={() => handleTabChange(tab)}
              className={`relative px-4 py-2.5 text-[13px] font-semibold transition-colors duration-150 ${activeTab === tab ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-700'}`}>
              {activeTab === tab && (
                <motion.div
                  layoutId="booking-tab-bg"
                  className="absolute inset-x-0 top-1 bottom-1 bg-indigo-50 rounded-lg"
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {tab}
                {TAB_COUNTS[tab] !== undefined && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                    activeTab === tab ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {TAB_COUNTS[tab]}
                  </span>
                )}
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="booking-tab-line"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                />
              )}
            </button>
          ))}
        </motion.div>

        {/* Ticket list */}
        <motion.div variants={staggerItem} className="flex-1 min-h-0">
          <AnimatePresence mode="wait" custom={tabDir}>
            <motion.div
              key={activeTab}
              custom={tabDir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 22 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d * -14 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.19, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {isError ? (
                <ApiErrorState title="Failed to load tickets" onRetry={refetch} />
              ) : isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="w-4 h-4 bg-gray-100 rounded animate-pulse shrink-0" />
                      <div className="w-10 h-10 bg-gray-100 rounded-full animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-2.5 w-14 bg-gray-100 rounded animate-pulse" />
                        <div className="h-3.5 w-2/3 bg-gray-100 rounded animate-pulse" />
                        <div className="h-2.5 w-1/3 bg-gray-100 rounded animate-pulse" />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="h-5 w-20 bg-gray-100 rounded-lg animate-pulse" />
                        <div className="h-5 w-24 bg-gray-100 rounded-lg animate-pulse" />
                        <div className="h-5 w-16 bg-gray-100 rounded-lg animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm font-semibold text-gray-400">No {activeTab === 'All' ? '' : activeTab} tickets</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sorted.map(b => <BookingRow key={b.id} booking={b} agents={agents} />)}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

      </div>

      {/* ── Filters sidebar ── */}
      <motion.div variants={staggerItem} className="w-80 shrink-0 flex flex-col gap-3">

        {/* Export + pagination — top-right corner */}
        <div className="flex items-center justify-end gap-1.5 text-sm text-gray-500 mt-6">
          <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 font-semibold hover:bg-gray-50 transition-colors shadow-sm">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>

          <InlineDropdown align="right"
            trigger={(open, toggle) => (
              <button onClick={toggle}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-gray-600 font-semibold bg-white hover:bg-gray-50 transition-colors shadow-sm ${open ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'}`}>
                {pageSize}/pg
                <Chevron cls={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            )}>
            {close => PAGE_SIZES.map(n => (
              <DdItem key={n} label={`${n} per page`} active={pageSize === n}
                onClick={() => { setPageSize(n); close(); }} />
            ))}
          </InlineDropdown>

          {isFetching && <div className="w-2.5 h-2.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />}

          <span className="text-gray-400 font-medium tabular-nums text-[12px] whitespace-nowrap">
            {totalCount === 0 ? '0' : `${startIdx}–${endIdx}`} of {totalCount}
          </span>

          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="p-0.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>

          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="p-0.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4 sticky top-0 max-h-[calc(100vh-7rem)] overflow-y-auto mt-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Filters</span>
            <button className="p-1 rounded hover:bg-gray-100 transition-colors">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>

          {/* Agents */}
          <FilterSection label="Agents">
            <FilterDropdown value={agentFilter} options={agentOpts} onChange={setAgentFilter} />
          </FilterSection>

          {/* Groups */}
          <FilterSection label="Groups">
            <FilterDropdown value="Any agent" options={['Any agent']} onChange={() => {}} />
          </FilterSection>

          <div className="border-t border-gray-100" />

          <FilterSelect label="Sentiment" value={sentimentFilter}
            options={['Any', 'Positive', 'Neutral', 'Negative']} onChange={setSentimentFilter} />
          <FilterSelect label="Created" value={createdFilter}
            options={['Last 30 days', 'Last 7 days', 'Today', 'Anytime']} onChange={setCreatedFilter} />
          <FilterSelect label="Closed at" value={closedAtFilter}
            options={['Anytime', 'Today', 'This week', 'This month']} onChange={setClosedAtFilter} />
          <FilterSelect label="Resolved at" value={resolvedAtFilter}
            options={['Anytime', 'Today', 'This week', 'This month']} onChange={setResolvedAtFilter} />
          <FilterSelect label="Resolution due by" value={resDueFilter}
            options={['Anytime', 'Overdue', 'Today', 'This week']} onChange={setResDueFilter} />
          <FilterSelect label="First response due by" value={firstRespFilter}
            options={['Anytime', 'Overdue', 'Today', 'This week']} onChange={setFirstRespFilter} />
          <FilterSelect label="Next response due by" value={nextRespFilter}
            options={['Anytime', 'Overdue', 'Today', 'This week']} onChange={setNextRespFilter} />
        </div>
      </motion.div>

    </motion.div>
  );
}
