'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer } from 'recharts';
import Table, { ColumnDef } from '@/components/Table';
import { pageTransition, staggerItem, popIn, cardHover, staggerContainer } from '@/lib/animations';
import { useGetReportStatsQuery, useGetPriorityDistributionQuery, useGetDailySummaryQuery, useGetHourlyActivityQuery, useGetAvgCompletionQuery, useGetStatusBreakdownQuery, DailySummaryRow, HourlyPoint } from '@/services/reportsApi';

type ViewMode = 'chart' | 'table';

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {(['chart', 'table'] as ViewMode[]).map(v => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all capitalize ${
            view === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}>
          {v === 'chart' ? '📊 Chart' : '📋 Table'}
        </button>
      ))}
    </div>
  );
}

function HourlyTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  const h = payload?.value ?? 0;
  const fmt = (n: number) => String(n).padStart(2, '0');
  const endLabel = h === 23 ? '23:59' : `${fmt(h + 1)}:00`;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={4} transform="rotate(-45)" textAnchor="end" fill="#94a3b8" fontSize={7.5}>
        {`${fmt(h)}:00–${endLabel}`}
      </text>
    </g>
  );
}

function HourlyTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; color: string }[] }) {
  if (!active || !payload?.length) return null;
  const h = Number((payload[0] as unknown as { payload: { hour: number } }).payload.hour);
  const fmt = (n: number) => String(n).padStart(2, '0');
  const endLabel = h === 23 ? '23:59' : `${fmt(h + 1)}:00`;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3.5 py-2.5 text-[11px]">
      <p className="font-bold text-gray-700 mb-1.5">{`${fmt(h)}:00 – ${endLabel}`}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [hourlyView, setHourlyView] = useState<ViewMode>('chart');
  const [avgView, setAvgView] = useState<ViewMode>('chart');
  const todayISO = new Date().toISOString().split('T')[0];
  const [hourlyDate, setHourlyDate] = useState(todayISO);

  const { data: stats } = useGetReportStatsQuery();
  const { data: statusBreakdown = [] } = useGetStatusBreakdownQuery();
  const { data: priorityDist = [] } = useGetPriorityDistributionQuery();
  const { data: dailySummary = [] } = useGetDailySummaryQuery({ days: 7 });
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data: hourly = [] } = useGetHourlyActivityQuery({ date: hourlyDate, tz: userTz });
  const { data: avgCompletion } = useGetAvgCompletionQuery();
  const maxAvgHours = avgCompletion ? Math.max(...avgCompletion.by_priority.map(x => x.avg_hours), 1) : 1;
  const PRIORITY_COLORS: Record<string, string> = { 'Very Urgent': 'bg-red-400', 'Urgent': 'bg-amber-400', 'Not Urgent': 'bg-emerald-400' };

  const hourlyTableData = hourly.map(h => ({
    ...h,
    rate: h.received > 0 ? Math.round((h.completed / h.received) * 100) : 0,
  }));

  const avgTableData = avgCompletion ? [
    { priority: 'Overall', avg_hours: avgCompletion.overall_avg_hours, count: avgCompletion.overall_count },
    ...avgCompletion.by_priority,
  ] : [];

  const hourlyColumns: ColumnDef<HourlyPoint & { rate: number }>[] = [
    {
      key: 'label', header: 'Hour', sortable: true,
      render: v => {
        const h = parseInt(String(v), 10);
        const end = (h + 1) % 24;
        const fmt = (n: number) => String(n).padStart(2, '0');
        return <span className="font-semibold text-gray-700">{`${fmt(h)}:00 – ${fmt(end)}:00`}</span>;
      },
    },
    { key: 'received',  header: 'Received',           sortable: true,  render: v => <span className="font-medium text-indigo-600">{String(v)}</span> },
    { key: 'completed', header: 'Completed',          sortable: true,  render: v => <span className="font-bold text-emerald-600">{String(v)}</span> },
    {
      key: 'rate', header: 'Completion Rate', sortable: true,
      render: v => {
        const rate = Number(v);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${rate}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
            </div>
            <span className="text-xs font-bold text-gray-500 w-8 text-right">{rate}%</span>
          </div>
        );
      },
    },
  ];

  const avgColumns: ColumnDef<{ priority: string; avg_hours: number; count: number }>[] = [
    {
      key: 'priority', header: 'Priority', sortable: true,
      render: (v) => {
        const isOverall = v === 'Overall';
        const colorMap: Record<string, string> = { 'Very Urgent': 'text-red-600', 'Urgent': 'text-amber-600', 'Not Urgent': 'text-emerald-600', 'Overall': 'text-indigo-700' };
        return <span className={`font-bold text-sm ${colorMap[String(v)] ?? 'text-gray-700'} ${isOverall ? 'italic' : ''}`}>{String(v)}</span>;
      },
    },
    {
      key: 'avg_hours', header: 'Avg Hours', sortable: true,
      render: v => <span className="font-bold text-gray-800">{Number(v).toFixed(1)}h</span>,
    },
    {
      key: 'count', header: 'Bookings', sortable: true,
      render: v => <span className="font-medium text-gray-600">{String(v)}</span>,
    },
  ];

  const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v}%`;
  const chg = (v: number | undefined) => v ?? 0;
  const statCards = stats ? [
    { label: 'Total Bookings', value: stats.total_bookings, change: fmt(chg(stats.total_bookings_change)), up: chg(stats.total_bookings_change) >= 0, bg: 'from-indigo-50 to-violet-50',  text: 'text-indigo-700',  icon: '📊' },
    { label: 'Completed',      value: stats.completed,      change: fmt(chg(stats.completed_change)),      up: chg(stats.completed_change) >= 0,      bg: 'from-emerald-50 to-teal-50',   text: 'text-emerald-700', icon: '✅' },
    { label: 'Open',           value: stats.pending,        change: fmt(chg(stats.pending_change)),        up: chg(stats.pending_change) <= 0,        bg: 'from-amber-50 to-orange-50',   text: 'text-amber-700',   icon: '⏳' },
    { label: 'SLA Breach',     value: stats.sla_breach,     change: fmt(chg(stats.sla_breach_change)),     up: chg(stats.sla_breach_change) <= 0,     bg: 'from-red-50 to-rose-50',       text: 'text-red-700',     icon: '🚨' },
  ] : [];

  const summaryColumns: ColumnDef<DailySummaryRow>[] = [
    { key: 'date',      header: 'Date',      sortable: true, render: v => <span className="font-bold text-gray-700">{String(v)}</span> },
    { key: 'received',  header: 'Received',  sortable: true, render: v => <span className="font-medium text-gray-600">{String(v)}</span> },
    { key: 'completed', header: 'Completed', sortable: true, render: v => <span className="font-bold text-emerald-600">{String(v)}</span> },
    { key: 'pending',   header: 'Open',      sortable: true, render: v => <span className="font-bold text-amber-600">{String(v)}</span> },
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

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <motion.div variants={staggerItem} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="col-span-1 lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-xs font-bold text-gray-900">Booking Status by Priority</h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] font-semibold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Pending</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />In Progress</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Completed</span>
            </div>
          </div>
          {statusBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-[185px] text-gray-300 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={185}>
              <BarChart data={statusBreakdown} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="priority" tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} />
                <Bar dataKey="in_progress" name="In Progress" stackId="a" fill="#60a5fa" />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div variants={staggerItem} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100/80 p-4">
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

      {/* Hourly Activity + Avg Completion */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <motion.div variants={staggerItem} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="col-span-1 lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-gray-900">Hourly Activity</h2>
              {/* Date navigation */}
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => {
                    const d = new Date(hourlyDate);
                    d.setDate(d.getDate() - 1);
                    setHourlyDate(d.toISOString().split('T')[0]);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-sm"
                >‹</button>
                <input
                  type="date"
                  value={hourlyDate}
                  max={todayISO}
                  onChange={e => setHourlyDate(e.target.value)}
                  className="text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-lg px-2 py-0.5 bg-white cursor-pointer focus:outline-none focus:border-indigo-300"
                />
                <button
                  onClick={() => {
                    const d = new Date(hourlyDate);
                    d.setDate(d.getDate() + 1);
                    const next = d.toISOString().split('T')[0];
                    if (next <= todayISO) setHourlyDate(next);
                  }}
                  disabled={hourlyDate >= todayISO}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                >›</button>
                {hourlyDate !== todayISO && (
                  <button
                    onClick={() => setHourlyDate(todayISO)}
                    className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
                  >Today</button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hourlyView === 'table' && (
                <button
                  onClick={() => downloadCSV(
                    'hourly-activity.csv',
                    ['Hour', 'Received', 'Completed', 'Completion Rate (%)'],
                    hourlyTableData.map(h => {
                      const end = (h.hour + 1) % 24;
                      const fmt = (n: number) => String(n).padStart(2, '0');
                      return [`${fmt(h.hour)}:00 - ${fmt(end)}:00`, h.received, h.completed, h.rate];
                    })
                  )}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  ↓ CSV
                </button>
              )}
              <ViewToggle view={hourlyView} onChange={setHourlyView} />
            </div>
          </div>
          {hourlyView === 'chart' ? (
            <ResponsiveContainer width="100%" height={185}>
              <BarChart data={hourly} margin={{ top: 5, right: 16, left: -14, bottom: 5 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="hour" tick={<HourlyTick />} axisLine={false} tickLine={false} interval={3} height={48} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<HourlyTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="received" name="Received" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-gray-100">
              <Table columns={hourlyColumns} data={hourlyTableData} rowKey={row => String(row.hour)} emptyMessage="No hourly data available." />
            </div>
          )}
        </motion.div>

        <motion.div variants={staggerItem} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100/80 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900">Avg Completion Time</h2>
            <div className="flex items-center gap-2">
              {avgView === 'table' && avgCompletion && (
                <button
                  onClick={() => downloadCSV(
                    'avg-completion-time.csv',
                    ['Priority', 'Avg Hours', 'Bookings'],
                    avgTableData.map(r => [r.priority, r.avg_hours, r.count])
                  )}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  ↓ CSV
                </button>
              )}
              <ViewToggle view={avgView} onChange={setAvgView} />
            </div>
          </div>
          {avgCompletion ? (
            avgView === 'chart' ? (
              <>
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-4 text-center">
                  <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.5 }}
                    className="text-3xl font-black text-indigo-700">{avgCompletion.overall_avg_hours}h</motion.p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">Overall average</p>
                  <p className="text-[10px] text-gray-400">{avgCompletion.overall_count} completed bookings</p>
                </div>
                <div className="flex flex-col gap-2">
                  {avgCompletion.by_priority.map(p => (
                    <div key={p.priority}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-gray-600">{p.priority}</span>
                        <span className="text-[11px] font-bold text-gray-700">{p.avg_hours}h</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round((p.avg_hours / maxAvgHours) * 100)}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${PRIORITY_COLORS[p.priority] ?? 'bg-indigo-400'}`}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{p.count} bookings</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                <Table columns={avgColumns} data={avgTableData} rowKey={row => row.priority} emptyMessage="No data yet." />
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">No data yet</div>
          )}
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