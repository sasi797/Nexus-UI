'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem, fadeIn } from '@/lib/animations';
import {
  useGetBookingQuery, usePatchBookingStatusMutation,
  useUpdateBookingMutation, useDeleteBookingMutation,
} from '@/services/bookingsApi';

import { useGetAgentsQuery } from '@/services/agentsApi';
import { useGetAllocationLogQuery } from '@/services/allocationsApi';
import EmailThread from '@/components/EmailThread';

type Tab = 'Conversation' | 'History';
type ComposeTab = 'Reply' | 'Reply All' | 'Forward';

/* ── helpers ── */
const PRIORITY_LEFT: Record<string, string> = {
  Urgent: 'border-l-red-500', Standard: 'border-l-indigo-400', Economy: 'border-l-gray-300',
};
const PRIORITY_BADGE: Record<string, string> = {
  Urgent: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  Standard: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  Economy: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};
const PRIORITY_PILL_ON: Record<string, string> = {
  Urgent: 'bg-red-50 text-red-700 border-red-300',
  Standard: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  Economy: 'bg-emerald-50 text-emerald-700 border-emerald-300',
};
const PRIORITY_DOT: Record<string, string> = {
  Urgent: 'bg-red-500', Standard: 'bg-indigo-400', Economy: 'bg-emerald-500',
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

export default function BookingDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const [activeTab, setActiveTab]         = useState<Tab>('Conversation');
  const [composeTab, setComposeTab]       = useState<ComposeTab>('Reply');
  const [savedField, setSavedField]       = useState<string | null>(null);

  const { data: b, isLoading }                   = useGetBookingQuery(id);
  const [patchStatus,   { isLoading: patching }] = usePatchBookingStatusMutation();
  const [updateBooking, { isLoading: saving }]   = useUpdateBookingMutation();
  const [deleteBooking, { isLoading: deleting }] = useDeleteBookingMutation();
  const { data: agents = [] }                    = useGetAgentsQuery();
  const { data: allocLog = [] }                  = useGetAllocationLogQuery({ booking_id: id });

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

  const handleClose = () => patchStatus({ id, status: 'Completed' });

  const handleDelete = async () => {
    if (!window.confirm(`Delete booking ${b?.id}? This cannot be undone.`)) return;
    await deleteBooking(id);
    router.push('/dashboard/my-bookings');
  };

  const focusCompose = (tab: ComposeTab) => {
    setComposeTab(tab);
    setActiveTab('Conversation');
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
      <div className="flex gap-5 items-start">

        {/* ── Left main panel ── */}
        <motion.div variants={staggerItem} className={`flex-1 min-w-0 bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${PRIORITY_LEFT[b.priority] ?? 'border-l-gray-200'} overflow-hidden`}>

          {/* Subject header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <Link href="/dashboard/my-bookings"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-indigo-600 transition-colors mb-3">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              My Bookings
            </Link>
            <div className="flex items-start gap-4">
              {/* Sender avatar */}
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(b.sender_email)} flex items-center justify-center text-white text-[14px] font-bold shrink-0 shadow-sm mt-0.5`}>
                {b.sender_email.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-bold text-gray-400 font-mono">{b.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[b.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                    {b.priority}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOpen ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                    {isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-snug">{b.subject}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  <span className="font-semibold text-gray-600">{extractName(b.sender_email)}</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  <span className="text-gray-400">{b.sender_email}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-1.5">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => focusCompose('Reply')}
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Reply
            </motion.button>

            <button onClick={() => focusCompose('Reply All')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6M8 10h5" />
              </svg>
              Reply All
            </button>

            <button onClick={() => focusCompose('Forward')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              Forward
            </button>

            <div className="flex-1" />

            {isOpen && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                disabled={patching}
                onClick={handleClose}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {patching ? 'Closing…' : 'Close ticket'}
              </motion.button>
            )}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              disabled={deleting}
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-60 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </motion.button>
          </div>

          {/* Tabs */}
          <div className="px-5 border-b border-gray-100 flex items-center gap-1">
            {(['Conversation', 'History'] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`relative px-3 py-2.5 text-xs font-bold transition-colors ${activeTab === tab ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="detail-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} variants={fadeIn} initial="hidden" animate="visible" exit="hidden" className="p-5">

              {activeTab === 'Conversation' && (
                <EmailThread
                  bookingId={b.id}
                  senderEmail={b.sender_email}
                  replyRef={replyRef}
                  composeTab={composeTab}
                  onComposeTabChange={setComposeTab}
                />
              )}

              {activeTab === 'History' && (() => {
                const firstLogTime = allocLog.length > 0
                  ? new Date(allocLog[0].allocated_at).getTime()
                  : Infinity;
                const needsSynthetic = !!b.assigned_at && new Date(b.assigned_at).getTime() < firstLogTime;

                const assignEvents = [
                  ...(needsSynthetic ? [{
                    time: b.assigned_at as string,
                    label: allocLog.length === 0
                      ? `Auto-assigned to ${b.agent?.name ?? 'agent'}`
                      : 'Auto-assigned (round-robin)',
                    color: 'bg-sky-50', icon: '🔄',
                  }] : []),
                  ...allocLog.map((log, i) => ({
                    time:  log.allocated_at,
                    label: log.pointer_value === -1
                      ? `Manually assigned to ${log.agent?.name ?? 'agent'}`
                      : `Auto-assigned to ${log.agent?.name ?? 'agent'} (round-robin #${i + 1})`,
                    color: log.pointer_value === -1 ? 'bg-indigo-50' : 'bg-sky-50',
                    icon:  log.pointer_value === -1 ? '✏️' : '🔄',
                  })),
                ];

                const events = [
                  { time: b.received_at, label: 'Booking received', color: 'bg-gray-100', icon: '📩' },
                  ...(b.completed_at ? [{ time: b.completed_at, label: 'Booking closed', color: 'bg-emerald-50', icon: '✅' }] : []),
                  ...assignEvents,
                ].sort((a, bk) => new Date(a.time).getTime() - new Date(bk.time).getTime());

                return (
                  <div className="relative">
                    <div className="absolute left-[11px] top-4 bottom-4 w-px bg-gray-100" />
                    {events.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 relative py-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 z-10 ring-2 ring-white ${h.color}`}>
                          {h.icon}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-xs font-semibold text-gray-700">{h.label}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(h.time).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {events.length === 0 && <p className="text-xs text-gray-400 py-6 text-center">No history yet</p>}
                  </div>
                );
              })()}

            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ── Right sidebar ── */}
        <motion.div variants={staggerItem} className="w-72 shrink-0">
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
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(b.sender_email)} flex items-center justify-center text-white text-[12px] font-bold shrink-0`}>
                    {b.sender_email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{extractName(b.sender_email)}</p>
                    <p className="text-[10px] text-gray-400 truncate">{b.sender_email}</p>
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
                      disabled={saving || patching}
                      onClick={() => handleStatusChange(s)}
                      className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
                        b.status === s
                          ? STATUS_PILL_ON[s]
                          : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.status === s ? STATUS_DOT[s] : 'bg-gray-300'}`} />
                      {s === 'In Progress' ? 'In Prog.' : s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority — instant-save pills */}
              <div>
                <p className={labelCls}>Priority</p>
                <div className="flex gap-1.5">
                  {(['Urgent', 'Standard', 'Economy'] as const).map(p => (
                    <button
                      key={p}
                      disabled={saving || patching}
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

              {/* Agent — instant-save select */}
              <div>
                <p className={labelCls}>Assigned Agent</p>
                {b.agent ? (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-indigo-50/60 border border-indigo-100 rounded-lg">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarColor(b.agent.email)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                      {b.agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 truncate">{b.agent.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{b.agent.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2 px-3 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-center">
                    <p className="text-[11px] text-gray-400">Unassigned</p>
                  </div>
                )}
                <select
                  value={b.agent_id ?? ''}
                  onChange={e => handleAgentChange(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-all appearance-none cursor-pointer disabled:opacity-60"
                >
                  <option value="">— Unassigned —</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}{a.shift ? ` · ${a.shift.name}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Dates */}
              <div className="space-y-3">
                <div>
                  <p className={labelCls}>Received</p>
                  <p className="text-xs font-semibold text-gray-700">
                    {new Date(b.received_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {b.assigned_at && (
                  <div>
                    <p className={labelCls}>Assigned</p>
                    <p className="text-xs font-semibold text-gray-700">
                      {new Date(b.assigned_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
                {b.completed_at && (
                  <div>
                    <p className={labelCls}>Closed</p>
                    <p className="text-xs font-semibold text-gray-700">
                      {new Date(b.completed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>

              {/* Cargo info if present */}
              {(b.cargo_type || b.shipping_mode || b.pickup_location || b.delivery_location) && (
                <>
                  <div className="border-t border-gray-100" />
                  <div className="space-y-3">
                    {b.cargo_type && (
                      <div>
                        <p className={labelCls}>Cargo Type</p>
                        <p className="text-xs font-medium text-gray-700 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">{b.cargo_type}</p>
                      </div>
                    )}
                    {b.shipping_mode && (
                      <div>
                        <p className={labelCls}>Shipping Mode</p>
                        <p className="text-xs font-medium text-gray-700 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">{b.shipping_mode}</p>
                      </div>
                    )}
                    {b.pickup_location && (
                      <div>
                        <p className={labelCls}>Pickup</p>
                        <p className="text-xs font-medium text-gray-700 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">{b.pickup_location}</p>
                      </div>
                    )}
                    {b.delivery_location && (
                      <div>
                        <p className={labelCls}>Delivery</p>
                        <p className="text-xs font-medium text-gray-700 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">{b.delivery_location}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
