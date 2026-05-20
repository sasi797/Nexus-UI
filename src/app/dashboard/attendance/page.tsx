'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AttendanceStatus } from '@/lib/data';
import Table, { ColumnDef } from '@/components/Table';
import { pageTransition, staggerItem, popIn } from '@/lib/animations';
import { useGetAgentsQuery } from '@/services/agentsApi';
import { useGetAttendanceQuery, useUpsertAttendanceMutation } from '@/services/attendanceApi';
import { useGetShiftsQuery } from '@/services/shiftsApi';

const statusCfg: Record<AttendanceStatus, { text: string; bg: string; ring: string; dot: string }> = {
  Present:    { text: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  Absent:     { text: 'text-red-700',     bg: 'bg-red-50',      ring: 'ring-red-200',     dot: 'bg-red-500' },
  'On Break': { text: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'ring-amber-200',   dot: 'bg-amber-400' },
  Late:       { text: 'text-orange-700',  bg: 'bg-orange-50',   ring: 'ring-orange-200',  dot: 'bg-orange-500' },
};
const avatarGrads = [
  'from-indigo-500 to-violet-500', 'from-sky-500 to-blue-500', 'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500', 'from-amber-500 to-orange-500', 'from-purple-500 to-fuchsia-500',
];

interface AttendanceRow { id: string; name: string; email: string; shiftName: string; rowShiftId: string; status: AttendanceStatus; avatarIdx: number }

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AttendancePage() {
  const [date, setDate] = useState(todayLocal);
  const [shiftId, setShiftId] = useState('');
  // statuses and rowShifts hold user edits keyed by agent_id
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [rowShifts, setRowShifts] = useState<Record<string, string>>({});
  // true after user clicks "Take Attendance" for a date with no existing records
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: agents } = useGetAgentsQuery();
  const { data: shifts = [] } = useGetShiftsQuery();
  // Always fetch all records for the date; shift filtering is done on the frontend by agent assignment
  const { data: attendance, isFetching: attendanceFetching } = useGetAttendanceQuery({ date });
  const [upsert, { isLoading: saving }] = useUpsertAttendanceMutation();

  // Agents in the selected shift (or all agents when no shift is selected)
  const filteredAgents = useMemo(
    () => shiftId ? (agents ?? []).filter(a => a.shift_id === shiftId) : (agents ?? []),
    [agents, shiftId]
  );

  // Attendance records narrowed to the current agent set, deduplicated by agent_id
  const filteredAttendance = useMemo(() => {
    const raw = attendance ?? [];
    const ids = shiftId ? new Set(filteredAgents.map(a => a.id)) : null;
    const seen = new Set<string>();
    return raw.filter(rec => {
      if (ids && !ids.has(rec.agent_id)) return false;
      if (seen.has(rec.agent_id)) return false;
      seen.add(rec.agent_id);
      return true;
    });
  }, [attendance, shiftId, filteredAgents]);

  // Seed once per date (shift filtering is frontend-only, no re-seed needed for shift changes)
  const seededDate = useRef<string | null>(null);
  useEffect(() => {
    if (attendanceFetching) return;
    if (seededDate.current === date) return;

    // Seed only from actual DB records — no default fallback
    const statusMap: Record<string, AttendanceStatus> = {};
    const shiftMap: Record<string, string> = {};
    (attendance ?? []).forEach(rec => {
      statusMap[rec.agent_id] = rec.status as AttendanceStatus;
      const agent = (agents ?? []).find(a => a.id === rec.agent_id);
      shiftMap[rec.agent_id] = rec.shift_id ?? agent?.shift_id ?? '';
    });
    setStatuses(statusMap);
    setRowShifts(shiftMap);
    setInitialized(false);
    seededDate.current = date;
  }, [date, attendance, agents, attendanceFetching]);

  // Pre-fill all agents as Present so admin can adjust and save for a new date
  const handleTakeAttendance = () => {
    const statusMap: Record<string, AttendanceStatus> = {};
    const shiftMap: Record<string, string> = {};
    filteredAgents.forEach(a => {
      statusMap[a.id] = 'Present';
      shiftMap[a.id] = a.shift_id ?? '';
    });
    setStatuses(statusMap);
    setRowShifts(shiftMap);
    setInitialized(true);
  };

  // Table rows come from filtered DB records; in "initialized" mode use the full agent list
  const tableData: AttendanceRow[] = useMemo(() => {
    if (initialized) {
      return filteredAgents.map((a, i) => {
        const sid = rowShifts[a.id] ?? a.shift_id ?? '';
        const shiftObj = shifts.find(s => s.id === sid);
        return {
          id: a.id, name: a.name, email: a.email,
          shiftName: shiftObj?.name ?? a.shift?.name ?? '—',
          rowShiftId: sid,
          status: statuses[a.id] ?? 'Present', avatarIdx: i,
        };
      });
    }
    if (!filteredAttendance.length) return [];
    return filteredAttendance.map((rec, i) => {
      const agent = (agents ?? []).find(a => a.id === rec.agent_id);
      const sid = rowShifts[rec.agent_id] ?? rec.shift_id ?? agent?.shift_id ?? '';
      const shiftObj = shifts.find(s => s.id === sid);
      return {
        id: rec.agent_id,
        name: agent?.name ?? rec.agent?.name ?? 'Unknown',
        email: agent?.email ?? rec.agent?.email ?? '',
        shiftName: shiftObj?.name ?? agent?.shift?.name ?? '—',
        rowShiftId: sid,
        status: (statuses[rec.agent_id] ?? rec.status) as AttendanceStatus,
        avatarIdx: i,
      };
    });
  }, [initialized, filteredAgents, filteredAttendance, agents, shifts, statuses, rowShifts]);

  const counts = useMemo(() =>
    (Object.keys(statusCfg) as AttendanceStatus[]).map(s => ({ s, n: tableData.filter(r => r.status === s).length })),
    [tableData]
  );

  const handleSave = async () => {
    const records = Object.entries(statuses).map(([agent_id, status]) => ({
      agent_id, date, status,
      shift_id: rowShifts[agent_id] || undefined,
    }));
    if (!records.length) return;
    await upsert({ date, records });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasRecords = tableData.length > 0;

  const columns: ColumnDef<AttendanceRow>[] = [
    {
      key: 'name', header: 'Agent', sortable: true, filterable: true,
      render: (v, row) => (
        <div className="flex items-center gap-2.5">
          <motion.div whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: 'spring', stiffness: 400 }}
            className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGrads[(row as AttendanceRow).avatarIdx % avatarGrads.length]} flex items-center justify-center text-white font-bold text-xs shadow-md`}>
            {String(v).charAt(0)}
          </motion.div>
          <span className="font-semibold text-gray-800 text-xs">{String(v)}</span>
        </div>
      ),
    },
    { key: 'email', header: 'Email', sortable: true, filterable: true, render: v => <span className="text-gray-400 text-xs">{String(v)}</span> },
    {
      key: 'shiftName', header: 'Shift', sortable: true, filterable: true,
      render: (_, row) => {
        const r = row as AttendanceRow;
        return (
          <select value={r.rowShiftId} onChange={e => setRowShifts(p => ({ ...p, [r.id]: e.target.value }))}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium transition-all">
            <option value="">— No Shift —</option>
            {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        );
      },
    },
    {
      key: 'status', header: 'Status', sortable: true, filterable: true,
      render: (_, row) => {
        const st = (row as AttendanceRow).status;
        const c = statusCfg[st];
        return (
          <AnimatePresence mode="wait">
            <motion.span key={st} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: 'spring', stiffness: 400 }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${c.ring} ${c.bg} ${c.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{st}
            </motion.span>
          </AnimatePresence>
        );
      },
    },
    {
      key: 'id', header: 'Update Status', width: '130px',
      render: (_, row) => {
        const r = row as AttendanceRow;
        return (
          <select value={r.status} onChange={e => setStatuses(p => ({ ...p, [r.id]: e.target.value as AttendanceStatus }))}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium transition-all">
            {(Object.keys(statusCfg) as AttendanceStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        );
      },
    },
  ];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3 max-w-5xl">
      <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Attendance Management</motion.h1>
      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            Attendance — <span className="text-indigo-600">{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </h2>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-all" />
            <select value={shiftId} onChange={e => setShiftId(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-all">
              <option value="">All Shifts</option>
              {shifts.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status count pills — only shown when there are records */}
        {hasRecords && (
          <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-50 flex-wrap">
            {counts.map(({ s, n }) => {
              const c = statusCfg[s];
              return (
                <motion.div key={s} variants={popIn} initial="hidden" animate="visible" whileHover={{ scale: 1.05 }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text} ring-1 ${c.ring}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{s}: {n}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Content area */}
        {attendanceFetching ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : hasRecords ? (
          <Table columns={columns} data={tableData} rowKey={row => row.id} />
        ) : (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500">No attendance records for this date</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Records only exist for dates attendance was taken</p>
            </div>
            {filteredAgents.length > 0 && (
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleTakeAttendance}
                className="mt-1 text-xs font-bold text-indigo-600 border border-indigo-200 px-4 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                Take Attendance for This Date
              </motion.button>
            )}
          </div>
        )}

        {/* Save button — only shown when there are records to save */}
        {hasRecords && (
          <div className="px-4 py-3 border-t border-gray-100">
            <motion.button whileHover={{ scale: 1.02, boxShadow: '0 6px 20px rgba(99,102,241,0.25)' }} whileTap={{ scale: 0.97 }}
              onClick={handleSave} disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-md transition-all disabled:opacity-60">
              <AnimatePresence mode="wait">
                {saved
                  ? <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>✓ Saved!</motion.span>
                  : <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{saving ? 'Saving...' : 'Save Attendance'}</motion.span>}
              </AnimatePresence>
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}