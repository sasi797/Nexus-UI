'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetBookingsQuery, useUpdateBookingMutation, usePatchBookingStatusMutation,
  useAddSupportAgentMutation, useRemoveSupportAgentMutation,
  BookingListItem,
} from '@/services/bookingsApi';
import { useGetAgentsQuery, Agent } from '@/services/agentsApi';
import { useGetDashboardStatsQuery } from '@/services/dashboardApi';
import { useGetBookingConfigQuery, getColor, BookingConfigItem } from '@/services/bookingConfigApi';
import { useAppSelector } from '@/store/hooks';
import ApiErrorState from '@/components/ApiErrorState';

type Tab = 'All' | 'Pending' | 'In Progress' | 'Completed';
const TABS: Tab[] = ['All', 'Pending', 'In Progress', 'Completed'];
const TAB_LABEL: Record<Tab, string> = { All: 'All', Pending: 'Open', 'In Progress': 'In Progress', Completed: 'Completed' };

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

function formatReceivedAt(iso: string): string {
  const d = new Date(iso);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${hh}:${mm}`;
}

function formatHMS(ms: number): string {
  const totalSecs = Math.floor(Math.max(ms, 0) / 1000);
  const s = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const m = totalMins % 60;
  const h = Math.floor(totalMins / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}


function elapsedCfg(ms: number) {
  const mins = ms / 60_000;
  if (mins <= 15) return { text: 'text-emerald-600', bg: 'bg-emerald-50 ring-emerald-200', dot: 'bg-emerald-400', label: 'Low' };
  if (mins <= 30) return { text: 'text-amber-600',   bg: 'bg-amber-50 ring-amber-200',     dot: 'bg-amber-400',   label: 'Med' };
  return              { text: 'text-red-600',         bg: 'bg-red-50 ring-red-200',         dot: 'bg-red-500',     label: 'High' };
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
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 ring-1 ring-gray-200 text-[12px] font-mono font-semibold text-gray-500">
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        {formatHMS(ms)}
      </span>
    );
  }

  const cfg = elapsedCfg(ms);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ring-1 text-[12px] font-mono font-bold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${cfg.dot}`} />
      {formatHMS(ms)}
      <span className="text-[10px] font-semibold opacity-60">{cfg.label}</span>
    </span>
  );
}

function DaTagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [inputVal, setInputVal] = useState('');
  const tags = value.split(',').map(s => s.trim()).filter(Boolean);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) { setInputVal(''); return; }
    onChange([...tags, tag].join(', '));
    setInputVal('');
  }

  function removeTag(idx: number) {
    onChange(tags.filter((_, i) => i !== idx).join(', '));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <div
      className="min-h-[44px] w-full px-2 py-1.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-emerald-300 focus-within:border-emerald-400 flex flex-wrap gap-1.5 items-center cursor-text transition-all"
      onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
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
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputVal)}
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

/* Status icon paths (fixed by value) */
const S_PATH: Record<string, string> = {
  Pending:      'M13 10V3L4 14h7v7l9-11h-7z',
  'In Progress':'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  Completed:   'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
};

/* Helpers that read from live config */

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

/* ── FilterDropdown ── */
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

