'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetBookingsQuery, useUpdateBookingMutation, usePatchBookingStatusMutation,
  useAssignAgentMutation, useAddSupportAgentMutation, useRemoveSupportAgentMutation,
  useMarkBookingReadMutation, useMarkAllBookingsReadMutation,
  BookingListItem,
} from '@/services/bookingsApi';
import { useGetAgentsQuery, Agent } from '@/services/agentsApi';
import { useGetDashboardStatsQuery } from '@/services/dashboardApi';
import { useGetBookingConfigQuery, getColor, BookingConfigItem } from '@/services/bookingConfigApi';
import { useAppSelector } from '@/store/hooks';
import ApiErrorState from '@/components/ApiErrorState';
import { useAlertSound } from '@/hooks/useAlertSound';

type Tab = 'All' | 'Pending' | 'In Progress' | 'Completed' | 'Ignored';
const TABS: Tab[] = ['All', 'Pending', 'In Progress', 'Completed', 'Ignored'];
const TAB_LABEL: Record<Tab, string> = { All: 'All', Pending: 'Open', 'In Progress': 'In Progress', Completed: 'Completed', Ignored: 'Ignored' };

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
const BADGE_STYLES = [
  { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-700',     hover: 'hover:bg-sky-100 hover:border-sky-300',     activeBg: 'bg-sky-100',     activeBorder: 'border-sky-300'     },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  hover: 'hover:bg-violet-100 hover:border-violet-300',  activeBg: 'bg-violet-100',  activeBorder: 'border-violet-300'  },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', hover: 'hover:bg-emerald-100 hover:border-emerald-300', activeBg: 'bg-emerald-100', activeBorder: 'border-emerald-300' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   hover: 'hover:bg-amber-100 hover:border-amber-300',   activeBg: 'bg-amber-100',   activeBorder: 'border-amber-300'   },
  { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    hover: 'hover:bg-rose-100 hover:border-rose-300',    activeBg: 'bg-rose-100',    activeBorder: 'border-rose-300'    },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  hover: 'hover:bg-indigo-100 hover:border-indigo-300',  activeBg: 'bg-indigo-100',  activeBorder: 'border-indigo-300'  },
];
function badgeStyle(str: string) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return BADGE_STYLES[h % BADGE_STYLES.length];
}
function extractName(email: string) {
  return email.split('@')[0].split(/[._+]/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function formatHMS(ms: number): string {
  const totalSecs = Math.floor(Math.max(ms, 0) / 1000);
  const s = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const m = totalMins % 60;
  const h = Math.floor(totalMins / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatReceivedAt(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mo} - ${day} ${hh}:${mm}`;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString());
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  const d = new Date(key);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}, ${dd}/${mo}`;
}

function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60_000);
  const mins = totalMins % 60;
  const hours = Math.floor(totalMins / 60) % 24;
  const days = Math.floor(totalMins / 1440);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${totalMins}m`;
}

function elapsedCfg(ms: number) {
  const mins = ms / 60_000;
  if (mins <= 15) return { text: 'text-emerald-700', bg: 'bg-emerald-100 ring-emerald-300', dot: 'bg-emerald-500', label: 'Low' };
  if (mins <= 30) return { text: 'text-amber-700',   bg: 'bg-amber-100 ring-amber-300',     dot: 'bg-amber-500',   label: 'Med' };
  return              { text: 'text-red-700',         bg: 'bg-red-100 ring-red-300',         dot: 'bg-red-600',     label: 'High' };
}

function ElapsedBadge({ booking }: { booking: BookingListItem }) {
  const done = booking.status === 'Completed';
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [done]);
  const end = done && booking.completed_at ? new Date(booking.completed_at).getTime() : now;
  const ms = end - new Date(booking.received_at).getTime();
  if (ms < 0) return null;

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 ring-1 ring-gray-200 text-[10px] font-mono font-semibold text-gray-500">
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        {formatHMS(ms)}
      </span>
    );
  }

  const cfg = elapsedCfg(ms);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ring-1 text-[11px] font-mono font-bold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${cfg.dot}`} />
      {formatHMS(ms)}
      <span className="text-[11px] font-semibold opacity-60">{cfg.label}</span>
    </span>
  );
}

function DaTagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValRef = useRef('');
  const tags = value.split(',').map(s => s.trim()).filter(Boolean);

  function setInput(v: string) {
    inputValRef.current = v;
    setInputVal(v);
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) { setInput(''); return; }
    onChange([...tags, tag].join(', '));
    setInput('');
  }

  function removeTag(idx: number) {
    onChange(tags.filter((_, i) => i !== idx).join(', '));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      addTag(inputValRef.current);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (e.key === 'Backspace' && !inputValRef.current && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <div
      className="min-h-[44px] w-full px-2 py-1.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-emerald-300 focus-within:border-emerald-400 flex flex-wrap gap-1.5 items-center cursor-text transition-all"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-mono font-semibold shrink-0">
          {tag}
          <button type="button" onClick={() => removeTag(i)}
            className="w-3.5 h-3.5 flex items-center justify-center rounded text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100 transition-colors">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputVal}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputValRef.current)}
        placeholder={tags.length === 0 ? 'Type DA number, press Enter to add…' : '+ Add another'}
        className="flex-1 min-w-[160px] text-sm outline-none bg-transparent placeholder:text-gray-300 font-mono py-0.5"
      />
    </div>
  );
}

