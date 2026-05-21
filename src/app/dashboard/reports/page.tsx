'use client';

import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Table, { ColumnDef } from '@/components/Table';
import { pageTransition, staggerItem, popIn, cardHover, staggerContainer } from '@/lib/animations';
import { useGetReportStatsQuery, useGetTrendQuery, useGetPriorityDistributionQuery, useGetDailySummaryQuery, DailySummaryRow } from '@/services/reportsApi';

export default function ReportsPage() {
  const { data: stats } = useGetReportStatsQuery();
  const { data: trend = [] } = useGetTrendQuery({ days: 7 });
  const { data: priorityDist = [] } = useGetPriorityDistributionQuery();
  const { data: dailySummary = [] } = useGetDailySummaryQuery({ days: 7 });

  const statCards = stats ? [
    { label: 'Total Bookings', value: stats.total_bookings, change: '+12%', up: true,  bg: 'from-indigo-50 to-violet-50',  text: 'text-indigo-700',  icon: '📊' },
    { label: 'Completed',      value: stats.completed,      change: '+18%', up: true,  bg: 'from-emerald-50 to-teal-50',   text: 'text-emerald-700', icon: '✅' },
    { label: 'Pending',        value: stats.pending,        change: '-5%',  up: false, bg: 'from-amber-50 to-orange-50',   text: 'text-amber-700',   icon: '⏳' },
    { label: 'SLA Breach',     value: stats.sla_breach,     change: '-15%', up: false, bg: 'from-red-50 to-rose-50',       text: 'text-red-700',     icon: '🚨' },
  ] : [];

  const summaryColumns: ColumnDef<DailySummaryRow>[] = [
    { key: 'date',      header: 'Date',      sortable: true, render: v => <span className="font-bold text-gray-700">{String(v)}</span> },
    { key: 'received',  header: 'Received',  sortable: true, render: v => <span className="font-medium text-gray-600">{String(v)}</span> },
    { key: 'completed', header: 'Completed', sortable: true, render: v => <span className="font-bold text-emerald-600">{String(v)}</span> },
    { key: 'pending',   header: 'Pending',   sortable: true, render: v => <span className="font-bold text-amber-600">{String(v)}</span> },
    {
      key: 'rate', header: 'Completion Rate', sortable: true,
      render: v => {
        const rate = Number(v);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${rate}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
            </div>
            <span className="text-xs font-bold text-gray-500 w-8 text-right">{rate}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <motion.div whileHover={{ scale: 1.02 }}
          className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm font-medium">
          <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          Last 7 days
        </motion.div>
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-4 gap-3">
        {statCards.map(s => (
          <motion.div key={s.label} variants={popIn} initial="rest" whileHover="hover" animate="rest">
            <motion.div variants={cardHover} className={`bg-gradient-to-br ${s.bg} rounded-xl p-4 border border-white shadow-sm cursor-default`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-gray-500">{s.label}</p>
                <span className="text-lg">{s.icon}</span>
              </div>
              <div className="flex items-end justify-between">
                <motion.p initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                  className={`text-3xl font-black ${s.text}`}>{s.value}</motion.p>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${s.up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  {s.up ? '↑' : '↓'} {s.change}
                </span>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-5 gap-3">
        <motion.div variants={staggerItem} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-100/80 p-4">
          <h2 className="text-xs font-bold text-gray-900 mb-3">Bookings Trend</h2>
          <ResponsiveContainer width="100%" height={185}>
            <LineChart data={trend} margin={{ top: 5, right: 16, left: -14, bottom: 5 }}>
              <defs>
                <linearGradient id="cR" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6366f1"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient>
                <linearGradient id="cC" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#14b8a6"/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}/>
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }}/>
              <Line type="monotone" dataKey="received" name="Received" stroke="url(#cR)" strokeWidth={2.5} dot={{ r: 3.5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }}/>
              <Line type="monotone" dataKey="completed" name="Completed" stroke="url(#cC)" strokeWidth={2.5} dot={{ r: 3.5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }}/>
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={staggerItem} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100/80 p-4">
          <h2 className="text-xs font-bold text-gray-900 mb-1">Bookings by Priority</h2>
          <div className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={165} height={165}>
                <PieChart>
                  <Pie data={priorityDist} cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={4} dataKey="value">
                    {priorityDist.map((e, i) => <Cell key={i} fill={e.color} stroke="white" strokeWidth={2}/>)}
                  </Pie>
                  <Tooltip formatter={v => [`${v}%`, '']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.5 }} className="text-xl font-black text-gray-900">
                  {stats?.total_bookings ?? '—'}
                </motion.p>
                <p className="text-[10px] text-gray-400 font-medium">Total</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-1 w-full px-2">
              {priorityDist.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}/>
                    <span className="text-xs text-gray-600 font-medium">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-700">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-xs">Daily Summary</h2>
        </div>
        <Table columns={summaryColumns} data={dailySummary} rowKey={row => row.date} />
      </motion.div>
    </motion.div>
  );
}