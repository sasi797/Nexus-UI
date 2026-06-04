'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetBookingQuery, usePatchBookingStatusMutation,
  useUpdateBookingMutation, useGetBookingEventsQuery,
  useAddSupportAgentMutation, useRemoveSupportAgentMutation,
} from '@/services/bookingsApi';

import { useGetAgentsQuery, Agent } from '@/services/agentsApi';

import EmailThread from '@/components/EmailThread';

type ComposeTab = 'Reply' | 'Reply All' | 'Forward';

/* ── helpers ── */
const PRIORITY_LEFT: Record<string, string> = {
  'Very Urgent': 'border-l-red-500', Urgent: 'border-l-amber-400', 'Not Urgent': 'border-l-green-400',
};
const PRIORITY_BADGE: Record<string, string> = {
  'Very Urgent': 'bg-red-50 text-red-700 ring-1 ring-red-200',
  Urgent: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  'Not Urgent': 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};
const PRIORITY_PILL_ON: Record<string, string> = {
  'Very Urgent': 'bg-red-50 text-red-700 border-red-300',
  Urgent: 'bg-amber-50 text-amber-700 border-amber-300',
  'Not Urgent': 'bg-emerald-50 text-emerald-700 border-emerald-300',
};
const PRIORITY_DOT: Record<string, string> = {
  'Very Urgent': 'bg-red-500', Urgent: 'bg-amber-400', 'Not Urgent': 'bg-emerald-500',
};
const STATUS_PILL_ON: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-300',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-300',
  Completed: 'bg-gray-100 text-gray-600 border-gray-300',
};
const STATUS_DOT: Record<string, string> = {
  Pending: 'bg-amber-400', 'In Progress': 'bg-blue-500', Completed: 'bg-gray-300',
};

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
  const local = email.split('@')[0];
  return local.split(/[._+]/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const labelCls = 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block';

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
      className="min-h-[44px] w-full px-2 py-1.5 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-emerald-300 focus-within:border-emerald-400 flex flex-wrap gap-1.5 items-center cursor-text transition-all"
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

function AgentPicker({ agents, value, onChange, disabled }: {
  agents: Agent[]; value: string | null; onChange: (id: string) => void; disabled?: boolean;
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
      <button disabled={disabled} onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 border rounded-lg text-xs transition-all disabled:opacity-60 ${
          open ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-gray-300'
        } bg-white`}>
        <span className="flex-1 text-left text-gray-500 truncate">
          {agents.find(a => a.id === value)
            ? `${agents.find(a => a.id === value)!.name}${agents.find(a => a.id === value)!.shift ? ` · ${agents.find(a => a.id === value)!.shift!.name}` : ''}`
            : '— Unassigned —'}
        </span>
        <svg className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.1 }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto"
          >
            <button onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${!value ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
              <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-[10px] font-bold shrink-0">—</span>
              <span className="flex-1 text-xs font-medium text-gray-400">Unassigned</span>
              {!value && <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
            </button>
            <div className="border-t border-gray-100" />
            {agents.map(a => (
              <button key={a.id} onClick={() => { onChange(a.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors group ${value === a.id ? 'bg-indigo-50' : 'hover:bg-indigo-50/60'}`}>
                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(a.email)} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold truncate ${value === a.id ? 'text-indigo-700' : 'text-gray-800 group-hover:text-indigo-700'}`}>{a.name}</p>
                  {a.shift && <p className="text-[10px] text-gray-400">{a.shift.name}</p>}
                </div>
                {value === a.id && <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SupportAgentPicker({ available, onAdd, disabled }: {
  available: { id: string; name: string; email: string }[];
  onAdd: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (available.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-xs font-medium transition-all disabled:opacity-60 ${
          open ? 'border-violet-400 bg-violet-50 text-violet-600' : 'border-gray-200 bg-white text-gray-400 hover:border-violet-300 hover:text-violet-500'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add support agent
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.1 }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-52 overflow-y-auto"
          >
            {available.map(a => (
              <button key={a.id}
                onClick={() => { onAdd(a.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-violet-50 text-left transition-colors group">
                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(a.email)} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-800 group-hover:text-violet-700 truncate">{a.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{a.email}</p>
                </div>
                <svg className="w-3.5 h-3.5 text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HistorySection({
  events,
  eventCfg,
}: {
  events: { id: string; event: string; new_value?: string | null; old_value?: string | null; actor_name?: string | null; created_at: string }[];
  eventCfg: Record<string, { icon: string; color: string; label: (e: typeof events[0]) => string }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between group"
      >
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">History</span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="relative mt-2">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-100" />
              {events.length === 0 && (
                <p className="text-xs text-gray-400 py-4 text-center">No history yet</p>
              )}
              {events.map(ev => {
                const cfg = eventCfg[ev.event] ?? { icon: '•', color: 'bg-gray-100', label: () => ev.event };
                return (
                  <div key={ev.id} className="flex items-start gap-2.5 relative py-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 z-10 ring-2 ring-white ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-xs font-semibold text-gray-700 leading-snug">{cfg.label(ev)}</p>
                      {ev.actor_name && (
                        <p className="text-[10px] text-indigo-500 font-medium">{ev.actor_name}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(ev.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const [composeTab, setComposeTab]       = useState<ComposeTab>('Reply');
  const [savedField, setSavedField]       = useState<string | null>(null);
  const [showDaModal, setShowDaModal]     = useState(false);
  const [daNumber, setDaNumber]           = useState('');
  const [daDesc, setDaDesc]               = useState('');

  const { data: b, isLoading }                   = useGetBookingQuery(id);
  const { data: bookingEvents = [] }             = useGetBookingEventsQuery(id, { pollingInterval: 30_000 });
  const [patchStatus,    { isLoading: patching }] = usePatchBookingStatusMutation();
  const [updateBooking,  { isLoading: saving }]   = useUpdateBookingMutation();
  const [addSupport]                              = useAddSupportAgentMutation();
  const [removeSupport]                           = useRemoveSupportAgentMutation();
  const { data: agents = [] }                     = useGetAgentsQuery();

  const bookingIds  = typeof window !== 'undefined'
    ? JSON.parse(sessionStorage.getItem('bts:booking-nav') ?? '[]') as string[]
    : [];
  const listOrigin  = (typeof window !== 'undefined'
    ? sessionStorage.getItem('bts:booking-origin')
    : null) ?? '/dashboard/my-bookings';
  const listLabel   = listOrigin === '/dashboard/all-bookings' ? 'All Bookings' : 'My Bookings';
  const currentIdx  = bookingIds.indexOf(id);
  const prevId      = currentIdx > 0 ? bookingIds[currentIdx - 1] : null;
  const nextId      = currentIdx >= 0 && currentIdx < bookingIds.length - 1 ? bookingIds[currentIdx + 1] : null;

  /* flash a "✓ Saved" badge on the changed field */
  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1800);
  };

  const handleStatusChange = async (status: string) => {
    await patchStatus({ id, status });
    flashSaved('status');
  };
  const handlePriorityChange = async (priority: string) => {
    await updateBooking({ id, body: { priority } });
    flashSaved('priority');
  };
  const handleAgentChange = async (agent_id: string) => {
    await updateBooking({ id, body: { agent_id: agent_id || undefined } });
    flashSaved('agent');
  };

  const handleClose = () => {
    setDaNumber(b?.da_number ?? '');
    setDaDesc(b?.da_description ?? '');
    setShowDaModal(true);
  };

  const handleDaConfirm = async () => {
    const tags = daNumber.split(',').map(s => s.trim()).filter(Boolean);
    if (tags.length === 0) return;
    await patchStatus({ id, status: 'Completed', da_number: tags.join(', '), da_description: daDesc.trim() || undefined });
    setShowDaModal(false);
    flashSaved('status');
  };

  const focusCompose = (tab: ComposeTab) => {
    setComposeTab(tab);
    setTimeout(() => {
      replyRef.current?.focus();
      replyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  if (isLoading) {
    return (
      <div className="flex gap-5 items-start">
        <div className="flex-1 space-y-3">
          <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="h-[500px] bg-gray-100 rounded-xl animate-pulse" />
        </div>
        <div className="w-72 shrink-0">
          <div className="h-[420px] bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }
  if (!b) return <p className="text-gray-400 text-sm">Booking not found.</p>;

  const isOpen = b.status !== 'Completed';

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── Left main panel ── */}
        <motion.div variants={staggerItem} className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Subject header */}
          <div className="px-4 sm:px-6 py-3 border-b border-gray-100">
            {/* Top bar: back link + id + priority + prev/next */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Link href={listOrigin}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-indigo-600 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  {listLabel}
                </Link>

                <svg className="w-3 h-3 text-gray-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>

                {/* Ticket ID with hash icon */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-200">
                  <svg className="w-2.5 h-2.5 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <span className="text-[10px] font-bold text-violet-600 font-mono tracking-wide">{b.id}</span>
                </span>

                {/* Priority badge with lightning icon */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_BADGE[b.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                  <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {b.priority}
                </span>
              </div>

              {/* Prev / Next navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => prevId && router.push(`/dashboard/my-bookings/${prevId}`)}
                  disabled={!prevId}
                  title="Previous booking"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </button>
                {currentIdx >= 0 && bookingIds.length > 0 && (
                  <span className="text-[10px] text-gray-300 font-medium tabular-nums px-1">
                    {currentIdx + 1} / {bookingIds.length}
                  </span>
                )}
                <button
                  onClick={() => nextId && router.push(`/dashboard/my-bookings/${nextId}`)}
                  disabled={!nextId}
                  title="Next booking"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  Next
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Subject + sender */}
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(b.sender_email)} flex items-center justify-center text-white text-[13px] font-bold shrink-0 shadow-sm mt-0.5`}>
                {b.sender_email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-bold text-gray-900 leading-snug">{b.subject}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="font-semibold text-gray-600">{extractName(b.sender_email)}</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  <span className="text-gray-400">{b.sender_email}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-1.5">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => focusCompose('Reply')}
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Reply
            </motion.button>

            <button
              onClick={() => focusCompose('Reply All')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6M8 10h5" />
              </svg>
              Reply All
            </button>

            <button
              onClick={() => focusCompose('Forward')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              Forward
            </button>

            <div className="flex-1" />

            <motion.button
              whileHover={isOpen ? { scale: 1.02 } : {}}
              whileTap={isOpen ? { scale: 0.97 } : {}}
              disabled={!isOpen || patching}
              onClick={isOpen ? handleClose : undefined}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border rounded-lg transition-all ${
                isOpen
                  ? 'border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-60'
                  : 'border-emerald-200 text-emerald-600 bg-emerald-50 opacity-60 cursor-not-allowed'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {patching ? 'Completing…' : isOpen ? 'Complete' : 'Completed'}
            </motion.button>
          </div>

          {/* Conversation */}
          <div className="p-3 sm:p-5">
            <EmailThread
              bookingId={b.id}
              senderEmail={b.sender_email}
              replyRef={replyRef}
              composeTab={composeTab}
              onComposeTabChange={setComposeTab}
              readOnly={false}
            />
          </div>
        </motion.div>

        {/* ── Right sidebar ── */}
        <motion.div variants={staggerItem} className="w-full lg:w-80 lg:shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Sidebar header */}
            <div className="px-4 py-3 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ticket Details</span>
              {(saving || patching) && (
                <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                  Saving…
                </span>
              )}
              {savedField && !saving && !patching && (
                <AnimatePresence>
                  <motion.span
                    key={savedField}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] font-bold text-emerald-600"
                  >
                    ✓ Saved
                  </motion.span>
                </AnimatePresence>
              )}
            </div>

            <div className="px-4 py-4 space-y-5">

              {/* Sender */}
              <div>
                <p className={labelCls}>From</p>
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(b.sender_email)} flex items-center justify-center text-white text-[13px] font-bold shrink-0`}>
                    {b.sender_email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{extractName(b.sender_email)}</p>
                    <p className="text-[11px] text-gray-400 truncate">{b.sender_email}</p>
                  </div>
                </div>
              </div>

              {/* Status — instant-save pills */}
              <div>
                <p className={labelCls}>Status</p>
                <div className="flex gap-1.5">
                  {(['Pending', 'In Progress', 'Completed'] as const).map(s => (
                    <button
                      key={s}
                      disabled={saving || patching || !isOpen}
                      onClick={() => handleStatusChange(s)}
                      className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
                        b.status === s
                          ? STATUS_PILL_ON[s]
                          : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.status === s ? STATUS_DOT[s] : 'bg-gray-300'}`} />
                      {s === 'Pending' ? 'Open' : s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority — instant-save pills */}
              <div>
                <p className={labelCls}>Priority</p>
                <div className="flex gap-1.5">
                  {(['Very Urgent', 'Urgent', 'Not Urgent'] as const).map(p => (
                    <button
                      key={p}
                      disabled={saving || patching || !isOpen}
                      onClick={() => handlePriorityChange(p)}
                      className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
                        b.priority === p
                          ? PRIORITY_PILL_ON[p]
                          : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.priority === p ? PRIORITY_DOT[p] : 'bg-gray-300'}`} />
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags — instant-save multi-select pills */}
              {(() => {
                const BOOKING_TAGS = ['Manifest', 'Customs', 'Hold'] as const;
                type BTag = typeof BOOKING_TAGS[number];
                const TAG_CFG: Record<BTag, { on: string; dot: string; offDot: string }> = {
                  Manifest: { on: 'bg-sky-50 text-sky-700 border-sky-300',    dot: 'bg-sky-500',    offDot: 'bg-gray-300' },
                  Customs:  { on: 'bg-violet-50 text-violet-700 border-violet-300', dot: 'bg-violet-500', offDot: 'bg-gray-300' },
                  Hold:     { on: 'bg-orange-50 text-orange-700 border-orange-300', dot: 'bg-orange-500', offDot: 'bg-gray-300' },
                };
                const activeTags: BTag[] = (b.tags ?? '').split(',').map(s => s.trim()).filter((s): s is BTag => BOOKING_TAGS.includes(s as BTag));
                const handleTagToggle = async (tag: BTag) => {
                  const next = activeTags.includes(tag) ? activeTags.filter(t => t !== tag) : [...activeTags, tag];
                  await updateBooking({ id, body: { tags: next.join(',') } });
                  flashSaved('tags');
                };
                return (
                  <div>
                    <p className={labelCls}>Tags</p>
                    <div className="flex gap-1.5">
                      {BOOKING_TAGS.map(tag => {
                        const active = activeTags.includes(tag);
                        const c = TAG_CFG[tag];
                        return (
                          <button key={tag}
                            disabled={saving || patching}
                            onClick={() => handleTagToggle(tag)}
                            className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all disabled:opacity-50 ${active ? c.on : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? c.dot : c.offDot}`} />
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Agent — instant-save select */}
              <div>
                <p className={labelCls}>Assigned Agent</p>
                {b.agent ? (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-indigo-50/60 border border-indigo-100 rounded-lg">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(b.agent.email)} flex items-center justify-center text-white text-[12px] font-bold shrink-0`}>
                      {b.agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{b.agent.name}</p>
                      <p className="text-xs text-gray-400 truncate">{b.agent.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2 px-3 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-center">
                    <p className="text-[11px] text-gray-400">Unassigned</p>
                  </div>
                )}
                <AgentPicker
                  agents={agents}
                  value={b.agent_id ?? ''}
                  onChange={handleAgentChange}
                  disabled={saving || !isOpen}
                />
              </div>

              {/* Support Agents */}
              <div>
                <p className={labelCls}>Support Agents</p>
                <div className="space-y-2">
                  {(b.support_agents ?? []).map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 bg-violet-50/60 border border-violet-100 rounded-lg">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(a.email)} flex items-center justify-center text-white text-[12px] font-bold shrink-0`}>
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">{a.name}</p>
                        <p className="text-xs text-gray-400 truncate">{a.email}</p>
                      </div>
                      <button
                        disabled={!isOpen || saving}
                        onClick={() => { removeSupport({ id, agent_id: a.id }); flashSaved('agent'); }}
                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-violet-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  {(b.support_agents ?? []).length === 0 && (
                    <div className="px-3 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-center">
                      <p className="text-[11px] text-gray-400">No support agents yet</p>
                    </div>
                  )}
                  {isOpen && (() => {
                    const supportIds = new Set((b.support_agents ?? []).map(a => a.id));
                    const available = agents.filter(a => a.id !== b.agent_id && !supportIds.has(a.id));
                    return (
                      <SupportAgentPicker
                        available={available}
                        disabled={saving}
                        onAdd={agentId => { addSupport({ id, agent_id: agentId }); flashSaved('agent'); }}
                      />
                    );
                  })()}
                </div>
              </div>

              {/* DA details (shown when completed) */}
              {(b.da_number || b.da_description) && (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-3 space-y-2">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Completion Details</p>
                  {b.da_number && (() => {
                    const all = b.da_number!.split(',').map(s => s.trim()).filter(Boolean);
                    const shown = all.slice(0, 3);
                    const rest = all.slice(3);
                    return (
                      <div>
                        <p className="text-[10px] text-gray-400 font-semibold mb-1.5">DA Number</p>
                        <div className="flex flex-wrap gap-1 items-center">
                          {shown.map(da => (
                            <span key={da} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-700 text-[11px] font-mono font-bold shadow-sm whitespace-nowrap">
                              {da}
                            </span>
                          ))}
                          {rest.length > 0 && (
                            <span className="relative group/da inline-flex">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-700 text-[11px] font-mono font-bold cursor-default whitespace-nowrap">
                                +{rest.length} more
                              </span>
                              <div className="absolute left-0 top-full mt-1.5 z-[100] hidden group-hover/da:block bg-gray-900 text-white rounded-xl p-2.5 shadow-xl min-w-max space-y-1">
                                {all.map(da => (
                                  <div key={da} className="text-[10px] font-mono font-semibold tracking-tight">{da}</div>
                                ))}
                              </div>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {b.da_description && (
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold">Description</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{b.da_description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* History — collapsible */}
              {(() => {
                const EVENT_CFG: Record<string, { icon: string; color: string; label: (e: typeof bookingEvents[0]) => string }> = {
                  created:               { icon: '📩', color: 'bg-gray-100',   label: e => `Booking created${e.new_value ? ` · ${e.new_value}` : ''}` },
                  status_changed:        { icon: '🔄', color: 'bg-blue-50',    label: e => `Status → ${e.new_value === 'Pending' ? 'Open' : e.new_value}` },
                  priority_changed:      { icon: '⚡', color: 'bg-amber-50',   label: e => `Priority → ${e.new_value}` },
                  agent_assigned:        { icon: '👤', color: 'bg-indigo-50',  label: e => `Assigned to ${e.new_value ?? 'agent'}${e.old_value ? ` (${e.old_value})` : ''}` },
                  agent_unassigned:      { icon: '↩️', color: 'bg-gray-50',    label: () => 'Agent removed' },
                  no_agents_available:   { icon: '⚠️', color: 'bg-amber-50',   label: () => 'No present agents — stays Open' },
                  reply_received:        { icon: '💬', color: 'bg-sky-50',     label: e => `${e.new_value ?? 'Reply received'} — booking reopened` },
                  support_agent_added:   { icon: '👥', color: 'bg-violet-50',  label: e => `Support agent added: ${e.new_value ?? ''}` },
                  support_agent_removed: { icon: '👤', color: 'bg-gray-50',    label: e => `Support agent removed: ${e.old_value ?? ''}` },
                };
                return <HistorySection events={bookingEvents} eventCfg={EVENT_CFG} />;
              })()}

            </div>
          </div>
        </motion.div>
      </div>

      {/* ── DA Completion Modal ── */}
      <AnimatePresence>
        {showDaModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowDaModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 overflow-hidden"
            >
              {/* Modal header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Complete Booking</p>
                    <p className="text-[11px] text-gray-400">Enter DA details to close this ticket</p>
                  </div>
                </div>
                <button onClick={() => setShowDaModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    DA Number <span className="text-red-500">*</span>
                  </label>
                  <DaTagInput value={daNumber} onChange={setDaNumber} />
                  <p className="text-[10px] text-gray-400 mt-1">Press Enter or Tab after each number to add it</p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Description <span className="text-gray-300 font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={daDesc}
                    onChange={e => setDaDesc(e.target.value)}
                    placeholder="Add any notes about the completion..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowDaModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleDaConfirm}
                  disabled={!daNumber.split(',').some(s => s.trim()) || patching}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
                  {patching
                    ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />Saving…</>
                    : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Complete Booking</>
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