function DaBadges({ daNumber }: { daNumber: string }) {
  const all = daNumber.split(',').map(s => s.trim()).filter(Boolean);
  const shown = all.slice(0, 3);
  const rest = all.slice(3);
  return (
    <>
      {shown.map(da => (
        <span key={da} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono leading-none border border-emerald-200 whitespace-nowrap">
          {da}
        </span>
      ))}
      {rest.length > 0 && (
        <span className="relative group/da inline-flex">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-mono leading-none border border-emerald-300 cursor-default whitespace-nowrap">
            +{rest.length} more
          </span>
          <div className="absolute left-0 top-full mt-1.5 z-[100] hidden group-hover/da:block bg-gray-900 text-white rounded-xl p-2.5 shadow-xl min-w-max space-y-1">
            {all.map(da => (
              <div key={da} className="text-[10px] font-mono font-semibold tracking-tight">{da}</div>
            ))}
          </div>
        </span>
      )}
    </>
  );
}

const SLA: Record<string, number> = { 'Very Urgent': 4, Urgent: 8, 'Not Urgent': 24 };
function dueIn(b: BookingListItem) {
  const dueAt = new Date(b.received_at).getTime() + (SLA[b.priority] ?? 8) * 3_600_000;
  const ms = dueAt - Date.now();
  if (ms <= 0) return 'Overdue';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `Due in ${Math.floor(h / 24)} days`;
  if (h >= 1) return `Due in ${h} hour${h !== 1 ? 's' : ''}`;
  return `Due in ${Math.floor((ms % 3_600_000) / 60_000)} min`;
}

/* Status icon paths */
const S_PATH: Record<string, string> = {
  Pending:      'M13 10V3L4 14h7v7l9-11h-7z',
  'In Progress':'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  Completed:   'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  Ignored:     'M18.364 5.636l-12.728 12.728M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const P_PATH: Record<string, string> = {
  'Very Urgent': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  'Urgent':      'M5 10l7-7m0 0l7 7m-7-7v18',
  'Not Urgent':  'M20 12H4',
};

