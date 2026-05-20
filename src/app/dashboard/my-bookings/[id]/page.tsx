'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem, fadeIn, popIn } from '@/lib/animations';
import { useGetBookingQuery, usePatchBookingStatusMutation, useUpdateBookingMutation } from '@/services/bookingsApi';
import { useGetAgentsQuery } from '@/services/agentsApi';
import EmailThread from '@/components/EmailThread';

type Tab = 'Analysis' | 'Conversation' | 'History';

interface CargoForm {
  cargo_type: string; pickup_location: string; delivery_location: string;
  cargo_weight: string; cargo_volume: string; shipping_mode: string;
  special_instructions: string; remarks: string;
}

const SHIPPING_MODES = ['Air Freight', 'Sea Freight', 'Road', 'Rail', 'Courier'];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'In Progress': 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    Pending:       'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    Completed:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  };
  const dots: Record<string, string> = {
    'In Progress': 'bg-blue-500', Pending: 'bg-amber-500', Completed: 'bg-emerald-500',
  };
  return (
    <motion.span variants={popIn} initial="hidden" animate="visible"
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? 'bg-gray-400'}`} />{status}
    </motion.span>
  );
}

const inputCls = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-all';
const labelCls = 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('Conversation');
  const tabs: Tab[] = ['Conversation', 'Analysis', 'History'];

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [agentSaved, setAgentSaved] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CargoForm>({
    cargo_type: '', pickup_location: '', delivery_location: '',
    cargo_weight: '', cargo_volume: '', shipping_mode: '',
    special_instructions: '', remarks: '',
  });
  const [detailsSaved, setDetailsSaved] = useState(false);

  const { data: b, isLoading } = useGetBookingQuery(id);
  const [patchStatus, { isLoading: patching }] = usePatchBookingStatusMutation();
  const [updateBooking, { isLoading: saving }] = useUpdateBookingMutation();
  const { data: agents = [] } = useGetAgentsQuery();

  useEffect(() => {
    if (!b) return;
    setForm({
      cargo_type:           b.cargo_type ?? '',
      pickup_location:      b.pickup_location ?? '',
      delivery_location:    b.delivery_location ?? '',
      cargo_weight:         b.cargo_weight ? String(b.cargo_weight) : '',
      cargo_volume:         b.cargo_volume ? String(b.cargo_volume) : '',
      shipping_mode:        b.shipping_mode ?? '',
      special_instructions: b.special_instructions ?? '',
      remarks:              b.remarks ?? '',
    });
  }, [b]);

  const currentAgentId = b?.agent_id ? String(b.agent_id) : '';

  const handleSaveAgent = async () => {
    if (!selectedAgentId) return;
    await updateBooking({ id, body: { agent_id: selectedAgentId } });
    setAgentSaved(true);
    setTimeout(() => setAgentSaved(false), 2000);
  };

  const handleSaveDetails = async () => {
    await updateBooking({
      id,
      body: {
        cargo_type:           form.cargo_type || undefined,
        pickup_location:      form.pickup_location || undefined,
        delivery_location:    form.delivery_location || undefined,
        cargo_weight:         form.cargo_weight ? Number(form.cargo_weight) : undefined,
        cargo_volume:         form.cargo_volume ? Number(form.cargo_volume) : undefined,
        shipping_mode:        form.shipping_mode || undefined,
        special_instructions: form.special_instructions || undefined,
        remarks:              form.remarks || undefined,
      },
    });
    setEditing(false);
    setDetailsSaved(true);
    setTimeout(() => setDetailsSaved(false), 2000);
  };

  const set = (k: keyof CargoForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }
  if (!b) return <p className="text-gray-400 text-sm">Booking not found.</p>;

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4 max-w-4xl">
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <Link href="/dashboard/my-bookings">
          <motion.div whileHover={{ x: -3 }} whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 font-semibold cursor-pointer transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Bookings
          </motion.div>
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={b.status} />
          {b.status !== 'Completed' && (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              disabled={patching}
              onClick={() => patchStatus({ id: b.id, status: b.status === 'Pending' ? 'In Progress' : 'Completed' })}
              className="text-xs font-bold px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg shadow-sm disabled:opacity-60">
              {patching ? 'Updating...' : b.status === 'Pending' ? 'Start' : 'Complete'}
            </motion.button>
          )}
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{b.id}</p>
              <h2 className="text-base font-bold text-gray-900">{b.subject}</h2>
              <p className="text-xs text-gray-400 mt-0.5">From: {b.sender_email}</p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${b.priority === 'Urgent' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : b.priority === 'Standard' ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'}`}>
              {b.priority}
            </span>
          </div>
        </div>

        <div className="px-5 border-b border-gray-100 flex items-center gap-1">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`relative px-3 py-2.5 text-xs font-bold transition-colors ${activeTab === tab ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="detail-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} variants={fadeIn} initial="hidden" animate="visible" exit="hidden" className="p-5">

            {false && (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">

                {/* Cargo Details — hidden, Details tab removed */}
                <motion.div variants={staggerItem}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Cargo Details</p>
                    <div className="flex items-center gap-2">
                      <AnimatePresence>
                        {detailsSaved && (
                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-xs font-semibold text-emerald-600">✓ Saved</motion.span>
                        )}
                      </AnimatePresence>
                      {editing ? (
                        <div className="flex gap-1.5">
                          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => setEditing(false)}
                            className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 transition-all">
                            Cancel
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={handleSaveDetails} disabled={saving}
                            className="text-xs font-bold px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg shadow-sm disabled:opacity-60">
                            {saving ? 'Saving…' : 'Save Changes'}
                          </motion.button>
                        </div>
                      ) : (
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => setEditing(true)}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Details
                        </motion.button>
                      )}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {editing ? (
                      <motion.div key="edit" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Cargo Type</label>
                          <input value={form.cargo_type} onChange={set('cargo_type')} placeholder="e.g. Electronics"
                            className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Shipping Mode</label>
                          <select value={form.shipping_mode} onChange={set('shipping_mode')} className={inputCls}>
                            <option value="">— Select —</option>
                            {SHIPPING_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Pickup Location</label>
                          <input value={form.pickup_location} onChange={set('pickup_location')} placeholder="e.g. Chennai, India"
                            className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Delivery Location</label>
                          <input value={form.delivery_location} onChange={set('delivery_location')} placeholder="e.g. Trichy, India"
                            className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Weight (kg)</label>
                          <input type="number" value={form.cargo_weight} onChange={set('cargo_weight')} placeholder="e.g. 1500"
                            className={inputCls} min="0" step="0.01" />
                        </div>
                        <div>
                          <label className={labelCls}>Volume (m³)</label>
                          <input type="number" value={form.cargo_volume} onChange={set('cargo_volume')} placeholder="e.g. 4.5"
                            className={inputCls} min="0" step="0.01" />
                        </div>
                        <div className="col-span-2">
                          <label className={labelCls}>Special Instructions</label>
                          <textarea value={form.special_instructions} onChange={set('special_instructions')}
                            placeholder="e.g. Handle with care. Fragile items."
                            rows={2} className={`${inputCls} resize-none`} />
                        </div>
                        <div className="col-span-2">
                          <label className={labelCls}>Remarks</label>
                          <textarea value={form.remarks} onChange={set('remarks')}
                            placeholder="Internal notes"
                            rows={2} className={`${inputCls} resize-none`} />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Cargo Type',       value: b.cargo_type },
                          { label: 'Shipping Mode',     value: b.shipping_mode },
                          { label: 'Pickup Location',   value: b.pickup_location },
                          { label: 'Delivery Location', value: b.delivery_location },
                          { label: 'Weight (kg)',       value: b.cargo_weight ? String(b.cargo_weight) : null },
                          { label: 'Volume (m³)',       value: b.cargo_volume ? String(b.cargo_volume) : null },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50/70 rounded-xl px-4 py-3 border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                            <p className={`text-sm font-semibold ${value ? 'text-gray-800' : 'text-gray-300'}`}>{value || '—'}</p>
                          </div>
                        ))}
                        {b.special_instructions && (
                          <div className="col-span-2 bg-amber-50/60 rounded-xl px-4 py-3 border border-amber-100">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Special Instructions</p>
                            <p className="text-sm text-gray-700">{b.special_instructions}</p>
                          </div>
                        )}
                        {b.remarks && (
                          <div className="col-span-2 bg-gray-50/70 rounded-xl px-4 py-3 border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Remarks</p>
                            <p className="text-sm text-gray-700">{b.remarks}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Received */}
                <motion.div variants={staggerItem} className="bg-gray-50/70 rounded-xl px-4 py-3 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Received</p>
                  <p className="text-sm text-gray-800 font-semibold">{new Date(b.received_at).toLocaleString('en-GB')}</p>
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'Analysis' && (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                {[
                  { label: 'Cargo Classification', value: b.cargo_type ?? '—', icon: '📦' },
                  { label: 'Estimated Transit Time', value: '3–5 business days', icon: '🕐' },
                  { label: 'Risk Level', value: 'Low', icon: '🛡️' },
                  { label: 'Compliance Status', value: 'Cleared', icon: '✅' },
                ].map(item => (
                  <motion.div key={item.label} variants={staggerItem}
                    className="flex items-center justify-between p-3 bg-gray-50/70 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-xs font-semibold text-gray-600">{item.label}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-800">{item.value}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {activeTab === 'Conversation' && (
              <div className="space-y-4">
                {/* Assigned Agent */}
                <div className="flex items-center gap-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 shrink-0">Assigned Agent</span>
                  <select
                    value={selectedAgentId || currentAgentId}
                    onChange={e => setSelectedAgentId(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium"
                  >
                    <option value="">— Unassigned —</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}{a.shift ? ` · ${a.shift.name}` : ''}</option>
                    ))}
                  </select>
                  <motion.button
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={handleSaveAgent} disabled={saving || !selectedAgentId}
                    className="text-xs font-bold px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-60 min-w-[56px] shrink-0"
                  >
                    <AnimatePresence mode="wait">
                      {agentSaved
                        ? <motion.span key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>✓ Saved</motion.span>
                        : <motion.span key="sv" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{saving ? '…' : 'Assign'}</motion.span>}
                    </AnimatePresence>
                  </motion.button>
                </div>

                <EmailThread bookingId={b.id} senderEmail={b.sender_email} />
              </div>
            )}

            {activeTab === 'History' && (
              <div className="space-y-3">
                {[
                  { time: b.received_at, event: 'Booking received', icon: '📩' },
                  ...(b.assigned_at ? [{ time: b.assigned_at, event: `Assigned to ${b.agent?.name ?? 'agent'}`, icon: '👤' }] : []),
                  ...(b.completed_at ? [{ time: b.completed_at, event: 'Booking completed', icon: '✅' }] : []),
                ].map((h, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs shrink-0 mt-0.5">{h.icon}</div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{h.event}</p>
                      <p className="text-[10px] text-gray-400">{new Date(h.time).toLocaleString('en-GB')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
