'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import Table, { ColumnDef } from '@/components/Table';
import { useGetBookingsQuery, BookingListItem } from '@/services/bookingsApi';
import ApiErrorState from '@/components/ApiErrorState';

type Tab = 'All' | 'Pending' | 'In Progress' | 'Completed';
const tabs: Tab[] = ['All', 'Pending', 'In Progress', 'Completed'];

const priorityStyle: Record<string, string> = {
  Urgent:   'bg-red-50 text-red-700 ring-1 ring-red-200',
  Standard: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  Economy:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};
const statusStyle: Record<string, string> = {
  'In Progress': 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  Pending:       'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Completed:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const status = activeTab === 'All' ? undefined : activeTab;
  const { data: bookings = [], isLoading, isFetching, isError, refetch } = useGetBookingsQuery({ status, limit: 100 });

  const columns: ColumnDef<BookingListItem>[] = [
    {
      key: 'id', header: 'Booking ID', sortable: true,
      render: v => <Link href={`/dashboard/my-bookings/${v}`} className="font-bold text-indigo-600 hover:text-indigo-800">{String(v)}</Link>,
    },
    { key: 'subject',  header: 'Subject',  sortable: true, filterable: true, render: v => <span className="font-medium text-gray-700">{String(v)}</span> },
    {
      key: 'priority', header: 'Priority', sortable: true, filterable: true,
      render: v => <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ${priorityStyle[String(v)] ?? ''}`}>{String(v)}</span>,
    },
    {
      key: 'status', header: 'Status', sortable: true, filterable: true,
      render: v => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${statusStyle[String(v)] ?? ''}`}>{String(v)}</span>,
    },
    {
      key: 'received_at', header: 'Received At', sortable: true,
      render: v => <span className="text-gray-400">{new Date(String(v)).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>,
    },
    {
      key: 'id', header: 'Actions', width: '60px',
      render: v => (
        <Link href={`/dashboard/my-bookings/${v}`}>
          <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
            className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </motion.div>
        </Link>
      ),
    },
  ];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3">
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">My Bookings</h1>
        <span className="text-xs text-gray-400 font-medium">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
      </motion.div>

      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        <div className="px-4 border-b border-gray-100 flex items-center gap-1 relative">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`relative px-3 py-2.5 text-xs font-bold transition-colors ${activeTab === tab ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-700'}`}>
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="booking-tab-line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          ))}
          {isFetching && <div className="ml-auto w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {isLoading
              ? <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
              : isError
                ? <ApiErrorState title="Failed to load bookings" onRetry={refetch} />
                : <Table columns={columns} data={bookings} rowKey={r => r.id} emptyMessage={`No ${activeTab === 'All' ? '' : activeTab} bookings`} />
            }
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
