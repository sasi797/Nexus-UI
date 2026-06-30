'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Row {
  id: number;
  l: string;
  w: string;
  h: string;
  qty: string;
}

const MAX_ROWS = 30;
let nextId = 1;

function makeRow(): Row {
  return { id: nextId++, l: '', w: '', h: '', qty: '' };
}

type Unit = 'cm' | 'inches' | 'cbm';

function getDivisor(unit: Unit): number {
  return unit === 'cm' ? 6000 : unit === 'inches' ? 366 : 166.67;
}

function calcVol(row: Row, unit: Unit): number | null {
  const qty = row.qty === '' ? 1 : parseFloat(row.qty) || 0;
  if (unit === 'cbm') {
    const cbm = parseFloat(row.l) || 0;
    return cbm > 0 ? cbm * 166.67 * qty : null;
  }
  const l = parseFloat(row.l) || 0;
  const w = parseFloat(row.w) || 0;
  const h = parseFloat(row.h) || 0;
  const divisor = getDivisor(unit);
  return l > 0 && w > 0 && h > 0 ? (l * w * h * qty) / divisor : null;
}

const ALL_FIELDS = ['l', 'w', 'h', 'qty'] as const;
const CBM_FIELDS = ['l', 'qty'] as const;

export default function DACalculatorPage() {
  const [unit, setUnit] = useState<Unit>('cm');
  const [rows, setRows] = useState<Row[]>([makeRow()]);

  const divisor = getDivisor(unit);
  const FIELDS = unit === 'cbm' ? CBM_FIELDS : ALL_FIELDS;
  const FIELD_LABELS: Record<string, string> = {
    l: unit === 'cbm' ? 'CBM' : 'Length',
    w: 'Width', h: 'Height', qty: 'Qty',
  };

  const updateRow = useCallback((id: number, field: keyof Omit<Row, 'id'>, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => prev.length < MAX_ROWS ? [...prev, makeRow()] : prev);
  }, []);

  const removeRow = useCallback((id: number) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  }, []);

  const clearAll = useCallback(() => {
    nextId = 1;
    setRows([makeRow()]);
  }, []);

  const rowResults = rows.map(r => ({ id: r.id, vol: calcVol(r, unit) }));
  const total = rowResults.reduce((sum, r) => sum + (r.vol ?? 0), 0);
  const hasAnyResult = rowResults.some(r => r.vol !== null);
  const filledRows = rowResults.filter(r => r.vol !== null).length;
  const progressPct = (rows.length / MAX_ROWS) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-white border-b border-slate-200/80 px-6 pt-5 pb-4 shadow-sm">
        {/* decorative top stripe */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #7c3aed, #6366f1, #818cf8)' }} />

        <div className="flex items-center justify-between gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
              <svg className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-extrabold text-slate-900 leading-none tracking-tight">
                DA Volumetric Calculator
              </h1>
              <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium">
                {unit === 'cbm'
                  ? `CBM × 166.67 × Qty · max ${MAX_ROWS} rows`
                  : `L × W × H × Qty ÷ ${divisor.toLocaleString()} · max ${MAX_ROWS} rows`}
              </p>
            </div>
          </div>

          {/* Unit toggle */}
          <div className="flex rounded-xl p-1 gap-0.5 bg-slate-100 border border-slate-200">
            {([['cm', 'CM'], ['inches', 'IN'], ['cbm', 'CBM']] as [Unit, string][]).map(([u, label]) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className="relative px-4 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                style={{ color: unit === u ? '#fff' : '#94a3b8' }}
              >
                {unit === u && (
                  <motion.span
                    layoutId="unit-bg"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats + progress */}
        <div className="mt-4 flex items-center gap-2">
          {[
            { label: 'Rows', value: `${rows.length} / ${MAX_ROWS}`, color: '#6366f1' },
            { label: 'Calculated', value: filledRows, color: '#10b981' },
            { label: unit === 'cbm' ? 'Factor' : 'Divisor', value: unit === 'cbm' ? '166.67' : divisor.toLocaleString(), color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{s.label}</span>
              <span className="text-[11px] font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
          <div className="flex-1 mx-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #818cf8)', originX: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <th className="w-10 px-3 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">#</th>
                {FIELDS.map(f => (
                  <th key={f} className="px-3 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-left">
                    {FIELD_LABELS[f]}{f !== 'qty' && unit !== 'cbm' ? ` (${unit})` : ''}
                  </th>
                ))}
                <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right">Vol Wt (kg)</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((row, idx) => {
                  const vol = calcVol(row, unit);
                  const done = vol !== null;
                  return (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.16 }}
                      className="group border-b border-slate-100 last:border-0 hover:bg-violet-50/40 transition-colors"
                    >
                      {/* # */}
                      <td className="px-3 py-2 text-center">
                        <span
                          className="inline-flex w-5 h-5 items-center justify-center rounded-md text-[10px] font-extrabold tabular-nums"
                          style={done
                            ? { background: 'linear-gradient(135deg,#ede9fe,#e0e7ff)', color: '#7c3aed' }
                            : { background: '#f1f5f9', color: '#94a3b8' }}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      {/* Inputs */}
                      {FIELDS.map(field => (
                        <td key={field} className="px-1.5 py-1.5">
                          <input
                            type="number"
                            min="0"
                            value={row[field]}
                            onChange={e => updateRow(row.id, field, e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-2 text-[13px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none tabular-nums placeholder:text-slate-300 placeholder:font-normal transition-all focus:bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                          />
                        </td>
                      ))}

                      {/* Result */}
                      <td className="px-4 py-2 text-right min-w-[90px]">
                        <AnimatePresence mode="wait">
                          {done ? (
                            <motion.span
                              key="v"
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.14 }}
                              className="inline-block text-[13px] font-extrabold tabular-nums"
                              style={{ color: '#7c3aed' }}
                            >
                              {vol!.toFixed(3)}
                            </motion.span>
                          ) : (
                            <motion.span key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              className="text-slate-300 text-sm">—</motion.span>
                          )}
                        </AnimatePresence>
                      </td>

                      {/* Remove */}
                      <td className="px-2 py-2 text-center">
                        <motion.button
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length === 1}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          className="w-6 h-6 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:!opacity-0 text-red-400 hover:bg-red-50"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </motion.button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-3 px-1">
          <motion.button
            onClick={addRow}
            disabled={rows.length >= MAX_ROWS}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 text-[12px] font-bold px-4 py-2 rounded-xl text-white disabled:opacity-30 disabled:pointer-events-none"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Row
          </motion.button>

          <button
            onClick={clearAll}
            className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-50"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* ── Total footer ────────────────────────────────────────── */}
      <div className="bg-white border-t border-slate-200 px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Total Volumetric Weight</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {rows.length} shipment{rows.length !== 1 ? 's' : ''} · {unit === 'cbm' ? 'CBM/CBF' : unit.toUpperCase()} · {unit === 'cbm' ? '×166.67' : `÷${divisor.toLocaleString()}`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {hasAnyResult ? (
              <motion.div
                key="total"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-baseline gap-1.5"
              >
                <span
                  className="text-[38px] font-black tabular-nums leading-none tracking-tight"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  {total.toFixed(3)}
                </span>
                <span className="text-base font-bold text-violet-300 mb-0.5">kg</span>
              </motion.div>
            ) : (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[13px] text-slate-300 font-medium"
              >
                Enter dimensions to calculate
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