/* ── Filter panel helpers ── */
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
function BookingRow({ booking, agents, myUserEmail, bookingConfig }: {
  booking: BookingListItem; agents: Agent[]; myUserEmail: string | undefined;
  bookingConfig: ReturnType<typeof useGetBookingConfigQuery>['data'];
}) {
  const [updateBooking, { isLoading: upd }] = useUpdateBookingMutation();
  const [patchStatus, { isLoading: pat }] = usePatchBookingStatusMutation();
  const [addSupport] = useAddSupportAgentMutation();
  const [removeSupport] = useRemoveSupportAgentMutation();
  const [showDa, setShowDa] = useState(false);
  const [daNumber, setDaNumber] = useState('');
  const [daDesc, setDaDesc] = useState('');
  const busy = upd || pat;

  const cfgItems = bookingConfig ?? [];
  const statusCfg = cfgItems.filter((c: BookingConfigItem) => c.type === 'status');
  const priorityCfg = cfgItems.filter((c: BookingConfigItem) => c.type === 'priority');
  const tagCfg = cfgItems.filter((c: BookingConfigItem) => c.type === 'tag');
  const tagValues = tagCfg.map((t: BookingConfigItem) => t.value);

  const statusItem = statusCfg.find((s: BookingConfigItem) => s.value === booking.status) ?? statusCfg[0];
  const sc = statusItem ? { dot: getColor(statusItem.color).dot, text: getColor(statusItem.color).text, label: statusItem.label, path: S_PATH[statusItem.value] ?? S_PATH.Pending } : { dot: 'bg-gray-400', text: 'text-gray-500', label: booking.status, path: S_PATH.Completed };

  const isMine = !!myUserEmail && booking.agent?.email === myUserEmail;
  const supportIds = new Set(booking.support_agents.map(a => a.id));
  const availableForSupport = agents.filter(a => a.id !== booking.agent?.id && !supportIds.has(a.id));

  function handleStatusClick(s: string, close: () => void) {
    close();
    if (s === booking.status) return;
    if (s === 'Completed') { setDaNumber(booking.da_number ?? ''); setDaDesc(booking.da_description ?? ''); setShowDa(true); return; }
    patchStatus({ id: booking.id, status: s });
  }

  function submitDa() {
    patchStatus({ id: booking.id, status: 'Completed', da_number: daNumber || undefined, da_description: daDesc || undefined });
    setShowDa(false);
  }

  const isCompleted = booking.status === 'Completed';

  return (
    <>
    {/* ── Mobile card (< md) ── */}
    <Link
      href={`/dashboard/my-bookings/${booking.id}`}
      className={`md:hidden block rounded-lg border shadow-sm active:opacity-75 transition-all ${busy ? 'opacity-60 pointer-events-none' : ''} ${isCompleted ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}
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
      </div>
    </Link>

    {/* ── Desktop row (≥ md) ── */}
    <div className={`hidden md:flex items-center gap-2 px-3 pt-3 pb-2.5 rounded-lg border shadow-sm hover:shadow-md transition-all group ${busy ? 'opacity-60 pointer-events-none' : ''} ${isCompleted ? 'bg-orange-100 border-orange-200 hover:border-orange-300' : 'bg-white border-gray-100 hover:border-gray-200'}`}>

      {/* Checkbox */}
      <input type="checkbox" onClick={e => e.stopPropagation()}
        className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer shrink-0 accent-indigo-600 opacity-30 group-hover:opacity-100 transition-opacity" />

      {/* Avatar */}
      <Link href={`/dashboard/my-bookings/${booking.id}`} className="shrink-0">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor(booking.sender_email)} flex items-center justify-center text-white text-[12px] font-bold shadow-sm`}>
          {booking.sender_email.charAt(0).toUpperCase()}
        </div>
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">

        {/* Rows 1 + 2: linked to detail */}
        <Link href={`/dashboard/my-bookings/${booking.id}`} className="block">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-gray-400 text-[10px] font-bold">#</span>
            <span className="text-[10px] font-bold text-gray-500 font-mono tracking-tight">{booking.id}</span>
            {isCompleted && booking.da_number && <DaBadges daNumber={booking.da_number} />}
            <TagBadges tags={parseTags(booking.tags, tagValues)} tagConfig={tagCfg} />
          </div>
          <p className="text-[13px] font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors leading-snug truncate">
            <span className="mr-1">😊</span>{booking.subject}
          </p>
        </Link>

        {/* Row 3: email + agent + support — not inside link */}
        <div className="flex items-center gap-2 mt-0.5" onClick={e => e.stopPropagation()}>

          {/* Sender */}
          <div className="flex items-center gap-1 shrink-0">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-[12px] text-gray-600 font-semibold">{extractName(booking.sender_email)}</span>
          </div>

          <div className="w-px h-3 bg-gray-300 shrink-0" />

          {/* Agent */}
          {isMine ? (
            <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium shrink-0">
              <svg className="w-3 h-3 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>You</span>
              <svg className="w-2.5 h-2.5 text-indigo-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
          ) : (
            <InlineDropdown align="left"
              trigger={(open, toggle) => (
                <button onClick={toggle}
                  className={`flex items-center gap-1 text-[12px] font-semibold text-gray-700 shrink-0 rounded-md px-1.5 py-0.5 transition-colors ${open ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                  <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="truncate max-w-[80px]">{booking.agent?.name ?? '—'}</span>
                  <Chevron cls="text-gray-400" />
                </button>
              )}>
              {close => (
                <>
                  <DdItem label="Unassign" active={!booking.agent}
                    left={<span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400 font-bold shrink-0">—</span>}
                    onClick={() => { updateBooking({ id: booking.id, body: { agent_id: undefined } }); close(); }} />
                  {agents.map(a => (
                    <DdItem key={a.id} label={a.name} active={booking.agent?.id === a.id}
                      left={<div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(a.email)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>{a.name.charAt(0).toUpperCase()}</div>}
                      onClick={() => { updateBooking({ id: booking.id, body: { agent_id: a.id } }); close(); }} />
                  ))}
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
                onClick={() => removeSupport({ id: booking.id, agent_id: a.id })}
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
                  <div className="relative group/add shrink-0">
                    <button onClick={toggle}
                      className={`w-5 h-5 rounded-full border border-dashed flex items-center justify-center transition-colors ${open ? 'border-violet-400 text-violet-500 bg-violet-50' : 'border-gray-300 text-gray-400 hover:border-violet-400 hover:text-violet-500'}`}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 opacity-0 translate-y-1 group-hover/add:opacity-100 group-hover/add:translate-y-0 transition-all duration-150">
                      <div className="relative bg-gray-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                        Add support agent
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 rounded-sm" />
                      </div>
                    </div>
                  </div>
                )}>
                {close => availableForSupport.map(a => (
                  <DdItem key={a.id} label={a.name}
                    left={<div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(a.email)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>{a.name.charAt(0).toUpperCase()}</div>}
                    onClick={() => { addSupport({ id: booking.id, agent_id: a.id }); close(); }} />
                ))}
              </InlineDropdown>
            )}
          </div>

        </div>
      </div>

      {/* Timer */}
      <div className="hidden sm:flex flex-col items-center justify-center shrink-0 px-3 gap-1">
        <span className="text-[10.5px] text-gray-700 font-semibold">{formatReceivedAt(booking.received_at)}</span>
        <ElapsedBadge booking={booking} />
      </div>

      {/* Right meta — priority + status + tags only */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-[110px]">

        {/* Priority */}
        {(() => {
          const pItem = priorityCfg.find((p: BookingConfigItem) => p.value === booking.priority);
          const pc = getColor(pItem?.color ?? 'gray');
          return (
            <InlineDropdown
              trigger={(open, toggle) => (
                <button onClick={toggle}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold w-full justify-end text-xs transition-colors ${open ? 'bg-gray-100' : pc.bg} ${pc.text}`}>
                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${pc.dot}`} />
                  {pItem?.label ?? booking.priority}
                  <Chevron cls="text-current opacity-40" />
                </button>
              )}>
              {close => priorityCfg.map((p: BookingConfigItem) => {
                const cc = getColor(p.color);
                return (
                  <DdItem key={p.value} label={p.label} active={booking.priority === p.value}
                    left={<span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${cc.dot}`} />}
                    onClick={() => { updateBooking({ id: booking.id, body: { priority: p.value } }); close(); }} />
                );
              })}
            </InlineDropdown>
          );
        })()}

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
          {close => statusCfg.map((s: BookingConfigItem) => {
            const cc = getColor(s.color);
            return (
              <DdItem key={s.value} label={s.label} active={booking.status === s.value}
                left={<span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${cc.dot}`} />}
                onClick={() => handleStatusClick(s.value, close)} />
            );
          })}
        </InlineDropdown>

        {/* Tags — multi-select */}
        <InlineDropdown align="right"
          trigger={(open, toggle) => {
            const activeTags = parseTags(booking.tags, tagValues);
            return (
              <button onClick={toggle}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg w-full justify-end text-xs font-semibold transition-colors ${open ? 'bg-gray-100' : 'hover:bg-gray-50'} text-gray-600`}>
                <svg className="w-3 h-3 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {activeTags.length === 0 ? <span className="text-gray-600">Tags</span> : <TagBadges tags={activeTags} tagConfig={tagCfg} />}
                <Chevron cls="text-gray-400 ml-0.5" />
              </button>
            );
          }}>
          {close => (
            <div className="py-1 min-w-[140px]">
              {tagCfg.map((tag: BookingConfigItem) => {
                const activeTags = parseTags(booking.tags, tagValues);
                const active = activeTags.includes(tag.value);
                const c = getColor(tag.color);
                return (
                  <button key={tag.value}
                    onClick={() => {
                      const next = active ? activeTags.filter(t => t !== tag.value) : [...activeTags, tag.value];
                      updateBooking({ id: booking.id, body: { tags: serializeTags(next) } });
                      close();
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
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

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowDa(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={submitDa}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
                Confirm
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
export default function AllBookingsPage() {
  const user = useAppSelector(state => state.auth.user);

  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [tabDir, setTabDir] = useState(0);
  const prevTabIdx = useRef(0);

  function handleTabChange(tab: Tab) {
    const newIdx = TABS.indexOf(tab);
    setTabDir(newIdx > prevTabIdx.current ? 1 : -1);
    prevTabIdx.current = newIdx;
    setActiveTab(tab);
  }

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sortBy] = useState('Date created');
  const [agentFilter, setAgentFilter] = useState('Any agent');
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

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, agentFilter, priorityFilter, fromFilter, createdFilter, closedAtFilter, sortBy, pageSize, debouncedSearch]);

  const status = activeTab === 'All' ? undefined : activeTab;
  const { data: agents = [] } = useGetAgentsQuery();
  const { data: stats } = useGetDashboardStatsQuery();
  const { data: bookingConfig } = useGetBookingConfigQuery();

  const agentId = agentFilter === 'Any agent' ? undefined : agents.find(a => a.name === agentFilter)?.id;
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
    agent_id: agentId,
    search: debouncedSearch || undefined,
    created_after: CREATED_MAP[createdFilter],
    closed_after: CLOSED_MAP[closedAtFilter],
    page: currentPage,
    page_size: pageSize,
  });

  const allItems = data?.items ?? [];

  // Use currentData (undefined while a new query is in-flight) so tab counts
  // never flash a stale total from the previously-selected tab.
  const TAB_COUNTS: Record<Tab, number | undefined> = debouncedSearch ? {
    All:           activeTab === 'All'         ? currentData?.total : undefined,
    Pending:       activeTab === 'Pending'     ? currentData?.total : undefined,
    'In Progress': activeTab === 'In Progress' ? currentData?.total : undefined,
    Completed:     activeTab === 'Completed'   ? currentData?.total : undefined,
  } : {
    All:           activeTab === 'All'         ? (currentData?.total ?? stats?.total_bookings) : stats?.total_bookings,
    Pending:       activeTab === 'Pending'     ? (currentData?.total ?? stats?.pending)        : stats?.pending,
    'In Progress': activeTab === 'In Progress' ? (currentData?.total ?? stats?.in_progress)    : stats?.in_progress,
    Completed:     activeTab === 'Completed'   ? (currentData?.total ?? stats?.completed)      : stats?.completed,
  };

  // Accumulate sender options only from unfiltered loads so the dropdown never shrinks
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
      return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
    })
;

  /* Persist nav list + origin so the detail page's Back/Prev/Next work from this context */
  useEffect(() => {
    if (sorted.length > 0) {
      sessionStorage.setItem('bts:booking-nav', JSON.stringify(sorted.map(b => b.id)));
      sessionStorage.setItem('bts:booking-origin', '/dashboard/all-bookings');
    }
  }, [sorted]);

  const totalCount = data?.total      ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const startIdx   = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx     = Math.min(currentPage * pageSize, totalCount);

  const agentOpts = ['Any agent', ...agents.map(a => a.name)];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="flex flex-col gap-3 h-full min-h-0">

      {/* Bookings tab switcher */}
      <div className="flex gap-0.5 bg-white border border-gray-200 shadow-sm p-1 rounded-xl w-fit">
        <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-gray-200 text-gray-900">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          All Bookings
        </span>
        <Link href="/dashboard/my-bookings"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-all">
          <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          My Bookings
        </Link>
      </div>

      {/* Status tabs + search + pagination + hide filters — single top row */}
      <motion.div variants={staggerItem} className="flex items-center gap-2">

        {/* Left: status tabs — segmented pill control */}
        <div className="flex items-center gap-0.5 bg-white border border-gray-200 shadow-sm p-1 rounded-xl shrink-0">
          {TABS.map(tab => (
            <button key={tab} onClick={() => handleTabChange(tab)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all duration-150 whitespace-nowrap shrink-0">
              {activeTab === tab && (
                <motion.div layoutId="all-tab-bg"
                  className="absolute inset-0 bg-gray-200 rounded-lg"
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }} />
              )}
              <span className={`relative z-10 flex items-center gap-1.5 transition-colors duration-150 ${activeTab === tab ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>
                {tab === 'All' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                )}
                {tab === 'Pending' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                )}
                {tab === 'In Progress' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {tab === 'Completed' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {TAB_LABEL[tab]}
                {TAB_COUNTS[tab] !== undefined && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none transition-colors ${
                    activeTab === tab ? 'bg-gray-400/20 text-gray-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {TAB_COUNTS[tab]}
                  </span>
                )}
              </span>
            </button>
          ))}
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
            placeholder="Search by ID, subject, email, DA number, priority, status, tags, agent…"
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

        {/* Hide filters toggle */}
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
                exit:  (d: number) => ({ opacity: 0, x: d * -14 }),
              }}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.19, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {isError ? (
                <ApiErrorState title="Failed to load bookings" onRetry={refetch} />
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
                  <p className="text-3xl mb-2">{searchQuery ? '🔍' : '📋'}</p>
                  <p className="text-sm font-semibold text-gray-400">
                    {searchQuery ? `No results for "${searchQuery}"` : `No ${activeTab === 'All' ? '' : TAB_LABEL[activeTab]} bookings`}
                  </p>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {sorted.map(b => (
                    <BookingRow key={b.id} booking={b} agents={agents} myUserEmail={user?.email} bookingConfig={bookingConfig} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

      </div>

      {/* ── Filters sidebar ── */}
      <motion.div variants={staggerItem} className={`order-1 lg:order-2 w-full lg:w-80 lg:shrink-0 flex-col gap-3 ${filtersOpen ? 'flex' : 'hidden'}`}>

        {/* Filters card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4 lg:sticky lg:top-0 max-h-[calc(100vh-7rem)] overflow-y-auto">

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
            options={['All', 'Pending', 'In Progress', 'Completed']}
            onChange={(v) => handleTabChange(v as typeof activeTab)} />

          <div className="border-t border-gray-100" />

          <FilterSection label="Agents">
            <FilterDropdown value={agentFilter} options={agentOpts} onChange={setAgentFilter} />
          </FilterSection>

          <div className="border-t border-gray-100" />

          <FilterSelect label="Priority" value={priorityFilter}
            options={['Any priority', 'Very Urgent', 'Urgent', 'Not Urgent']} onChange={setPriorityFilter} />
          <FilterSelect label="Created" value={createdFilter}
            options={['Anytime', 'Today', 'Last 7 days', 'Last 30 days']} onChange={setCreatedFilter} />
          <FilterSelect label="Closed at" value={closedAtFilter}
            options={['Anytime', 'Today', 'This week', 'This month']} onChange={setClosedAtFilter} />

          {/* Assignment Rules */}
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Assignment Rules</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                <p className="text-[11px] text-gray-500 leading-snug">You can assign any booking to yourself.</p>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <p className="text-[11px] text-gray-500 leading-snug">Your own bookings cannot be reassigned to others.</p>
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      </div>

    </motion.div>
  );
}
