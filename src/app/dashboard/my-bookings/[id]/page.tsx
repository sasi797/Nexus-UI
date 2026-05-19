'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem, staggerContainer, fadeIn, popIn } from '@/lib/animations';
import { useGetBookingQuery, usePatchBookingStatusMutation } from '@/services/bookingsApi';

type Tab = 'Details' | 'Analysis' | 'Attachments' | 'History';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'In Progress': 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    Pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    Completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <motion.div variants={staggerItem} className="bg-gray-50/70 rounded-xl px-4 py-3 border border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-800 font-semibold">{value || 'e2014'}</p>
    </motion.div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('Analysis');
  const tabs: Tab[] = ['Details', 'Analysis', 'Attachments', 'History'];

  const { data: b, isLoading } = useGetBookingQuery(id);
  const [patchStatus, { isLoading: patching }] = usePatchBookingStatusMutation();

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
            {activeTab === 'Details' && (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 gap-3">
                <InfoCard label="Received" value={new Date(b.received_at).toLocaleString('en-GB')} />
                <InfoCard label="Assigned Agent" value={b.agent?.name ?? 'Unassigned'} />
                <InfoCard label="Shipping Mode" value={b.shipping_mode ?? ''} />
                <InfoCard label="Cargo Type" value={b.cargo_type ?? ''} />
                <InfoCard label="Pickup" value={b.pickup_location ?? ''} />
                <InfoCard label="Delivery" value={b.delivery_location ?? ''} />
                <InfoCard label="Weight (kg)" value={b.cargo_weight ? String(b.cargo_weight) : ''} />
                <InfoCard label="Volume (m3)" value={b.cargo_volume ? String(b.cargo_volume) : ''} />
                {b.special_instructions && (
                  <div className="col-span-2 bg-amber-50/60 rounded-xl px-4 py-3 border border-amber-100">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Special Instructions</p>
                    <p className="text-sm text-gray-700">{b.special_instructions}</p>
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'Analysis' && (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                {[
                  { label: 'Cargo Classification', value: b.cargo_type ?? 'General Goods', icon: '📦' },
                  { label: 'Estimated Transit Time', value: '3-5 business days', icon: '🕐' },
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
            {activeTab === 'Attachments' && (
              <div className="py-8 text-center">
                <div className="text-3xl mb-2">📎</div>
                <p className="text-sm font-semibold text-gray-400">No attachments uploaded</p>
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