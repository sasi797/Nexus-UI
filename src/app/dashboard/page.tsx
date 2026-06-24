'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, LabelList, PieChart, Pie, Cell, BarChart,
} from 'recharts';
import { pageTransition, staggerItem } from '@/lib/animations';
import Table, { ColumnDef } from '@/components/Table';
import { useGetDashboardStatsQuery } from '@/services/dashboardApi';
import { useGetHourlyActivityQuery, useGetStatusBreakdownQuery, useGetPriorityDistributionQuery, useGetAvgCompletionQuery } from '@/services/reportsApi';
import ApiErrorState from '@/components/ApiErrorState';

/* ── helpers ── */
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

type ViewMode = 'chart' | 'table';
function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {(['chart', 'table'] as ViewMode[]).map(v => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all capitalize ${
            view === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}>
          {v === 'chart' ? 'Chart' : 'Table'}
        </button>
      ))}
    </div>
  );
}

/* ── shared tick — single 1s interval drives all timers ── */
let sharedTick = Date.now();

/* ── skeleton ── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 animate-pulse rounded-2xl ${className}`} />;
}

/* ── small icons for card header ── */
const ICON = {
  clipboard: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  clock:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3"/></svg>,
  refresh:   <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>,
  check:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  alert:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78A1.5 1.5 0 0022.18 18L13.71 3.86a1.5 1.5 0 00-2.42 0z"/></svg>,
  hash:      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 9h14M5 15h14M9 4L7 20m10-16l-2 16"/></svg>,
  ban:       <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.343 17.657l11.314-11.314"/></svg>,
};

/* ── watermark icons ── */
const WM = {
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <path d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78A1.5 1.5 0 0022.18 18L13.71 3.86a1.5 1.5 0 00-2.42 0z"/>
    </svg>
  ),
  hash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <path d="M5 9h14M5 15h14M9 4L7 20m10-16l-2 16"/>
    </svg>
  ),
  ban: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
      <circle cx="12" cy="12" r="9"/><path d="M6.343 17.657l11.314-11.314"/>
    </svg>
  ),
};

/* ── stat card ── */
function StatCard({ label, value, gradient, border, valueColor, iconBg, iconColor, icon, watermarkColor, watermark, sub, delay = 0 }: {
  label: string; value: number; gradient: string; border: string;
  valueColor: string; iconBg: string; iconColor: string; icon: React.ReactNode;
  watermarkColor: string; watermark: React.ReactNode;
  sub?: { value: number; label: string } | null; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`relative overflow-hidden rounded-xl ${gradient} ${border} border px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow cursor-default select-none`}
    >
      {/* Watermark */}
      <div className={`absolute -right-2 -bottom-2 ${watermarkColor} pointer-events-none`}>
        {watermark}
      </div>

      {/* Top row: icon + label */}
      <div className="flex items-center justify-between mb-1.5">
        <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center ${iconColor} shrink-0`}>
          {icon}
        </div>
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      </div>

      {/* Value */}
      <motion.p
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, delay: delay + 0.08 }}
        className={`text-3xl font-black leading-none ${valueColor}`}
      >
        {value}
      </motion.p>

      {/* Sub metric */}
      {sub && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${iconBg} ${iconColor} text-[12px] font-bold`}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            {sub.value}
          </span>
          <span className="text-[11px] font-medium text-gray-500">{sub.label}</span>
        </div>
      )}
    </motion.div>
  );
}

