'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AttendanceStatus } from '@/lib/data';
import Table, { ColumnDef } from '@/components/Table';
import { pageTransition, staggerItem, popIn } from '@/lib/animations';
import { useGetAgentsQuery } from '@/services/agentsApi';
import { useGetAttendanceQuery, useUpsertAttendanceMutation } from '@/services/attendanceApi';

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
const shifts = [
  { value: 'morning',   label: 'Morning Shift (06:00 - 14:00)' },
  { value: 'afternoon', label: 'Afternoon Shift (14:00 - 22:00)' },
  { value: 'night',     label: 'Night Shift (22:00 - 06:00)' },
];

interface AttendanceRow { id: string; name: string; email: string; status: AttendanceStatus; avatarIdx: number }

export default function AttendancePage() {
  const [date, setDate] = useState('2026-05-06');
  const [shift, setShift] = useState('morning');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);

  const { data: agents } = useGetAgentsQuery();
  const { data: attendance } = useGetAttendanceQuery({ date });
  const [upsert, { isLoading: saving }] = useUpsertAttendanceMutation();

  // Track which (date + agentsLoaded) combinations we've already seeded so we
  // don't overwrite the user's local edits every time the attendance cache refreshes.
  const seededKey = useRef<string | null>(null);

  useEffect(() => {
    if (!agents?.length) return;
    const key = `${date}:${agents.map(a => a.id).join(',')}`;
    // Re-seed when date changes; if same date, only seed once (don't clobber local edits)
    if (seededKey.current?.startsWith(date) && seededKey.current === key) return;

    const map: Record<string, AttendanceStatus> = {};
    agents.forEach(a => {
      const rec = attendance?.find(r => r.agent_id === a.id);
      map[a.id] = (rec?.status ?? 'Present') as AttendanceStatus;
    });
    setStatuses(map);
    seededKey.current = key;
  // attendance intentionally omitted: we only re-seed on date/agents change, not cache refreshes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, agents]);

  const tableData: AttendanceRow[] = useMemo(
    () => (agents ?? []).map((a, i) => ({ id: a.id, name: a.name, email: a.email, status: statuses[a.id] ?? 'Present', avatarIdx: i })),
    [agents, statuses]
  );

  const counts = useMemo(() =>
    (Object.keys(statusCfg) as AttendanceStatus[]).map(s => ({ s, n: Object.values(statuses).filter(v => v === s).length })),
    [statuses]
  );

  const handleSave = async () => {
    await upsert({
      date,
      records: (agents ?? []).map(a => ({ agent_id: a.id, date, status: statuses[a.id] ?? 'Present' })),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
      key: 'id', header: 'Update', width: '120px',
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
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3 max-w-3xl">
      <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Attendance Management</motion.h1>
      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            Attendance — <span className="text-indigo-600">{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </h2>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-all" />
            <select value={shift} onChange={e => setShift(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-all">
              {shifts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
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
        <Table columns={columns} data={tableData} rowKey={row => row.id} />
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
      </motion.div>
    </motion.div>
  );
}