function parseTags(raw: string | null | undefined, tagValues: string[]): string[] {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(s => tagValues.includes(s));
}
function serializeTags(tags: string[]): string { return tags.join(','); }
function TagBadges({ tags, tagConfig }: { tags: string[]; tagConfig: { value: string; label: string; color: string }[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map(t => {
        const cfg = tagConfig.find(c => c.value === t);
        const c = getColor(cfg?.color ?? 'gray');
        return (
          <span key={t} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${c.bg} ${c.text} ${c.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
            {cfg?.label ?? t}
          </span>
        );
      })}
    </div>
  );
}

/* ── InlineDropdown ── */
function InlineDropdown({ trigger, children, align = 'right', direction = 'auto' }: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
  direction?: 'down' | 'up' | 'auto';
}) {
  const [open, setOpen] = useState(false);
  const [resolvedDir, setResolvedDir] = useState<'up' | 'down'>('down');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (direction === 'up') setResolvedDir(spaceAbove >= 220 ? 'up' : 'down');
      else if (direction === 'down') setResolvedDir(spaceBelow >= 220 ? 'down' : 'up');
      else setResolvedDir(spaceBelow >= 220 || spaceBelow >= spaceAbove ? 'down' : 'up');
    }
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, direction]);
  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      {trigger(open, () => setOpen(v => !v))}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: resolvedDir === 'up' ? 4 : -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: resolvedDir === 'up' ? 4 : -4, scale: 0.97 }} transition={{ duration: 0.1 }}
            className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} ${resolvedDir === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 min-w-[160px]`}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DdItem({ label, active, onClick, left, disabled }: {
  label: React.ReactNode; active?: boolean; onClick: () => void; left?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${disabled ? 'opacity-40 cursor-not-allowed text-gray-400' : active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
      {left}{label}
      {active && !disabled && <svg className="w-3 h-3 ml-auto text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
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

/* ── Tooltip ── */
function Tooltip({
  label, sub, children, className = '', align = 'center', disabled = false,
}: {
  label: string; sub?: string; children: React.ReactNode;
  className?: string; align?: 'center' | 'left' | 'right'; disabled?: boolean;
}) {
  const boxAlign =
    align === 'left'  ? 'left-0' :
    align === 'right' ? 'right-0' :
    'left-1/2 -translate-x-1/2';
  const arrowAlign =
    align === 'left'  ? 'left-3' :
    align === 'right' ? 'right-3' :
    'left-1/2 -translate-x-1/2';
  return (
    <div className={`relative group/tt ${className}`}>
      {children}
      {!disabled && (
        <div className={`pointer-events-none absolute bottom-full mb-2.5 z-[300] opacity-0 group-hover/tt:opacity-100 translate-y-1 group-hover/tt:translate-y-0 transition-all duration-150 ${boxAlign}`}>
          <div className="bg-gray-950 text-white rounded-xl shadow-2xl overflow-hidden min-w-max border border-white/10">
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold leading-none">{label}</p>
              {sub && <p className="text-[10px] text-gray-400 mt-1.5 leading-none">{sub}</p>}
            </div>
          </div>
          <div className={`absolute -bottom-1 w-2 h-2 bg-gray-950 rotate-45 rounded-sm border-r border-b border-white/10 ${arrowAlign}`} />
        </div>
      )}
    </div>
  );
}

/* ── Filter panel layout helpers ── */
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
function BookingRow({ booking, agents, myUserEmail, bookingConfig, onMarkRead, highlighted }: { booking: BookingListItem; agents: Agent[]; myUserEmail: string | undefined; bookingConfig: ReturnType<typeof useGetBookingConfigQuery>['data']; onMarkRead: (id: string) => void; highlighted?: boolean }) {
  const isUnread = !booking.is_read;
  const isReply = booking.has_reply;
  const [updateBooking, { isLoading: upd }] = useUpdateBookingMutation();
  const [assignAgent] = useAssignAgentMutation();
  const [patchStatus, { isLoading: pat }] = usePatchBookingStatusMutation();
  const [addSupport] = useAddSupportAgentMutation();
  const [removeSupport] = useRemoveSupportAgentMutation();
  const [showDa, setShowDa] = useState(false);
  const [daNumber, setDaNumber] = useState('');
  const [daDesc, setDaDesc] = useState('');
  const [daError, setDaError] = useState('');
  const busy = upd || pat;

  const cfgItems = bookingConfig ?? [];
  const statusCfg = cfgItems.filter((c: BookingConfigItem) => c.type === 'status');
  const priorityCfg = cfgItems.filter((c: BookingConfigItem) => c.type === 'priority');
  const tagCfg = cfgItems.filter((c: BookingConfigItem) => c.type === 'tag');
  const tagValues = tagCfg.map((t: BookingConfigItem) => t.value);
  const statusItem = statusCfg.find((s: BookingConfigItem) => s.value === booking.status);
  const sc = statusItem ? { dot: getColor(statusItem.color).dot, text: getColor(statusItem.color).text, bg: getColor(statusItem.color).bg, border: getColor(statusItem.color).border, label: statusItem.label, path: S_PATH[statusItem.value] ?? S_PATH.Completed } : { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200', label: booking.status, path: S_PATH.Completed };

  const isMine = !!myUserEmail && booking.agent?.email === myUserEmail;
  const supportIds = new Set(booking.support_agents.map(a => a.id));
  const availableForSupport = agents.filter(a => a.id !== booking.agent?.id && !supportIds.has(a.id));

  function handleStatusClick(s: string, close: () => void) {
    close();
    if (s === booking.status) return;
    if (s === 'Completed') { setDaNumber(booking.da_number ?? ''); setDaDesc(booking.da_description ?? ''); setShowDa(true); return; }
    patchStatus({ id: booking.id, status: s });
  }

  async function submitDa() {
    setDaError('');
    try {
      await patchStatus({ id: booking.id, status: 'Completed', da_number: daNumber || undefined, da_description: daDesc || undefined }).unwrap();
      setShowDa(false);
    } catch {
      setDaError('Failed to complete booking. Please try again.');
    }
  }

  const isCompleted = booking.status === 'Completed';

  return (
    <>
    {/* ── Mobile card (< md) ── */}
    <Link
      href={`/dashboard/my-bookings/${booking.id}`}
      className={`md:hidden block rounded-lg border shadow-sm active:opacity-75 transition-all ${busy ? 'opacity-60 pointer-events-none' : ''} ${isUnread ? (isReply ? 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-400' : 'bg-gradient-to-br from-slate-100 to-gray-200 border-slate-400') : isCompleted ? 'bg-gradient-to-br from-white to-emerald-200 border-emerald-300' : 'bg-white border-gray-100'}`}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] font-bold font-mono text-gray-400 tracking-tight">{booking.id}</span>
          {(() => { const pi = priorityCfg.find((p: BookingConfigItem) => p.value === booking.priority); const pc = getColor(pi?.color ?? 'gray'); return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${pc.bg} ${pc.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pc.dot}`} />
              {pi?.label ?? booking.priority}
            </span>
          ); })()}
        </div>
        <p className="text-[13.5px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-2">
          {booking.subject}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400 truncate flex-1 mr-3">{extractName(booking.sender_email)}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[11px] font-bold ${sc.text}`}>{sc.label}</span>
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        {isCompleted && booking.da_number && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <DaBadges daNumber={booking.da_number} />
          </div>
        )}
        {isUnread && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onMarkRead(booking.id); }}
            className={`mt-2 flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium transition-colors ${isReply ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-500'}`}
          >
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            Mark read
          </button>
        )}
      </div>
    </Link>

    {/* ── Desktop row (≥ md) ── */}
    <div className={`hidden md:flex items-center gap-4 px-3 py-2 rounded-xl border shadow-sm hover:shadow-lg transition-all group ${busy ? 'opacity-60 pointer-events-none' : ''} ${highlighted ? 'ring-2 ring-indigo-400 ring-offset-1' : ''} ${isUnread ? (isReply ? 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-400 hover:border-amber-500' : 'bg-gradient-to-br from-slate-100 to-gray-200 border-slate-400 hover:border-slate-500') : isCompleted ? 'bg-gradient-to-br from-white to-emerald-200 border-emerald-300 hover:border-emerald-300' : 'bg-white border-gray-100 hover:border-gray-200'}`}>

      {/* Avatar */}
      <Link href={`/dashboard/my-bookings/${booking.id}`} className="shrink-0" onClick={() => { sessionStorage.setItem('bts:scroll-y', String(document.getElementById('main-scroll')?.scrollTop ?? 0)); sessionStorage.setItem('bts:last-booking', booking.id); }}>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${avatarColor(booking.sender_email)} flex items-center justify-center text-white text-[14px] font-bold shadow-sm`}>
          {booking.sender_email.charAt(0).toUpperCase()}
        </div>
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Rows 1+2 — linked to detail */}
        <Link href={`/dashboard/my-bookings/${booking.id}`} className="block" onClick={() => { sessionStorage.setItem('bts:scroll-y', String(document.getElementById('main-scroll')?.scrollTop ?? 0)); sessionStorage.setItem('bts:last-booking', booking.id); }}>
          {(isCompleted && booking.da_number || parseTags(booking.tags, tagValues).length > 0) && (
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {isCompleted && booking.da_number && <DaBadges daNumber={booking.da_number} />}
              <TagBadges tags={parseTags(booking.tags, tagValues)} tagConfig={tagCfg} />
            </div>
          )}
          <p className="text-[12px] font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors leading-snug truncate flex items-center gap-1.5">
            <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            {booking.subject}
          </p>
        </Link>

        {/* Row 3: agent + support — not inside link */}
        <div className="flex items-center gap-3 mt-2" onClick={e => e.stopPropagation()}>
          {/* Received time */}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md shrink-0 border border-gray-200">
            <svg className="w-3 h-3 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatReceivedAt(booking.received_at)}
          </span>
          {/* Agent */}
          {isMine ? (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-900 bg-indigo-200 border border-indigo-400 rounded-md px-1.5 py-0.5 shrink-0">
              <svg className="w-3 h-3 text-indigo-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>You</span>
              <svg className="w-2.5 h-2.5 text-indigo-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
          ) : (
            <InlineDropdown align="left"
              trigger={(open, toggle) => {
                const bs = booking.agent ? badgeStyle(booking.agent.email) : null;
                const btnCls = !booking.agent
                  ? `border border-dashed border-gray-200 text-gray-400 ${open ? 'bg-gray-100' : 'hover:bg-gray-50'}`
                  : open
                  ? `border ${bs!.activeBg} ${bs!.activeBorder} ${bs!.text}`
                  : `border ${bs!.bg} ${bs!.border} ${bs!.text} ${bs!.hover}`;
                return (
                <button onClick={toggle}
                  className={`flex items-center gap-1 text-[11px] font-medium shrink-0 rounded-md px-1.5 py-0.5 transition-colors ${btnCls}`}>
                  {booking.agent ? (
                    <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${avatarColor(booking.agent.email)} flex items-center justify-center text-white text-[8px] font-bold shrink-0`}>
                      {booking.agent.name.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                  <span className="truncate max-w-[80px]">{booking.agent?.name ?? '—'}</span>
                  <Chevron cls="shrink-0" />
                </button>
                );
              }}>
              {close => (
                <>
                  <DdItem label="Unassign" active={!booking.agent}
                    left={<span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400 font-bold shrink-0">—</span>}
                    onClick={() => { assignAgent({ id: booking.id, agent_id: null }); close(); }} />
                  <div className="max-h-48 overflow-y-auto">
                    {agents.map(a => (
                      <DdItem key={a.id} label={a.name} active={booking.agent?.id === a.id}
                        left={<div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(a.email)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>{a.name.charAt(0).toUpperCase()}</div>}
                        onClick={() => { assignAgent({ id: booking.id, agent_id: a.id }); close(); }} />
                    ))}
                  </div>
                </>
              )}
            </InlineDropdown>
          )}

          {/* Support agents */}
          <div className="flex items-center gap-1">
            {booking.support_agents.map(a => (
              <button key={a.id}
                title={booking.status === 'Completed' ? a.name : `${a.name} — click to remove`}
                disabled={booking.status === 'Completed'}
                onClick={() => { removeSupport({ id: booking.id, agent_id: a.id }); }}
                className="relative group/sa shrink-0 disabled:cursor-default">
                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(a.email)} flex items-center justify-center text-white text-[8px] font-bold ring-1 ring-white`}>
                  {a.name.charAt(0).toUpperCase()}
                </div>
                {booking.status !== 'Completed' && (
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-400 rounded-full hidden group-hover/sa:flex items-center justify-center text-white text-[7px] font-bold leading-none">×</div>
                )}
              </button>
            ))}
            {availableForSupport.length > 0 && booking.status !== 'Completed' && (
              <InlineDropdown align="left"
                trigger={(open, toggle) => (
                  <Tooltip
                    label="Add support agent"
                    sub={`${availableForSupport.length} agent${availableForSupport.length > 1 ? 's' : ''} available`}
                    align="left" disabled={open}
                  >
                    <button onClick={toggle}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-semibold transition-colors shrink-0 ${open ? 'border-violet-400 text-violet-600 bg-violet-50' : 'border-gray-400 text-gray-600 bg-gray-50 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50'}`}>
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add</span>
                    </button>
                  </Tooltip>
                )}>
                {close => (
                  <div className="max-h-48 overflow-y-auto">
                    {availableForSupport.map(a => (
                      <DdItem key={a.id} label={a.name}
                        left={<div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(a.email)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>{a.name.charAt(0).toUpperCase()}</div>}
                        onClick={() => { addSupport({ id: booking.id, agent_id: a.id }); close(); }} />
                    ))}
                  </div>
                )}
              </InlineDropdown>
            )}
          </div>
        </div>
      </div>

      {/* Timer */}
      <Tooltip
        label={isCompleted ? 'Resolution time' : 'Elapsed time'}
        sub={isCompleted ? 'Total time taken to complete' : 'Time since received · updates live'}
        className="shrink-0"
      >
        <div className="flex flex-col items-center justify-center px-3 gap-1">
          <ElapsedBadge booking={booking} />
        </div>
      </Tooltip>

      {/* Right meta — priority / status / tags */}
      <div className="flex flex-col items-end gap-1 shrink-0 min-w-[130px]">

        {/* Priority */}
        {(() => {
          const pi = priorityCfg.find((p: BookingConfigItem) => p.label === booking.priority || p.value === booking.priority);
          const pc = getColor(pi?.color ?? 'gray');
          return (
            <InlineDropdown direction="auto"
              trigger={(open, toggle) => (
                <Tooltip
                  label={`Priority: ${pi?.label ?? booking.priority}`}
                  sub="Click to change priority"
                  align="right" disabled={open} className="w-full"
                >
                  <button onClick={toggle}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg w-full justify-end transition-colors ${(pi?.label === 'Very Urgent' || pi?.label === 'Urgent') ? (open ? 'bg-red-200' : 'bg-red-100 hover:bg-red-200') : (open ? 'bg-gray-100' : 'hover:bg-gray-50')}`}>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-900">
                      <svg className={`w-3 h-3 shrink-0 ${pc.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={P_PATH[pi?.label ?? ''] ?? P_PATH['Not Urgent']} />
                      </svg>
                      {pi?.label ?? booking.priority}
                    </span>
                    <Chevron cls="text-gray-600 ml-0.5" />
                  </button>
                </Tooltip>
              )}>
              {close => priorityCfg.map((p: BookingConfigItem) => {
                const cc = getColor(p.color);
                return (
                  <DdItem key={p.value} label={p.label} active={booking.priority === p.label || booking.priority === p.value}
                    left={<span className={`w-2 h-2 rounded-full shrink-0 ${cc.dot}`} />}
                    onClick={() => { updateBooking({ id: booking.id, body: { subject: booking.subject, sender_email: booking.sender_email, priority: p.label } }); close(); }} />
                );
              })}
            </InlineDropdown>
          );
        })()}

        {/* Status */}
        <InlineDropdown direction="auto"
          trigger={(open, toggle) => (
            <Tooltip
              label={`Status: ${sc.label}`}
              sub="Click to change status"
              align="right" disabled={open} className="w-full"
            >
              <button onClick={toggle}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg w-full justify-end transition-colors ${open ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-900">
                  <svg className={`w-3 h-3 shrink-0 ${sc.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sc.path} />
                  </svg>
                  {sc.label}
                </span>
                <Chevron cls="text-gray-600 ml-0.5" />
              </button>
            </Tooltip>
          )}>
          {close => statusCfg.map((s: BookingConfigItem) => {
            const cc = getColor(s.color);
            return (
              <DdItem key={s.value} label={s.label} active={booking.status === s.value}
                left={<span className={`w-2 h-2 rounded-full shrink-0 ${cc.dot}`} />}
                onClick={() => handleStatusClick(s.value, close)} />
            );
          })}
        </InlineDropdown>

        {/* Tags */}
        <InlineDropdown align="right" direction="auto"
          trigger={(open, toggle) => {
            const activeTags = parseTags(booking.tags, tagValues);
            const tagLabels = activeTags.map(t => tagCfg.find((c: BookingConfigItem) => c.value === t)?.label ?? t);
            return (
              <Tooltip
                label={tagLabels.length > 0 ? tagLabels.join(', ') : 'No tags assigned'}
                sub="Click to manage tags"
                align="right" disabled={open} className="w-full"
              >
              <button onClick={toggle}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg w-full justify-end transition-colors ${open ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                <svg className="w-3 h-3 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {activeTags.length === 0 ? (
                  <span className="text-[11px] text-gray-900 font-medium">Tags</span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {activeTags.map(t => {
                      const cfg = tagCfg.find((c: BookingConfigItem) => c.value === t);
                      const c = getColor(cfg?.color ?? 'gray');
                      return <span key={t} className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />;
                    })}
                    <span className="text-[11px] font-semibold text-gray-900 ml-0.5">{activeTags.length}</span>
                  </span>
                )}
                <Chevron cls="text-gray-600" />
              </button>
              </Tooltip>
            );
          }}>
          {_close => (
            <div className="py-1 min-w-[140px] max-h-52 overflow-y-auto">
              {tagCfg.map((tag: BookingConfigItem) => {
                const activeTags = parseTags(booking.tags, tagValues);
                const active = activeTags.includes(tag.value);
                const c = getColor(tag.color);
                return (
                  <button key={tag.value}
                    onClick={() => {
                      const next = active ? activeTags.filter(t => t !== tag.value) : [...activeTags, tag.value];
                      updateBooking({ id: booking.id, body: { subject: booking.subject, sender_email: booking.sender_email, tags: serializeTags(next) } });
                      _close();
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${active ? `${c.bg} ${c.text}` : 'text-gray-600 hover:bg-gray-50'}`}>
                    <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${active ? c.dot : 'bg-gray-200'}`} />
                    {tag.label}
                    {active && <svg className="w-3 h-3 ml-auto text-current shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                );
              })}
            </div>
          )}
        </InlineDropdown>

        {/* Mark as read */}
        {isUnread && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onMarkRead(booking.id); }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium transition-colors self-end ${isReply ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 hover:text-amber-800' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-500 hover:text-slate-700'}`}
          >
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            Mark read
          </button>
        )}

      </div>
    </div>

    {/* DA number modal */}
    <AnimatePresence>
      {showDa && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowDa(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.15 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Completing overlay */}
            {pat && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-[2px] rounded-2xl">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-600 animate-spin" />
                  <div className="absolute inset-1.5 rounded-full border-4 border-transparent border-t-teal-400 animate-spin [animation-direction:reverse] [animation-duration:600ms]" />
                  <div className="absolute inset-3 rounded-full bg-emerald-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <p className="mt-4 text-sm font-bold text-gray-800">Completing Booking…</p>
                <p className="text-xs text-gray-400 mt-0.5">Please wait</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Complete Booking</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Optionally enter the DA number and description</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">DA Number</label>
                <DaTagInput value={daNumber} onChange={setDaNumber} />
                <p className="text-[10px] text-gray-400 mt-1">Press Enter or Tab after each number to add it</p>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">DA Description</label>
                <textarea
                  value={daDesc} onChange={e => setDaDesc(e.target.value)}
                  rows={3} placeholder="Brief description of the delivery arrangement…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder:text-gray-300 resize-none"
                />
              </div>
            </div>

            {daError && (
              <p className="text-[11px] text-red-500 font-medium -mb-1">{daError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowDa(false); setDaError(''); }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={submitDa} disabled={pat}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                {pat ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

const PAGE_SIZES = [10, 25, 50, 100];

/* ── Page ── */
export default function MyBookingsPage() {
  const user = useAppSelector(state => state.auth.user);
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [tabDir, setTabDir] = useState(0);
  const prevTabIdx = useRef(0);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const scrollRestored = useRef(false);
  const pendingScroll = useRef<{ y: number; id: string | null } | null>(null);

  useEffect(() => {
    if (scrollRestored.current) return;
    scrollRestored.current = true;
    const y = sessionStorage.getItem('bts:scroll-y');
    const id = sessionStorage.getItem('bts:last-booking');
    sessionStorage.removeItem('bts:scroll-y');
    sessionStorage.removeItem('bts:last-booking');
    if (y) pendingScroll.current = { y: Number(y), id };
  }, []);

  function handleTabChange(tab: Tab) {
    const newIdx = TABS.indexOf(tab);
    setTabDir(newIdx > prevTabIdx.current ? 1 : -1);
    prevTabIdx.current = newIdx;
    setActiveTab(tab);
  }

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sortBy, setSortBy] = useState('Date created');
  const [priorityFilter, setPriorityFilter] = useState('Any priority');
  const [createdFilter, setCreatedFilter] = useState('Anytime');
  const [closedAtFilter, setClosedAtFilter] = useState('Anytime');
  const [fromFilter, setFromFilter] = useState('Any');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* Reset to page 1 whenever filters/tab/sort/pageSize change */
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, priorityFilter, fromFilter, createdFilter, closedAtFilter, sortBy, pageSize, debouncedSearch]);

  const status = activeTab === 'All' ? undefined : activeTab;
  const { data: agents = [], isLoading: agentsLoading } = useGetAgentsQuery();
  useGetDashboardStatsQuery(); // keep cache warm; not used for tab counts here
  const { data: bookingConfig } = useGetBookingConfigQuery();

  // Always filter to the current user's own bookings.
  // agentsLoading guard prevents a flash of "all bookings" before agents resolve.
  const myAgentId = agents.find(a => a.email === user?.email)?.id;
  const hasNoAgentProfile = !agentsLoading && !myAgentId;
  const priority = priorityFilter === 'Any priority' ? undefined : priorityFilter;

  const CREATED_MAP: Record<string, string | undefined> = {
    'Today': 'today', 'Last 7 days': '7d', 'Last 30 days': '30d', 'Anytime': undefined,
  };
  const CLOSED_MAP: Record<string, string | undefined> = {
    'Today': 'today', 'This week': 'week', 'This month': 'month', 'Anytime': undefined,
  };

  const { data, currentData, isLoading, isFetching, isError, refetch } = useGetBookingsQuery({
    status,
    priority,
    sender_email: fromFilter === 'Any' ? undefined : fromFilter,
    agent_id: myAgentId,
    search: debouncedSearch || undefined,
    created_after: CREATED_MAP[createdFilter],
    closed_after: CLOSED_MAP[closedAtFilter],
    page: currentPage,
    page_size: pageSize,
  }, { skip: agentsLoading || hasNoAgentProfile, pollingInterval: 10_000, refetchOnFocus: true });

  const countBase = { agent_id: myAgentId, priority, sender_email: fromFilter === 'Any' ? undefined : fromFilter, created_after: CREATED_MAP[createdFilter], closed_after: CLOSED_MAP[closedAtFilter], page_size: 1 };
  const skipCount = agentsLoading || hasNoAgentProfile;
  const countOpts = { skip: skipCount, refetchOnMountOrArgChange: true };
  const { data: cAll }  = useGetBookingsQuery({ ...countBase },                          countOpts);
  const { data: cPend } = useGetBookingsQuery({ ...countBase, status: 'Pending' },       countOpts);
  const { data: cProg } = useGetBookingsQuery({ ...countBase, status: 'In Progress' },   countOpts);
  const { data: cDone } = useGetBookingsQuery({ ...countBase, status: 'Completed' },     countOpts);
  const { data: cIgn  } = useGetBookingsQuery({ ...countBase, status: 'Ignored' },       countOpts);

  const allItems = data?.items ?? [];
  const [markBookingRead] = useMarkBookingReadMutation();
  const [markAllBookingsRead] = useMarkAllBookingsReadMutation();

  const unreadIds = allItems.filter(b => !b.is_read).map(b => b.id);
  const { isMuted, toggleMute } = useAlertSound(unreadIds);

  const TAB_COUNTS: Record<Tab, number | undefined> = debouncedSearch ? {
    All:           activeTab === 'All'         ? currentData?.total : undefined,
    Pending:       activeTab === 'Pending'     ? currentData?.total : undefined,
    'In Progress': activeTab === 'In Progress' ? currentData?.total : undefined,
    Completed:     activeTab === 'Completed'   ? currentData?.total : undefined,
    Ignored:       activeTab === 'Ignored'     ? currentData?.total : undefined,
  } : {
    All:           hasNoAgentProfile ? 0 : cAll?.total,
    Pending:       hasNoAgentProfile ? 0 : cPend?.total,
    'In Progress': hasNoAgentProfile ? 0 : cProg?.total,
    Completed:     hasNoAgentProfile ? 0 : cDone?.total,
    Ignored:       hasNoAgentProfile ? 0 : cIgn?.total,
  };

  const [senderOptions, setSenderOptions] = useState<string[]>([]);
  useEffect(() => {
    if (fromFilter === 'Any' && allItems.length > 0) {
      setSenderOptions(prev =>
        Array.from(new Set([...prev, ...allItems.map(b => b.sender_email)])).sort()
      );
    }
  }, [allItems]);
  const uniqueSenders = ['Any', ...senderOptions];

  const sorted = [...allItems]
    .sort((a, b) => {
      if (sortBy === 'Priority') {
        const ord: Record<string, number> = { 'Very Urgent': 0, Urgent: 1, 'Not Urgent': 2 };
        return (ord[a.priority] ?? 3) - (ord[b.priority] ?? 3);
      }
      if (sortBy === 'Due date') {
        const due = (x: BookingListItem) => new Date(x.received_at).getTime() + (SLA[x.priority] ?? 8) * 3_600_000;
        return due(a) - due(b);
      }
      // Sort by last email time so threads with new replies float to top (Outlook-style)
      const st = (x: BookingListItem) => { const t = new Date(x.last_email_at ?? x.received_at).getTime(); return isNaN(t) ? 0 : t; };
      return st(b) - st(a);
    })
;

  /* Persist the current visible list + origin so the detail page's Back/Prev/Next work from this context */
  useEffect(() => {
    if (sorted.length > 0) {
      sessionStorage.setItem('bts:booking-nav', JSON.stringify(sorted.map(b => b.id)));
      sessionStorage.setItem('bts:booking-origin', '/dashboard/my-bookings');
    }
  }, [sorted]);

  /* Restore scroll position after list renders */
  useEffect(() => {
    if (!pendingScroll.current || sorted.length === 0) return;
    const { y, id } = pendingScroll.current;
    pendingScroll.current = null;
    const el = document.getElementById('main-scroll');
    if (el) el.scrollTop = y;
    if (id) {
      setLastClickedId(id);
      setTimeout(() => setLastClickedId(null), 5000);
    }
  }, [sorted]);

  const totalCount = data?.total      ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const startIdx   = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx     = Math.min(currentPage * pageSize, totalCount);

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="flex flex-col gap-3 h-full min-h-0">

      {/* Status tabs + search + pagination + filter toggle — single row */}
      <motion.div variants={staggerItem} className="flex items-center gap-2">

        {/* Left: status tabs */}
        <div className="flex items-center border-b border-gray-200 shrink-0">
          {TABS.map(tab => {
            const isActive = activeTab === tab;
            return (
              <button key={tab} onClick={() => handleTabChange(tab)}
                className={`flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold border-b-2 -mb-px transition-all duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-indigo-600 border-indigo-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}>
                {tab === 'All' && <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>}
                {tab === 'Pending' && <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                {tab === 'In Progress' && <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                {tab === 'Completed' && <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                {tab === 'Ignored' && <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                {TAB_LABEL[tab]}
                {TAB_COUNTS[tab] !== undefined && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                    isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {TAB_COUNTS[tab]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-64 shrink-0 ml-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by ID, subject, email, DA…"
            className={`w-full pl-9 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-white transition-all ${searchQuery ? 'pr-28' : 'pr-4'}`}
          />
          {searchQuery && (
            <>
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-indigo-500 whitespace-nowrap pointer-events-none">
                {isFetching ? '…' : `${data?.total ?? 0} result${(data?.total ?? 0) !== 1 ? 's' : ''}`}
              </span>
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1.5 shrink-0 pb-1">
          <InlineDropdown align="right"
            trigger={(open, toggle) => (
              <button onClick={toggle}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-gray-600 font-semibold bg-white hover:bg-gray-50 transition-colors shadow-sm text-[12px] ${open ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'}`}>
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

          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="p-0.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="p-0.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Filter toggle icon */}
        <div className="relative group/ft shrink-0 mb-1">
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
              filtersOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M3 12h18M3 19h18" />
              <circle cx="8" cy="5" r="2" fill="currentColor" stroke="none" />
              <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
              <circle cx="11" cy="19" r="2" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <div className="pointer-events-none absolute right-0 top-full mt-2 z-50 opacity-0 translate-y-1 group-hover/ft:opacity-100 group-hover/ft:translate-y-0 transition-all duration-150">
            <div className="bg-gray-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
              {filtersOpen ? 'Hide Filters' : 'Show Filters'}
              <div className="absolute -top-1 right-2.5 w-2 h-2 bg-gray-900 rotate-45 rounded-sm" />
            </div>
          </div>
        </div>

      </motion.div>

      {/* Two-column content area */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4">

        {/* ── Main ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 order-2 lg:order-1">

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
                ) : hasNoAgentProfile ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-3xl mb-2">🔗</p>
                    <p className="text-sm font-semibold text-gray-400">No agent profile linked to your account</p>
                    <p className="text-xs text-gray-300 mt-1">Ask an admin to create an agent profile for you in Settings</p>
                  </div>
                ) : sorted.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-3xl mb-2">{searchQuery ? '🔍' : '📋'}</p>
                    <p className="text-sm font-semibold text-gray-400">
                      {searchQuery ? `No results for "${searchQuery}"` : `No ${activeTab === 'All' ? '' : TAB_LABEL[activeTab]} tickets`}
                    </p>
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => { const unreadCount = sorted.filter(b => !b.is_read).length; return unreadCount > 0 && (
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] text-slate-500 font-medium">{unreadCount} unread update{unreadCount > 1 ? 's' : ''}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={toggleMute}
                            title={isMuted ? 'Unmute alerts' : 'Mute alerts'}
                            className={`flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${isMuted ? 'bg-rose-50 border-rose-200 text-rose-400 hover:bg-rose-100' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}
                          >
                            {isMuted ? (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3.536-3.536M12 18l3.536-3.536M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                            )}
                          </button>
                          <button
                            onClick={() => markAllBookingsRead(sorted.map(b => b.id))}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-800 text-[11px] font-medium transition-colors"
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            Mark all read
                          </button>
                        </div>
                      </div>
                    ); })()}
                    {(() => {
                      const groups: { key: string; items: typeof sorted }[] = [];
                      for (const b of sorted) {
                        const k = dayKey(b.last_email_at ?? b.received_at);
                        const last = groups[groups.length - 1];
                        if (last && last.key === k) last.items.push(b);
                        else groups.push({ key: k, items: [b] });
                      }
                      return groups.map(({ key, items }) => (
                        <div key={key}>
                          <div className="flex items-center gap-2 px-1 py-1 mt-2 mb-1">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{dayLabel(key)}</span>
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-[11px] text-slate-300 font-medium">{items.length}</span>
                          </div>
                          <div className="space-y-2">
                            {items.map(b => (
                              <BookingRow key={b.id} booking={b} agents={agents} myUserEmail={user?.email} bookingConfig={bookingConfig} onMarkRead={(id) => markBookingRead(id)} highlighted={lastClickedId === b.id} />
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

        </div>

        {/* ── Filters sidebar ── */}
        <motion.div variants={staggerItem} className={`order-1 lg:order-2 w-full lg:w-80 lg:shrink-0 flex-col gap-3 ${filtersOpen ? 'flex' : 'hidden'}`}>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4 lg:sticky lg:top-0 max-h-[calc(100vh-7rem)] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Filters</span>
              <button className="p-1 rounded hover:bg-gray-100 transition-colors">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>

            <FilterSelect label="From" value={fromFilter} options={uniqueSenders} onChange={setFromFilter} />

            <div className="border-t border-gray-100" />

            <FilterSelect label="Status" value={activeTab}
              options={['All', 'Pending', 'In Progress', 'Completed', 'Ignored']}
              onChange={(v) => handleTabChange(v as typeof activeTab)} />

            <div className="border-t border-gray-100" />

            <FilterSelect label="Priority" value={priorityFilter}
              options={['Any priority', ...(bookingConfig?.filter(c => c.type === 'priority').sort((a, b) => a.order_index - b.order_index).map(c => c.label) ?? ['Very Urgent', 'Urgent', 'Not Urgent'])]} onChange={setPriorityFilter} />
            <FilterSelect label="Created" value={createdFilter}
              options={['Anytime', 'Today', 'Last 7 days', 'Last 30 days']} onChange={setCreatedFilter} />
            <FilterSelect label="Closed at" value={closedAtFilter}
              options={['Anytime', 'Today', 'This week', 'This month']} onChange={setClosedAtFilter} />
          </div>
        </motion.div>

      </div>

    </motion.div>
  );
}