/* ── page ── */
/* ── hourly chart tooltip ── */
function HourlyFlowTooltip({ active, payload }: {
  active?: boolean; payload?: { name: string; value: number; color: string; payload: { label: string } }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3.5 py-2.5 text-[11px]">
      <p className="font-bold text-gray-700 mb-1.5">{payload[0].payload.label}</p>
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

export default function DashboardPage() {
  const MIN_DATE = '2026-06-01';
  const BST_TZ = 'Europe/London';
  const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: BST_TZ }).format(new Date());

  const [statsDate, setStatsDate] = useState<string | null>(null);

  // DA Count still comes from the dashboard API (bookings API doesn't expose it)
  const { data: dashStats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } =
    useGetDashboardStatsQuery(statsDate ? { date: statsDate, tz: BST_TZ } : undefined, { pollingInterval: 30_000 });

  const stats = {
    total_bookings:   dashStats?.total_bookings  ?? 0,
    pending:          dashStats?.pending          ?? 0,
    in_progress:      dashStats?.in_progress      ?? 0,
    completed:        dashStats?.completed        ?? 0,
    ignored:          dashStats?.ignored          ?? 0,
    da_numbers_count: dashStats?.da_numbers_count ?? 0,
  };

  const { data: statusBreakdown = [] } = useGetStatusBreakdownQuery();
  const { data: priorityDist = [] } = useGetPriorityDistributionQuery();
  const { data: avgCompletion } = useGetAvgCompletionQuery();
  const [avgView, setAvgView] = useState<ViewMode>('table');
  const maxAvgHours = avgCompletion ? Math.max(...avgCompletion.by_priority.map(x => x.avg_hours), 1) : 1;
  const PRIORITY_COLORS: Record<string, string> = { 'Very Urgent': 'bg-red-400', 'Urgent': 'bg-amber-400', 'Not Urgent': 'bg-emerald-400' };
  const avgTableData = avgCompletion ? [
    { priority: 'Overall', avg_hours: avgCompletion.overall_avg_hours, count: avgCompletion.overall_count },
    ...avgCompletion.by_priority,
  ] : [];
  const avgColumns: ColumnDef<{ priority: string; avg_hours: number; count: number }>[] = [
    {
      key: 'priority', header: 'Priority', sortable: true,
      render: (v) => {
        const colorMap: Record<string, string> = { 'Very Urgent': 'text-red-600', 'Urgent': 'text-amber-600', 'Not Urgent': 'text-emerald-600', 'Overall': 'text-indigo-700' };
        return <span className={`font-bold text-sm ${colorMap[String(v)] ?? 'text-gray-700'} ${v === 'Overall' ? 'italic' : ''}`}>{String(v)}</span>;
      },
    },
    { key: 'avg_hours', header: 'Avg Hours', sortable: true, render: v => <span className="font-bold text-gray-800">{Number(v).toFixed(1)}h</span> },
    { key: 'count', header: 'Bookings', sortable: true, render: v => <span className="font-medium text-gray-600">{String(v)}</span> },
  ];

  const hourlyDate = statsDate ?? todayISO;
  const { data: hourly = [], isLoading: hourlyLoading } = useGetHourlyActivityQuery({ date: hourlyDate, tz: BST_TZ }, { pollingInterval: 30_000 });
  const isToday = hourlyDate === todayISO;

  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      sharedTick = Date.now();
      setTick(sharedTick);
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const nowDate = new Date(tick);
  const bstParts = new Intl.DateTimeFormat('en-GB', { timeZone: BST_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(nowDate);
  const currentHour = Number(bstParts.find(p => p.type === 'hour')?.value ?? 0);
  const currentMinute = Number(bstParts.find(p => p.type === 'minute')?.value ?? 0);
  const currentHourFraction = currentHour + currentMinute / 60;
  const currentTimeLabel = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  const hourlyFlow = useMemo(() => {
    return hourly.map(h => {
      const completed = h.completed;
      const pending = Math.max(h.received - h.completed, 0);
      return { hour: h.hour, label: h.label, completed, pending };
    });
  }, [hourly]);

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-5">
      {statsError && <ApiErrorState title="Failed to load stats" onRetry={refetchStats} />}

      {/* ── Stat cards ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 text-sm leading-tight">Overview</h2>
          <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
            {statsDate ? `Bookings on ${new Date(statsDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'All time'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statsDate && (
            <>
              <button
                onClick={() => {
                  const d = new Date(statsDate);
                  d.setDate(d.getDate() - 1);
                  const prev = d.toISOString().split('T')[0];
                  if (prev >= MIN_DATE) setStatsDate(prev);
                }}
                disabled={statsDate <= MIN_DATE}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >‹</button>
            </>
          )}
          <input
            type="date"
            value={statsDate ?? ''}
            min={MIN_DATE}
            max={todayISO}
            onChange={e => setStatsDate(e.target.value || null)}
            className="text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-lg px-2 py-1 bg-white cursor-pointer focus:outline-none focus:border-indigo-300"
          />
          {statsDate && (
            <>
              <button
                onClick={() => {
                  const d = new Date(statsDate);
                  d.setDate(d.getDate() + 1);
                  const next = d.toISOString().split('T')[0];
                  if (next <= todayISO) setStatsDate(next);
                }}
                disabled={statsDate === todayISO}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >›</button>
              <button
                onClick={() => setStatsDate(null)}
                className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors"
              >All time</button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        {statsLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : (
            <>
              <StatCard
                label="Total Bookings" value={stats?.total_bookings ?? 0}
                gradient="bg-gradient-to-br from-indigo-50 to-violet-100"
                border="border-indigo-100" valueColor="text-indigo-700"
                iconBg="bg-indigo-100" iconColor="text-indigo-600" icon={ICON.clipboard}
                watermarkColor="text-indigo-200" watermark={WM.clipboard} delay={0}
              />
              <StatCard
                label="Completed" value={stats?.completed ?? 0}
                gradient="bg-gradient-to-br from-emerald-50 to-teal-100"
                border="border-emerald-100" valueColor="text-emerald-700"
                iconBg="bg-emerald-100" iconColor="text-emerald-600" icon={ICON.check}
                watermarkColor="text-emerald-200" watermark={WM.check} delay={0.07}
              />
              <StatCard
                label="Open" value={stats?.pending ?? 0}
                gradient="bg-gradient-to-br from-amber-50 to-orange-100"
                border="border-amber-100" valueColor="text-amber-700"
                iconBg="bg-amber-100" iconColor="text-amber-600" icon={ICON.clock}
                watermarkColor="text-amber-200" watermark={WM.clock} delay={0.14}
              />
              <StatCard
                label="In Progress" value={stats?.in_progress ?? 0}
                gradient="bg-gradient-to-br from-blue-50 to-sky-100"
                border="border-blue-100" valueColor="text-blue-700"
                iconBg="bg-blue-100" iconColor="text-blue-600" icon={ICON.refresh}
                watermarkColor="text-blue-200" watermark={WM.refresh} delay={0.21}
              />
              <StatCard
                label="Ignored" value={stats?.ignored ?? 0}
                gradient="bg-gradient-to-br from-slate-50 to-gray-100"
                border="border-slate-200" valueColor="text-slate-600"
                iconBg="bg-slate-100" iconColor="text-slate-500" icon={ICON.ban}
                watermarkColor="text-slate-200" watermark={WM.ban} delay={0.28}
              />
              <StatCard
                label="DA Count" value={stats?.da_numbers_count ?? 0}
                gradient="bg-gradient-to-br from-violet-50 to-purple-100"
                border="border-violet-100" valueColor="text-violet-700"
                iconBg="bg-violet-100" iconColor="text-violet-600" icon={ICON.hash}
                watermarkColor="text-violet-200" watermark={WM.hash} delay={0.35}
              />
            </>
          )
        }
      </div>

      {/* ── Hourly Bookings Flow ── */}
      <motion.div variants={staggerItem} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-gray-900 text-sm leading-tight">Hourly Bookings Flow</h2>
            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
              {isToday ? 'Today, by hour' : `${new Date(hourlyDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, by hour`}
            </p>
          </div>
          {isToday && (
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg whitespace-nowrap">
              Current time {currentTimeLabel}
            </span>
          )}
        </div>
        {hourlyLoading
          ? <Skeleton className="h-[260px]" />
          : (
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={hourlyFlow} margin={{ top: 5, right: 10, left: 0, bottom: 10 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="hour" type="number" domain={[0, 23]} ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]}
                  tickFormatter={(h: number) => `${String(h).padStart(2, '0')}:00`}
                  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickMargin={10}
                  padding={{ left: 16, right: 16 }}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<HourlyFlowTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                {isToday && (
                  <ReferenceLine
                    x={currentHourFraction}
                    stroke="#3b82f6"
                    strokeDasharray="4 4"
                    label={{ value: `Now ${currentTimeLabel}`, position: 'top', fill: '#3b82f6', fontSize: 10, fontWeight: 700 }}
                  />
                )}
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="completed" position="inside" fill="#fff" fontSize={10} fontWeight={700} formatter={(v: React.ReactNode) => (Number(v) > 0 ? String(v) : '')} />
                </Bar>
                <Bar dataKey="pending" name="Open" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="pending" position="inside" fill="#fff" fontSize={10} fontWeight={700} formatter={(v: React.ReactNode) => (Number(v) > 0 ? String(v) : '')} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          )
        }
      </motion.div>

      {/* ── Priority Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Booking Status by Priority */}
        <motion.div variants={staggerItem} className="col-span-1 lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-bold text-gray-900 text-sm">Booking Status by Priority</h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] font-semibold text-gray-500">
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
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="in_progress" name="In Progress" stackId="a" fill="#60a5fa" isAnimationActive={false} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Bookings by Priority */}
        <motion.div variants={staggerItem} className="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 text-sm mb-1">Bookings by Priority</h2>
          <div className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={165} height={165}>
                <PieChart>
                  <Pie data={priorityDist} cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={4} dataKey="value">
                    {priorityDist.map((e, i) => <Cell key={i} fill={e.color} stroke="white" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip formatter={v => [`${v}%`, '']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-xl font-black text-gray-900">{stats.total_bookings || '—'}</p>
                <p className="text-[10px] text-gray-400 font-medium">Total</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-1 w-full px-2">
              {priorityDist.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600 font-medium">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-700">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Avg Completion Time ── */}
      <motion.div variants={staggerItem} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 text-sm">Avg Completion Time</h2>
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
            <div className="flex flex-col gap-4">
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-indigo-700">{avgCompletion.overall_avg_hours}h</p>
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
            </div>
          ) : (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <Table columns={avgColumns} data={avgTableData} rowKey={row => row.priority} emptyMessage="No data yet." />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-24 text-gray-300 text-sm">No data yet</div>
        )}
      </motion.div>
    </motion.div>
  );
}
