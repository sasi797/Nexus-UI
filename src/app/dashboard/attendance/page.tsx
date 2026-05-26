'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

import Table, { ColumnDef } from '@/components/Table';
import { pageTransition, staggerItem, popIn } from '@/lib/animations';
import { useGetAgentsQuery } from '@/services/agentsApi';
import { useGetAttendanceQuery, useUpsertAttendanceMutation } from '@/services/attendanceApi';
import { useGetShiftsQuery, Shift } from '@/services/shiftsApi';

type AttendanceStatus = 'Present' | 'Absent' | 'On Break' | 'Late';

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

function useDropdownPos(open: boolean, btnRef: React.RefObject<HTMLButtonElement | null>) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, [open, btnRef]);
  return pos;
}

function ShiftSelect({ value, shifts, onChange }: { value: string; shifts: Shift[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pos = useDropdownPos(open, btnRef);
  const selected = shifts.find(s => s.id === value);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (!btnRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 pl-2.5 pr-2 py-1 bg-white border border-gray-200 rounded-lg text-[12px] font-medium text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all shadow-sm min-w-[130px] justify-between">
        <span className="truncate">{selected ? selected.name : <span className="text-gray-400">— No Shift —</span>}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 170), zIndex: 9999 }}
          className="bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 overflow-hidden">
          <div onClick={() => { onChange(''); setOpen(false); }}
            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 text-[12px] text-gray-400 font-medium transition-colors">
            <span className="w-4 h-4" />
            — No Shift —
          </div>
          {shifts.map(s => (
            <div key={s.id} onClick={() => { onChange(s.id); setOpen(false); }}
              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-[13px] font-medium transition-colors ${s.id === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}>
              <span className={`w-4 h-4 flex items-center justify-center shrink-0`}>
                {s.id === value && (
                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                )}
              </span>
              <span>{s.name}</span>
              <span className="ml-auto text-[11px] text-gray-400 font-normal">{s.start_time} – {s.end_time}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

const STATUS_LIST: AttendanceStatus[] = ['Present', 'Absent', 'On Break', 'Late'];

function StatusSelect({ value, onChange }: { value: AttendanceStatus; onChange: (v: AttendanceStatus) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pos = useDropdownPos(open, btnRef);
  const c = statusCfg[value];

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (!btnRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-[13px] font-bold border focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all shadow-sm ${c.bg} ${c.text} ${c.ring}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
        <span>{value}</span>
        <svg className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: 160, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 overflow-hidden">
          {STATUS_LIST.map(s => {
            const sc = statusCfg[s];
            return (
              <div key={s} onClick={() => { onChange(s); setOpen(false); }}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${s === value ? sc.bg : 'hover:bg-gray-50'}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                <span className={`text-[13px] font-semibold ${s === value ? sc.text : 'text-gray-700'}`}>{s}</span>
                {s === value && (
                  <svg className={`w-3.5 h-3.5 ml-auto ${sc.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

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
  const [saveError, setSaveError] = useState<string | null>(null);

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

  // Table rows: always show all agents; use DB record status when available, else default to Absent
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
    if (!filteredAgents.length) return [];
    // Build a map of existing attendance records keyed by agent_id
    const recMap = new Map(filteredAttendance.map(r => [r.agent_id, r]));
    return filteredAgents.map((a, i) => {
      const rec = recMap.get(a.id);
      const sid = rowShifts[a.id] ?? rec?.shift_id ?? a.shift_id ?? '';
      const shiftObj = shifts.find(s => s.id === sid);
      return {
        id: a.id, name: a.name, email: a.email,
        shiftName: shiftObj?.name ?? a.shift?.name ?? '—',
        rowShiftId: sid,
        status: (statuses[a.id] ?? rec?.status ?? 'Absent') as AttendanceStatus,
        avatarIdx: i,
      };
    });
  }, [initialized, filteredAgents, filteredAttendance, agents, shifts, statuses, rowShifts]);

  const counts = useMemo(() =>
    (Object.keys(statusCfg) as AttendanceStatus[]).map(s => ({ s, n: tableData.filter(r => r.status === s).length })),
    [tableData]
  );

  const handleSave = async () => {
    // Only save agents that were explicitly changed OR already have a DB record
    // Never silently create records for agents the user hasn't touched
    const existingIds = new Set(filteredAttendance.map(r => r.agent_id));
    const changedIds = new Set(Object.keys(statuses));
    const records = tableData
      .filter(row => existingIds.has(row.id) || changedIds.has(row.id))
      .map(row => ({
        agent_id: row.id, date, status: statuses[row.id] ?? row.status,
        shift_id: rowShifts[row.id] || row.rowShiftId || undefined,
      }));
    if (!records.length) return;
    setSaveError(null);
    try {
      await upsert({ date, records }).unwrap();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError('Failed to save attendance. Please try again.');
    }
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
          <span className="font-semibold text-gray-800 text-[13px]">{String(v)}</span>
        </div>
      ),
    },
    { key: 'email', header: 'Email', sortable: true, filterable: true, render: v => <span className="text-gray-400 text-[13px]">{String(v)}</span> },
    {
      key: 'shiftName', header: 'Shift', sortable: true, filterable: true,
      render: (_, row) => {
        const r = row as AttendanceRow;
        return <ShiftSelect value={r.rowShiftId} shifts={shifts} onChange={v => setRowShifts(p => ({ ...p, [r.id]: v }))} />;
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-semibold ring-1 ${c.ring} ${c.bg} ${c.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{st}
            </motion.span>
          </AnimatePresence>
        );
      },
    },
    {
      key: 'id', header: 'Update Status',
      render: (_, row) => {
        const r = row as AttendanceRow;
        return <StatusSelect value={r.status} onChange={v => setStatuses(p => ({ ...p, [r.id]: v }))} />;
      },
    },
  ];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3 max-w-5xl">
      {/* <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Attendance Management</motion.h1> */}
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
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.02, boxShadow: '0 6px 20px rgba(99,102,241,0.25)' }} whileTap={{ scale: 0.97 }}
              onClick={handleSave} disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-md transition-all disabled:opacity-60">
              <AnimatePresence mode="wait">
                {saved
                  ? <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>✓ Saved!</motion.span>
                  : <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{saving ? 'Saving...' : 'Save Attendance'}</motion.span>}
              </AnimatePresence>
            </motion.button>
            {saveError && (
              <span className="text-xs font-semibold text-red-600">{saveError}</span>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}